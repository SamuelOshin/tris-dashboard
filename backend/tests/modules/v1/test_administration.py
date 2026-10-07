"""
Administration (work plan Section 10): model settings, dataset registry and the audit trail.

Covers: administrators only; a model can be switched off without losing history and the forecasts
and validations honour it; every configuration and analysis action writes an audit entry (actor from
the signed-in user) in the same transaction; the audit log and the model history are insert-only.
"""

import json

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.db.triggers import ADMINISTRATION_IMMUTABILITY_SQL
from tests.conftest import make_principal
from tests.modules.v1.exposure_seed import FORECASTS
from tests.modules.v1.validation_seed import VALIDATION, flat_then_spike, seed_series, trending

pytestmark = pytest.mark.db

ADMIN = "/api/v1/manufacturing/admin"
MAPPING = "/api/v1/manufacturing/mapping"
RISK = "/api/v1/manufacturing/risk-scoring"
REGRESSION = "lagged_regression"


async def events(client: AsyncClient, **params) -> list[dict]:
    res = await client.get(f"{ADMIN}/audit-events", params={"limit": 200, **params})
    assert res.status_code == 200, res.text
    return res.json()["data"]["items"]


async def seed(session: AsyncSession) -> None:
    await seed_series(session, "AD-TREND", trending(30))
    await seed_series(session, "AD-SPIKE", flat_then_spike(30), supplier="SUP-V2")


async def import_materials(client: AsyncClient, dataset: str | None, material: str) -> dict:
    csv = f"material_id,description,unit_of_measure\n{material},{material} part,kg\n"
    config = {
        "target": "materials",
        "field_mapping": {
            "material_id": "material_id",
            "description": "description",
            "unit_of_measure": "unit_of_measure",
        },
        "dataset_id": dataset,
    }
    res = await client.post(
        f"{MAPPING}/import",
        files={"file": ("m.csv", csv.encode(), "text/csv")},
        data={"config": json.dumps(config)},
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]


# ── Who may use it ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_only_administrators_may_use_the_administration_endpoints(client_as):
    paths = [
        ("get", f"{ADMIN}/configuration", None),
        ("get", f"{ADMIN}/datasets", None),
        ("get", f"{ADMIN}/audit-events", None),
        ("put", f"{ADMIN}/models/{REGRESSION}", {"enabled": False}),
        ("put", f"{ADMIN}/datasets/x/label", {"label": "synthetic"}),
    ]
    for role in ("reviewer", "read_only_reviewer", "verifier", "process_owner"):
        person = make_principal(f"USR-AD-{role}", f"ad_{role}", f"Ad {role}", role)
        async with client_as(person) as client:
            for method, path, body in paths:
                res = await client.request(method.upper(), path, json=body)
                assert res.status_code == 403, (role, path, res.status_code)


# ── Forecast models can be switched off without losing anything ─────────────────────────────────


@pytest.mark.asyncio
async def test_a_model_can_be_switched_off_and_on_and_every_change_is_kept(
    async_client: AsyncClient, db_session: AsyncSession
):
    models = (await async_client.get(f"{ADMIN}/configuration")).json()["data"]["forecast_models"]
    kinds = {m["code"]: m["kind"] for m in models}
    assert "baseline" in kinds.values() and REGRESSION in kinds
    baseline = next(c for c, k in kinds.items() if k == "baseline")
    refused = await async_client.put(f"{ADMIN}/models/{baseline}", json={"enabled": False})
    assert refused.status_code == 422  # a baseline must stay available

    assert (
        await async_client.put(f"{ADMIN}/models/nope", json={"enabled": False})
    ).status_code == 404
    off = await async_client.put(
        f"{ADMIN}/models/{REGRESSION}", json={"enabled": False, "note": "Under review"}
    )
    assert off.status_code == 200
    state = {m["code"]: m for m in off.json()["data"]["models"]}
    assert (
        state[REGRESSION]["enabled"] is False and state[REGRESSION]["last_note"] == "Under review"
    )

    again = await async_client.put(f"{ADMIN}/models/{REGRESSION}", json={"enabled": False})
    assert again.status_code == 200  # same state: no new history row
    await async_client.put(f"{ADMIN}/models/{REGRESSION}", json={"enabled": True})
    rows = (
        await db_session.execute(
            text("SELECT enabled FROM forecast_model_settings WHERE model_code = :c ORDER BY id"),
            {"c": REGRESSION},
        )
    ).all()
    assert [r[0] for r in rows] == [False, True]  # both changes kept, the repeat was not added
    changed = [e for e in await events(async_client) if e["event_type"] == "MODEL_SETTING_CHANGED"]
    assert len(changed) == 2 and all(e["actor"] for e in changed)


