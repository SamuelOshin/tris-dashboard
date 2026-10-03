# ruff: noqa: E501
"""
Ticket 10 — Material risk to Risk Case (decision D3).

A High or Critical stored risk score opens (or links to) a `material_cost_risk` case. The case then
runs through the unchanged lifecycle: New, Assigned, Under Investigation, Corrective Action,
Pending Verification, Closed, with the same transition matrix, the same eight closure fields and
the same separation of duties as a financial-exception case. The lifecycle tests use distinct real
principals; there is no test-identity escape hatch.

Fixed data: MAT-A (usage 50 a month, SUP-1 60%, flat price 100, stored 30-day forecast 110) scores
30. The default bands call that Moderate, so the tests first store a weight set whose High band is 20.
"""

import asyncio
from datetime import date
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import tests.conftest as harness
from app.api.core.custom_exceptions.exceptions import AlreadyExistsError
from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.manufacturing.service import material_case_service as material_cases
from app.api.modules.v1.manufacturing.service.risk_types import DEFAULT_CONFIG
from tests.conftest import make_principal
from tests.modules.v1.exposure_seed import AS_OF_Q, seed_material, store_run

RISK = "/api/v1/manufacturing/risk-scoring"
MCASE = "/api/v1/manufacturing/material-cases"
CASES = "/api/v1/cases"

SENSITIVE = {
    "weights": DEFAULT_CONFIG["weights"],
    "ramps": DEFAULT_CONFIG["ramps"],
    "bands": {"moderate": 10, "high": 20, "critical": 80},
    "min_evaluable_weight": 50,
}

investigator = make_principal("USR-INV-001", "inv_alice", "Alice Investigator", "reviewer")
verifier = make_principal("USR-VER-001", "ver_bob", "Bob Verifier", "verifier")
CLOSURE = {
    "root_cause": "Supplier price list was not renegotiated before the contract renewal.",
    "corrective_action": "Fixed-price clause agreed for the next two quarters.",
    "closure_type": "Process Error / Remedied",
    "closure_evidence": "contract_amendment_2026.pdf",
    "verified_by": "Bob Verifier",
    "closure_date": date.today().isoformat(),
    "follow_up_requirement": "Review price trend after the next two purchase cycles.",
    "recurrence_monitoring": "Monthly price check for six months.",
}


async def high_score(client: AsyncClient, session: AsyncSession) -> dict:
    """Seed MAT-A, store a High-sensitivity weight set and score it."""
    await seed_material(session)
    await store_run(session, "MAT-A", 30, [110.0])
    saved = await client.post(
        f"{RISK}/weights", json={"config": SENSITIVE, "note": "High from 20 for the case tests"}
    )
    assert saved.status_code == 201
    run = await client.post(f"{RISK}/run", params=AS_OF_Q)
    assert run.status_code == 201, run.text
    return run.json()["data"]["scored"][0]


async def open_case(client: AsyncClient, score_id: str, **extra):
    return await client.post(MCASE, json={"score_id": score_id, **extra})


async def transition(client: AsyncClient, case_id: str, to_status: str, **fields):
    return await client.post(
        f"{CASES}/{case_id}/transition", json={"to_status": to_status, **fields}
    )


async def walk_to_pending_verification(client: AsyncClient, case_id: str) -> None:
    steps = [
        ("Assigned", {"assigned_to": "Alice Investigator", "department": "Procurement"}),
        ("Under Investigation", {"note": "Reviewing supplier price history"}),
        ("Corrective Action", {"root_cause": "Contract price list was not renegotiated."}),
        ("Pending Verification", {"corrective_action": "Fixed-price clause agreed."}),
    ]
    for status_name, fields in steps:
        res = await transition(client, case_id, status_name, **fields)
        assert res.status_code == 200, (status_name, res.text)


# ── Opening a case from a material ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_high_risk_material_opens_a_material_cost_case_with_its_context(
    async_client: AsyncClient, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    assert score["level"] == "High"
    res = await open_case(async_client, score["score_id"], note="Raised in the weekly cost review")
    assert res.status_code == 201
    data = res.json()["data"]
    case = data["case"]
    assert data["mode"] == "created" and case["case_id"].startswith("MCR-")
    assert case["case_category"] == "material_cost_risk" and case["material_id"] == "MAT-A"
    assert case["status"] == "New" and case["priority"] == "High" and case["transaction_id"] is None
    assert case["supplier_id"] == "SUP-1"  # the largest spend in the year to the score date
    assert case["forecast_horizon"] == 30
    assert case["projected_exposure_amount"] == pytest.approx(500.0)  # (110 - 100) x 50
    assert [s["rule_code"] for s in case["trigger_signals"]][0] == "MAT-PREDICTED_INCREASE"
    assert all(s["diagnostics"]["source"] == "material_risk_score" for s in case["trigger_signals"])
    snapshot = case["evaluation_snapshot"]
    assert snapshot["score_id"] == score["score_id"] and snapshot["level"] == "High"
    assert len(snapshot["factors"]) == 9 and snapshot["exposure"]["projected_exposure"] == 500.0
    first = case["history"][0]
    assert (
        first["action"] == "Case Created from Material Risk Score" and first["new_status"] == "New"
    )
    assert "Raised in the weekly cost review" in first["note"]
    # the ordinary case endpoints serve it like any other case
    same = (await async_client.get(f"{CASES}/{case['case_id']}")).json()["data"]
    assert same["case_category"] == "material_cost_risk" and same["material_id"] == "MAT-A"