@pytest.mark.asyncio
async def test_forecasts_and_validations_honour_a_switched_off_model(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed(db_session)
    before = await async_client.post(f"{FORECASTS}/materials/AD-TREND/run")
    assert before.status_code == 201
    names = {c["code"] for h in before.json()["data"]["horizons"] for c in h["run"]["candidates"]}
    assert REGRESSION in names

    await async_client.put(f"{ADMIN}/models/{REGRESSION}", json={"enabled": False})
    after = await async_client.post(f"{FORECASTS}/materials/AD-TREND/run")
    runs = [h["run"] for h in after.json()["data"]["horizons"] if h["run"]]
    assert runs
    for run in runs:
        assert REGRESSION not in {c["code"] for c in run["candidates"]}
        assert run["model"]["code"] != REGRESSION
        assert run["config"]["disabled_models"] == [REGRESSION]
    # the earlier run is untouched: both runs are stored
    stored = (await db_session.execute(text("SELECT count(*) FROM forecast_runs"))).scalar_one()
    assert stored >= 4

    res = await async_client.post(f"{VALIDATION}/runs", json={"horizons_days": [30]})
    assert res.status_code == 201
    run = res.json()["data"]
    assert run["config"]["forecast_models_off"] == [REGRESSION]
    cases = await async_client.get(
        f"{VALIDATION}/runs/{run['run_id']}/cases", params={"kind": "evaluated", "limit": 500}
    )
    assert "Lagged price regression" not in {i["model"] for i in cases.json()["data"]["items"]}


# ── Dataset registry ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_dataset_is_registered_by_its_first_import_and_labelled_by_an_administrator(
    async_client: AsyncClient, db_session: AsyncSession
):
    await import_materials(async_client, "Plant A", "AD-M1")
    await import_materials(async_client, "Plant A", "AD-M2")  # second import: not registered twice
    listed = (await async_client.get(f"{ADMIN}/datasets")).json()["data"]["datasets"]
    plant = next(d for d in listed if d["dataset_id"] == "Plant A")
    assert plant["registered"] and plant["label"] == "unlabelled" and plant["registered_by"]
    registered = [e for e in await events(async_client) if e["event_type"] == "DATASET_REGISTERED"]
    assert len(registered) == 1

    bad = await async_client.put(f"{ADMIN}/datasets/Plant A/label", json={"label": "real"})
    assert bad.status_code == 422
    assert (
        await async_client.put(f"{ADMIN}/datasets/Nowhere/label", json={"label": "synthetic"})
    ).status_code == 404
    ok = await async_client.put(f"{ADMIN}/datasets/Plant A/label", json={"label": "synthetic"})
    labelled = next(d for d in ok.json()["data"]["datasets"] if d["dataset_id"] == "Plant A")
    assert labelled["label"] == "synthetic" and labelled["label_set_by"]
    changed = [e for e in await events(async_client) if e["event_type"] == "DATASET_LABEL_CHANGED"]
    assert "from unlabelled to synthetic" in changed[0]["detail"]


# ── Audit trail ─────────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_every_action_writes_an_audit_entry_with_the_signed_in_actor(
    async_client: AsyncClient, client_as, db_session: AsyncSession
):
    await seed(db_session)
    reviewer = make_principal("USR-AD-REV", "ad_reviewer", "Ad Reviewer", "reviewer")
    reviewer.hashed_password = "not-a-real-hash"  # imports record who uploaded: user must exist
    db_session.add(reviewer)
    await db_session.commit()
    async with client_as(reviewer) as client:
        await import_materials(client, None, "AD-M9")
        assert (await client.post(f"{FORECASTS}/materials/AD-TREND/run")).status_code == 201
        assert (await client.post(f"{RISK}/run")).status_code == 201
        assert (
            await client.post(f"{VALIDATION}/runs", json={"horizons_days": [30]})
        ).status_code == 201
        assert (await client.get(f"{ADMIN}/audit-events")).status_code == 403  # not for reviewers

    weights = (await async_client.get(f"{RISK}/weights")).json()["data"]
    config = weights["versions"][0]["config"]
    saved = await async_client.post(
        f"{RISK}/weights", json={"config": config, "note": "Same weights, new version"}
    )
    assert saved.status_code == 201
    profile = await async_client.post(
        f"{MAPPING}/profiles",
        json={
            "name": "Audit demo",
            "target": "materials",
            "field_mapping": {
                "material_id": "a",
                "description": "b",
                "unit_of_measure": "c",
            },
        },
    )
    assert profile.status_code == 201
    pid = profile.json()["data"]["profile_id"]
    assert (await async_client.delete(f"{MAPPING}/profiles/{pid}")).status_code == 200

    log = await events(async_client)
    by_type = {}
    for entry in log:
        by_type.setdefault(entry["event_type"], []).append(entry)
    expected = {
        "DATA_IMPORT",
        "FORECAST_RUN",
        "RISK_SCORING_RUN",
        "VALIDATION_RUN",
        "RISK_WEIGHTS_CREATED",
        "MAPPING_PROFILE_SAVED",
        "MAPPING_PROFILE_DELETED",
    }
    assert expected <= set(by_type), expected - set(by_type)
    for kind in ("DATA_IMPORT", "FORECAST_RUN", "RISK_SCORING_RUN", "VALIDATION_RUN"):
        assert by_type[kind][0]["actor"] == "ad_reviewer"  # from the signed-in user
        assert by_type[kind][0]["actor_role"].lower() == "reviewer"
    assert by_type["RISK_WEIGHTS_CREATED"][0]["resource_id"] == "2"
    assert "Same weights, new version" in by_type["RISK_WEIGHTS_CREATED"][0]["detail"]
    assert "Audit demo" in by_type["MAPPING_PROFILE_SAVED"][0]["detail"]