@pytest.mark.asyncio
async def test_only_high_or_critical_scores_can_open_a_case(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session)
    await store_run(db_session, "MAT-A", 30, [110.0])
    moderate = (await async_client.post(f"{RISK}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    assert moderate["level"] == "Moderate"  # default bands: 30 is below High
    res = await open_case(async_client, moderate["score_id"])
    assert res.status_code == 422 and "Only High or Critical" in res.json()["message"]
    assert (await open_case(async_client, "MRS-NOPE")).status_code == 404
    count = (await db_session.execute(text("SELECT count(*) FROM risk_cases"))).scalar_one()
    assert count == 0


@pytest.mark.asyncio
async def test_an_open_case_is_linked_to_not_duplicated(
    async_client: AsyncClient, db_session: AsyncSession
):
    first = await high_score(async_client, db_session)
    case_id = (await open_case(async_client, first["score_id"])).json()["data"]["case"]["case_id"]
    again = await open_case(async_client, first["score_id"])
    assert again.status_code == 409 and "already open" in again.json()["message"]

    newer = (await async_client.post(f"{RISK}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    linked = await open_case(async_client, newer["score_id"], link_case_id=case_id, note="Rescored")
    assert linked.status_code == 200 and linked.json()["data"]["mode"] == "linked"
    case = linked.json()["data"]["case"]
    entries = case["evaluation_snapshot"]["linked_scores"]
    assert [e["score_id"] for e in entries] == [newer["score_id"]]
    assert case["history"][-1]["action"] == "Material Risk Score Linked"
    assert case["evaluation_snapshot"]["score_id"] == first["score_id"]  # the opening score stays
    twice = await open_case(async_client, newer["score_id"], link_case_id=case_id)
    assert twice.status_code == 409
    cases = (await async_client.get(f"{MCASE}/for-material/MAT-A")).json()["data"]
    assert [c["case_id"] for c in cases] == [case_id]


@pytest.mark.asyncio
async def test_a_score_cannot_be_linked_to_the_wrong_case(
    async_client: AsyncClient, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    db_session.add(
        RiskCase(case_id="CASE-FIN-1", case_number="CASE-FIN-1", priority="High", status="New")
    )
    await db_session.commit()
    wrong = await open_case(async_client, score["score_id"], link_case_id="CASE-FIN-1")
    assert wrong.status_code == 422 and "same material" in wrong.json()["message"]
    assert (
        await open_case(async_client, score["score_id"], link_case_id="CASE-NOPE")
    ).status_code == 404


@pytest.mark.asyncio
async def test_opening_and_reading_cases_follow_the_roles(
    client_as, db_session: AsyncSession, async_client
):
    score = await high_score(async_client, db_session)
    for role, expected in (
        ("read_only_reviewer", 403),
        ("verifier", 403),
        ("process_owner", 403),
    ):
        who = make_principal("USR-ADMIN-001", f"o_{role}", role, role)
        async with client_as(who) as client:
            assert (await open_case(client, score["score_id"])).status_code == expected, role
    async with client_as(investigator) as client:
        assert (await open_case(client, score["score_id"])).status_code == 201


# ── The unchanged lifecycle, end to end ──────────────────────────────────────


@pytest.mark.asyncio
async def test_a_material_case_walks_the_whole_lifecycle_with_the_existing_rules(
    async_client: AsyncClient, client_as, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    async with client_as(investigator) as client:
        case_id = (await open_case(client, score["score_id"])).json()["data"]["case"]["case_id"]

        # the transition matrix is the existing one: no skipping stages
        skip = await transition(client, case_id, "Closed", **CLOSURE)
        assert skip.status_code == 409 and skip.json()["error_code"] == "INVALID_STATE_TRANSITION"
        # the same stage preconditions as every case
        no_root = await transition(client, case_id, "Assigned")
        assert no_root.status_code == 200
        await transition(client, case_id, "Under Investigation")
        blocked = await transition(client, case_id, "Corrective Action")
        assert blocked.status_code == 422 and "Root cause" in blocked.json()["message"]
        await transition(
            client, case_id, "Corrective Action", root_cause="Price list not renegotiated."
        )
        await transition(
            client, case_id, "Pending Verification", corrective_action="Fixed-price clause."
        )

        # the investigator cannot verify or close their own case (separation of duties)
        self_close = await transition(
            client, case_id, "Closed", **{**CLOSURE, "verified_by": "Someone Else"}
        )
        assert self_close.status_code == 403  # a reviewer is not a verification role

    async with client_as(verifier) as client:
        partial = await transition(client, case_id, "Closed", root_cause="x")
        assert (
            partial.status_code == 422
            and partial.json()["error_code"] == "VERIFIED_CLOSURE_VALIDATION_ERROR"
        )
        closed = await transition(client, case_id, "Closed", **CLOSURE)
        assert closed.status_code == 200
        body = closed.json()["data"]
        assert body["status"] == "Closed" and body["case_category"] == "material_cost_risk"
        assert (
            body["closure_type"] == "Process Error / Remedied"
            and body["verified_by"] == "Bob Verifier"
        )
        assert [h["new_status"] for h in body["history"]] == [
            "New", "Assigned", "Under Investigation", "Corrective Action", "Pending Verification", "Closed",
        ]  # fmt: skip
        assert body["history"][-1]["actor"] == "Bob Verifier"  # derived from the principal

        # a closed case cannot be edited; it can be reopened like any other
        edit = await client.patch(f"{CASES}/{case_id}", json={"root_cause": "changed"})
        assert edit.status_code == 422
        reopened = await transition(client, case_id, "Reopened", note="New price rise")
        assert reopened.status_code == 200 and reopened.json()["data"]["status"] == "Reopened"


@pytest.mark.asyncio
async def test_separation_of_duties_applies_to_a_material_case(
    async_client: AsyncClient, client_as, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    admin = make_principal("USR-ADM-001", "adm_carol", "Carol Admin", "admin")
    async with client_as(admin) as client:
        case_id = (await open_case(client, score["score_id"])).json()["data"]["case"]["case_id"]
        await walk_to_pending_verification(client, case_id)
        # an administrator who investigated cannot also close it
        res = await transition(
            client, case_id, "Closed", **{**CLOSURE, "verified_by": "Dana Other"}
        )
        assert (
            res.status_code == 403 and res.json()["error_code"] == "SEPARATION_OF_DUTIES_VIOLATION"
        )
    async with client_as(verifier) as client:
        # naming the investigator as the verifier is refused as well
        named = await transition(
            client, case_id, "Closed", **{**CLOSURE, "verified_by": "Carol Admin"}
        )
        assert (
            named.status_code == 403
            and named.json()["error_code"] == "SEPARATION_OF_DUTIES_VIOLATION"
        )
        ok = await transition(client, case_id, "Closed", **CLOSURE)
        assert ok.status_code == 200
    state = await db_session.get(RiskCase, case_id)
    await db_session.refresh(state)
    assert state.status == "Closed"


def test_no_transition_logic_branches_on_the_case_category():
    """Static guard: no function in the case services, other than the two read paths that were
    extended on purpose, refers to the case category. Every transition, closure and separation
    of duties function is covered because the whole files are scanned, helpers included."""
    import ast
    from pathlib import Path

    cases = Path(__file__).resolve().parents[3] / "app" / "api" / "modules" / "v1" / "cases"
    read_paths = {"get_all_cases", "get_case_by_id"}  # list filter and recurrence lookup
    seen = set()
    for name in ("case_service.py", "case_history_service.py"):
        tree = ast.parse((cases / "service" / name).read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
                continue
            seen.add(node.name)
            if node.name in read_paths:
                continue
            for inner in ast.walk(node):
                text_used = (
                    inner.attr if isinstance(inner, ast.Attribute) else
                    inner.id if isinstance(inner, ast.Name) else
                    inner.value if isinstance(inner, ast.Constant) and isinstance(inner.value, str) else ""
                )  # fmt: skip
                assert "case_category" not in text_used and "material_cost_risk" not in text_used, (
                    f"{name}:{node.name} refers to the case category"
                )
    # the guard is not trivially empty: the state machine and the separation of duties were scanned
    assert {"transition_case", "update_case", "enforce_separation_of_duties"} <= seen


# ── History, Historical Replay and Recurrence ────────────────────────────────


@pytest.mark.asyncio
async def test_historical_replay_shows_what_was_known_and_reproduces_the_score(
    async_client: AsyncClient, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    case = (await open_case(async_client, score["score_id"])).json()["data"]["case"]
    before = (await db_session.get(RiskCase, case["case_id"])).evaluation_snapshot
    context = (await async_client.get(f"{MCASE}/{case['case_id']}/context")).json()["data"]
    assert context["material"]["description"] == "MAT-A part"
    assert context["opened_from"]["score_id"] == score["score_id"]
    assert context["opened_from"]["level"] == "High" and len(context["opened_from"]["factors"]) == 9
    assert (
        context["forecast"]["horizon_days"] == 30
        and context["exposure"]["projected_exposure"] == 500.0
    )
    assert context["replay"]["reproduced"] is True
    assert context["replay"]["recomputed_score"] == pytest.approx(
        context["replay"]["stored_score"], abs=1e-3
    )
    assert context["current"] is None  # nothing newer yet

    # a later score changes "current" but never the picture the case was opened with
    newer = await async_client.post(f"{RISK}/run", params=AS_OF_Q)
    assert newer.status_code == 201
    after_ctx = (await async_client.get(f"{MCASE}/{case['case_id']}/context")).json()["data"]
    assert (
        after_ctx["current"]["score_id"] != score["score_id"]
        and after_ctx["current"]["change"] == 0
    )
    assert after_ctx["opened_from"] == context["opened_from"]
    await db_session.rollback()
    after = (await db_session.get(RiskCase, case["case_id"])).evaluation_snapshot
    assert after == before


@pytest.mark.asyncio
async def test_context_is_only_for_material_cases(
    async_client: AsyncClient, db_session: AsyncSession
):
    db_session.add(
        RiskCase(case_id="CASE-FIN-2", case_number="CASE-FIN-2", priority="High", status="New")
    )
    await db_session.commit()
    assert (await async_client.get(f"{MCASE}/CASE-FIN-2/context")).status_code == 404
    assert (await async_client.get(f"{MCASE}/CASE-NOPE/context")).status_code == 404
    existing = (await async_client.get(f"{CASES}/CASE-FIN-2")).json()["data"]
    assert existing["case_category"] == "financial_exception" and existing["material_id"] is None


@pytest.mark.asyncio
async def test_recurrence_finds_earlier_cases_for_the_same_material(
    async_client: AsyncClient, client_as, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    async with client_as(investigator) as client:
        first = (await open_case(client, score["score_id"])).json()["data"]["case"]["case_id"]
        await walk_to_pending_verification(client, first)
    async with client_as(verifier) as client:
        assert (await transition(client, first, "Closed", **CLOSURE)).status_code == 200
    second_score = (await async_client.post(f"{RISK}/run", params=AS_OF_Q)).json()["data"][
        "scored"
    ][0]
    second = (await open_case(async_client, second_score["score_id"])).json()["data"]["case"]
    prior = second["prior_cases"]
    assert [p["case_id"] for p in prior] == [first] and prior[0]["status"] == "Closed"
    assert prior[0]["case_category"] == "material_cost_risk" and prior[0]["material_id"] == "MAT-A"


@pytest.mark.asyncio
async def test_cases_without_a_supplier_do_not_list_each_other_as_recurrence(
    async_client: AsyncClient, db_session: AsyncSession
):
    for n in (1, 2):
        db_session.add(
            RiskCase(
                case_id=f"CASE-NS-{n}", case_number=f"CASE-NS-{n}", priority="Low", status="New"
            )
        )
    await db_session.commit()
    detail = (await async_client.get(f"{CASES}/CASE-NS-1")).json()["data"]
    assert detail["prior_cases"] == []  # a missing supplier is not a shared supplier


@pytest.mark.asyncio
async def test_the_case_list_can_be_filtered_by_category_and_material(
    async_client: AsyncClient, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    await open_case(async_client, score["score_id"])
    db_session.add(
        RiskCase(case_id="CASE-FIN-3", case_number="CASE-FIN-3", priority="High", status="New")
    )
    await db_session.commit()
    both = (await async_client.get(CASES)).json()["data"]
    assert {c["case_category"] for c in both} == {"material_cost_risk", "financial_exception"}
    only = (await async_client.get(CASES, params={"case_category": "material_cost_risk"})).json()[
        "data"
    ]
    assert [c["material_id"] for c in only] == ["MAT-A"]
    by_material = (await async_client.get(CASES, params={"material_id": "MAT-A"})).json()["data"]
    assert len(by_material) == 1


# ── QA follow-up: races, stale scores, recurrence scope ──────────────────────


@pytest.mark.asyncio
async def test_two_simultaneous_requests_open_only_one_case(
    async_client: AsyncClient, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    user = SimpleNamespace(user_id="USR-INV-001", username="inv_alice", name="Alice Investigator")

    async def attempt():
        async with harness.test_session_factory() as session:
            try:
                return await material_cases.open_case(session, user, score["score_id"])
            except AlreadyExistsError as exc:
                return exc

    results = await asyncio.gather(attempt(), attempt(), attempt())
    assert sum(isinstance(r, dict) for r in results) == 1
    assert sum(isinstance(r, AlreadyExistsError) for r in results) == 2
    count = (await db_session.execute(text("SELECT count(*) FROM risk_cases"))).scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_a_case_can_only_be_opened_from_the_latest_score(
    async_client: AsyncClient, db_session: AsyncSession
):
    older = await high_score(async_client, db_session)
    calmer = {**SENSITIVE, "bands": {"moderate": 50, "high": 80, "critical": 90}}
    saved = await async_client.post(
        f"{RISK}/weights", json={"config": calmer, "note": "Calmer bands"}
    )
    assert saved.status_code == 201
    newest = (await async_client.post(f"{RISK}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    assert newest["level"] == "Low" and older["level"] == "High"
    res = await open_case(async_client, older["score_id"])  # the High score is out of date
    assert res.status_code == 422
    assert (
        "newer risk score" in res.json()["message"] and newest["score_id"] in res.json()["message"]
    )
    count = (await db_session.execute(text("SELECT count(*) FROM risk_cases"))).scalar_one()
    assert count == 0


@pytest.mark.asyncio
async def test_recurrence_stays_within_the_same_kind_of_case(
    async_client: AsyncClient, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    case = (await open_case(async_client, score["score_id"])).json()["data"]["case"]
    assert case["supplier_id"] == "SUP-1"
    db_session.add(
        RiskCase(
            case_id="CASE-FIN-9", case_number="CASE-FIN-9", priority="High", status="Closed",
            supplier_id="SUP-1", root_cause="Duplicate invoice",
        )
    )  # fmt: skip
    await db_session.commit()
    financial = (await async_client.get(f"{CASES}/CASE-FIN-9")).json()["data"]
    assert financial["prior_cases"] == []  # the material case does not appear on a financial case
    material = (await async_client.get(f"{CASES}/{case['case_id']}")).json()["data"]
    assert material["prior_cases"] == []  # nor the financial case on the material case


@pytest.mark.asyncio
async def test_case_numbers_use_the_full_unique_suffix(
    async_client: AsyncClient, db_session: AsyncSession
):
    score = await high_score(async_client, db_session)
    case = (await open_case(async_client, score["score_id"])).json()["data"]["case"]
    assert case["case_number"] == f"MCR-{date.today().year}-{case['case_id'].removeprefix('MCR-')}"