@pytest.mark.asyncio
async def test_a_failed_action_leaves_no_audit_entry(async_client: AsyncClient):
    bad = await async_client.post(
        f"{MAPPING}/profiles",
        json={"name": "Bad", "target": "not_a_table", "field_mapping": {}},
    )
    assert bad.status_code in (404, 422)
    assert [
        e for e in await events(async_client) if e["event_type"] == "MAPPING_PROFILE_SAVED"
    ] == []
    ghost = await async_client.put(f"{ADMIN}/models/ghost", json={"enabled": False})
    assert ghost.status_code == 404
    assert [
        e for e in await events(async_client) if e["event_type"] == "MODEL_SETTING_CHANGED"
    ] == []


@pytest.mark.asyncio
async def test_the_audit_log_can_be_filtered_and_paged(async_client: AsyncClient):
    listed = (await async_client.get(f"{ADMIN}/configuration")).json()["data"]["forecast_models"]
    other = next(m["code"] for m in listed if m["kind"] == "regression" and m["code"] != REGRESSION)
    for code, flag in ((REGRESSION, False), (REGRESSION, True), (other, False)):
        await async_client.put(f"{ADMIN}/models/{code}", json={"enabled": flag})
    everything = (await async_client.get(f"{ADMIN}/audit-events")).json()["data"]
    assert everything["total"] >= 3
    assert any(t["code"] == "MODEL_SETTING_CHANGED" for t in everything["event_types"])
    only = await events(async_client, event_type="MODEL_SETTING_CHANGED")
    assert len(only) == 3 and {e["event"] for e in only} == {"Forecast model setting changed"}
    assert only[0]["id"] > only[-1]["id"]  # newest first
    assert only[0]["occurred_at"].endswith("+00:00")  # a zone is stated, so screens convert it
    page = (
        await async_client.get(
            f"{ADMIN}/audit-events",
            params={"limit": 1, "offset": 1, "event_type": "MODEL_SETTING_CHANGED"},
        )
    ).json()["data"]
    assert (
        page["total"] == 3 and len(page["items"]) == 1 and page["items"][0]["id"] == only[1]["id"]
    )
    assert await events(async_client, actor="nobody-by-this-name") == []
    name = only[0]["actor"]
    assert len(await events(async_client, actor=name.upper()[:4])) >= 3  # case-insensitive, partial
    assert await events(async_client, since="2999-01-01") == []
    assert (await async_client.get(f"{ADMIN}/audit-events", params={"limit": 0})).status_code == 422


@pytest.mark.asyncio
async def test_the_audit_log_and_the_model_history_cannot_be_changed(
    async_client: AsyncClient, db_session: AsyncSession
):
    await db_session.execute(text(ADMINISTRATION_IMMUTABILITY_SQL))  # as the migration does
    await db_session.commit()
    await async_client.put(f"{ADMIN}/models/{REGRESSION}", json={"enabled": False})
    for statement in (
        "UPDATE security_audit_log SET detail = 'edited'",
        "DELETE FROM security_audit_log",
        "UPDATE forecast_model_settings SET enabled = true",
        "DELETE FROM forecast_model_settings",
    ):
        with pytest.raises(DBAPIError, match="immutable"):
            await db_session.execute(text(statement))
        await db_session.rollback()
    assert len(await events(async_client, event_type="MODEL_SETTING_CHANGED")) == 1
