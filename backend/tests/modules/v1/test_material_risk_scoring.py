# ruff: noqa: E501
"""
Ticket 9 — Material risk score and explainability (decision D4).

Hand-checked arithmetic on the pure engine and factor functions, then the stored, versioned,
immutable scores through the API, and proof that the scoring service is decoupled from the
R-001..R-007 rule engine (static imports, schema, and run-time state).

Fixed data for the API tests: MAT-A is bought every month at 100 (SUP-1 60%, SUP-2 40%), the stored
30-day forecast is 110. That gives price change 0, volatility 0, predicted increase 10%, demand 0%
and supplier concentration 60%; the other factors have no data. Evaluable weight is 60 of 100.
"""

import ast
import asyncio
import hashlib
import json
import math
from datetime import date
from pathlib import Path
from statistics import pstdev
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

import tests.conftest as harness
from app.api.core.custom_exceptions.exceptions import ValidationError
from app.api.modules.v1.manufacturing.models import Material, MaterialRiskScore, PurchaseRecord
from app.api.modules.v1.manufacturing.service import risk_factors as factors
from app.api.modules.v1.manufacturing.service import risk_scoring_engine as engine
from app.api.modules.v1.manufacturing.service import risk_scoring_service as scoring
from app.api.modules.v1.manufacturing.service.analytics_types import BomRow, MonthPoint
from app.api.modules.v1.manufacturing.service.risk_types import (
    DEFAULT_CONFIG,
    FACTOR_CODES,
    ForecastRef,
    Reading,
)
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from tests.conftest import make_principal
from tests.modules.v1.exposure_seed import AS_OF, AS_OF_Q, seed_material, store_run

BASE = "/api/v1/manufacturing/risk-scoring"
CFG = DEFAULT_CONFIG
APP = Path(__file__).resolve().parents[3] / "app" / "api" / "modules" / "v1"


def readings(**raw) -> dict[str, Reading]:
    """Every factor, with the given raw values (others missing)."""
    return {
        c: Reading(raw.get(c), "detail." if raw.get(c) is not None else "No data.")
        for c in FACTOR_CODES
    }


# ── Scoring arithmetic ───────────────────────────────────────────────────────

MIDPOINTS = {  # the middle of each default scale: every sub-score is exactly 0.5
    "price_change": 7.5,
    "volatility": 4.5,
    "predicted_increase": 5.0,
    "bom_exposure": 22.5,
    "demand": 15.0,
    "supplier_concentration": 75.0,
    "inventory_coverage": 37.5,
    "lead_time": 52.0,
    "standard_cost_deviation": 7.5,
}


def test_default_weights_add_up_to_100_and_the_defaults_are_valid():
    assert sum(CFG["weights"].values()) == 100 and set(CFG["weights"]) == set(FACTOR_CODES)
    engine.validate_config(CFG)


def test_score_is_the_weighted_sum_of_sub_scores_on_a_0_to_100_scale():
    result = engine.score_material(readings(**MIDPOINTS), CFG)
    assert result["status"] == "scored" and result["score"] == pytest.approx(50.0)
    assert result["level"] == "High" and result["data_coverage_pct"] == 100.0
    assert sum(f["points"] for f in result["factors"]) == pytest.approx(result["score"])
    by_code = {f["code"]: f for f in result["factors"]}
    assert by_code["price_change"]["points"] == pytest.approx(7.5)  # 15 weight * 0.5
    assert by_code["demand"]["points"] == pytest.approx(2.5)  # 5 weight * 0.5


def test_each_factor_scale_runs_from_0_to_1_including_the_reversed_ones():
    zero = {c: CFG["ramps"][c][0] for c in FACTOR_CODES}
    one = {c: CFG["ramps"][c][1] for c in FACTOR_CODES}
    assert engine.score_material(readings(**zero), CFG)["score"] == pytest.approx(0.0)
    assert engine.score_material(readings(**zero), CFG)["level"] == "Low"
    top = engine.score_material(readings(**one), CFG)
    assert top["score"] == pytest.approx(100.0) and top["level"] == "Critical"
    # beyond the scale is held at the end, and low stock coverage is the risky direction
    beyond = engine.score_material(
        readings(**{**one, "inventory_coverage": 1.0, "lead_time": 999}), CFG
    )
    assert beyond["score"] == pytest.approx(100.0)
    assert engine.sub_score(60, 60, 15) == 0 and engine.sub_score(15, 60, 15) == 1
    assert engine.sub_score(-50, 0, 15) == 0


def test_risk_levels_follow_the_configured_bands():
    bands = CFG["bands"]
    assert [engine.level_for(s, bands) for s in (0, 24.99, 25, 49.99, 50, 74.99, 75, 100)] == [
        "Low", "Low", "Moderate", "Moderate", "High", "High", "Critical", "Critical",
    ]  # fmt: skip


def test_a_missing_factor_is_left_out_and_never_lowers_or_raises_the_score():
    full = {c: CFG["ramps"][c][1] for c in FACTOR_CODES}  # every factor at its maximum
    partial = {k: v for k, v in full.items() if k not in ("supplier_concentration", "lead_time")}
    result = engine.score_material(readings(**partial), CFG)
    assert result["score"] == pytest.approx(100.0)  # 75 of 100 weight, all at maximum
    assert result["data_coverage_pct"] == pytest.approx(75.0)
    skipped = [f for f in result["factors"] if f["status"] == "not_evaluable"]
    assert {f["code"] for f in skipped} == {"supplier_concentration", "lead_time"}
    assert all(f["explanation"].startswith("Not used:") and f["points"] == 0 for f in skipped)
    # the remaining weights are rescaled, so the effective shares still add up to 100
    assert sum(f["effective_weight_pct"] for f in result["factors"]) == pytest.approx(100.0)


def test_too_little_data_gives_no_score_never_a_default():
    sparse = readings(
        price_change=10.0, volatility=3.0
    )  # 25 of 100 weight, below the minimum of 50
    result = engine.score_material(sparse, CFG)
    assert result["status"] == "insufficient_data" and result["score"] is None
    assert result["level"] is None and "No score" in result["summary"]
    assert engine.score_material(readings(), CFG)["score"] is None


def test_every_evaluated_factor_has_a_plain_language_explanation_with_its_numbers():
    result = engine.score_material(readings(**MIDPOINTS), CFG)
    for f in result["factors"]:
        assert f["status"] == "evaluated" and f["explanation"].startswith("detail.")
        assert "scores 0" in f["explanation"] and "scores 1" in f["explanation"]
        assert (
            f"{f['sub_score']:.2f}" in f["explanation"]
            and f"{f['points']:.1f} points" in f["explanation"]
        )
    assert "Score 50.0 of 100 (High)" in result["summary"] and "Main drivers" in result["summary"]


def test_weight_sets_are_validated_before_they_are_stored():
    def bad(**change):
        cfg = {**CFG, **change}
        with pytest.raises(ValidationError):
            engine.validate_config(cfg)

    bad(weights={**CFG["weights"], "demand": 6})  # adds up to 101
    bad(weights={k: v for k, v in CFG["weights"].items() if k != "demand"})
    bad(weights={**CFG["weights"], "demand": -5, "lead_time": 20})
    bad(ramps={**CFG["ramps"], "demand": [10, 10]})
    bad(bands={"moderate": 60, "high": 50, "critical": 75})
    bad(bands={"moderate": 25, "high": 50, "critical": 101})
    bad(min_evaluable_weight=120)


# ── The nine factors, from raw data ──────────────────────────────────────────


def points(prices, quantities=None):
    quantities = quantities or [100.0] * len(prices)
    return [
        MonthPoint(date(2025 + i // 12, i % 12 + 1, 1), float(p), float(q))
        for i, (p, q) in enumerate(zip(prices, quantities, strict=True))
    ]


def test_volatility_is_the_spread_of_month_to_month_changes():
    prices = [100, 104, 99, 103, 108, 101, 107, 110]
    changes = [(b / a - 1) * 100 for a, b in zip(prices, prices[1:], strict=False)]
    reading = factors.volatility(points(prices))
    assert reading.raw == pytest.approx(pstdev(changes)) and "typical" in reading.detail
    assert factors.volatility(points(prices[:5])).raw is None  # 4 changes: not enough
    assert factors.volatility(points([100] * 8)).raw == 0


def test_demand_trend_compares_the_latest_three_months_with_the_three_before():
    reading = factors.demand_trend(points([10] * 6, [100, 100, 100, 130, 130, 130]))
    assert reading.raw == pytest.approx(30.0) and "up" in reading.detail
    assert factors.demand_trend(points([10] * 5)).raw is None
    assert factors.demand_trend(points([10] * 6, [0, 0, 0, 5, 5, 5])).raw is None  # no earlier base


def bom(sku, material, qty):
    return BomRow(sku, None, material, qty, "kg", None, None)


def test_bom_exposure_is_the_largest_share_in_any_product_that_can_be_costed():
    lines = [
        bom("P", "A", 2),
        bom("P", "B", 1),
        bom("Q", "A", 1),
        bom("Q", "C", 9),
        bom("R", "A", 5),
        bom("R", "Z", 1),
    ]
    price = {"A": 10.0, "B": 30.0, "C": 10.0, "Z": None}
    cur = {"A": "USD", "B": "USD", "C": "USD", "Z": "USD"}
    reading = factors.bom_exposure("A", lines, price, cur, AS_OF)
    # P: 20 / 50 = 40%; Q: 10 / 100 = 10%; R cannot be costed (Z has no price)
    assert reading.raw == pytest.approx(40.0) and "40%" in reading.detail and "P" in reading.detail
    assert factors.bom_exposure("B", [bom("P", "A", 1)], price, cur, AS_OF).raw is None
    mixed = factors.bom_exposure("A", lines[:2], price, {**cur, "B": "EUR"}, AS_OF)
    assert mixed.raw is None  # mixed currencies cannot be added up
    expired = [BomRow("P", None, "A", 1, "kg", None, date(2020, 1, 1))]
    assert factors.bom_exposure("A", expired, price, cur, AS_OF).raw is None


def test_metric_based_factors_report_missing_data_instead_of_guessing():
    empty: dict = {}
    for read in (
        factors.price_change, factors.supplier_concentration, factors.inventory_coverage,
        factors.lead_time, factors.standard_cost_deviation,
    ):  # fmt: skip
        assert read(empty).raw is None
    assert factors.predicted_increase(None).raw is None
    forecast = factors.predicted_increase(ForecastRef("F1", 90, 4.2))
    assert forecast.raw == 4.2 and "90-day" in forecast.detail
    assert factors.inventory_coverage({"coverage_days": 12.4}).raw == 12.4


# ── Stored scores through the API ────────────────────────────────────────────


async def seed_scorable(session: AsyncSession) -> None:
    await seed_material(session)
    await store_run(session, "MAT-A", 30, [110.0])


@pytest.mark.asyncio
async def test_a_run_scores_the_material_and_stores_every_factor(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_scorable(db_session)
    res = await async_client.post(f"{BASE}/run", params=AS_OF_Q)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["weight_version"] == 1 and data["not_scored"] == []
    scored = data["scored"][0]
    # (15*0 + 10*0 + 15*1 + 5*0 + 15*0.2) / 60 * 100 = 30
    assert scored["score"] == pytest.approx(30.0) and scored["level"] == "Moderate"
    assert scored["data_coverage_pct"] == pytest.approx(60.0)

    stored = await db_session.get(MaterialRiskScore, scored["score_id"])
    assert stored.created_by == "USR-TEST-001" and stored.method_version == "1.0"
    assert stored.config["weights"] == CFG["weights"]  # the weights it was made with
    assert stored.forecast_run_id.startswith("FRC-MAT-A-") and stored.inputs_version.startswith(
        "sha256:"
    )
    by_code = {f["code"]: f for f in stored.factors}
    assert by_code["predicted_increase"]["points"] == pytest.approx(25.0)
    assert by_code["supplier_concentration"]["value"] == pytest.approx(60.0)
    assert by_code["lead_time"]["status"] == "not_evaluable"
    assert "No supplier lead time is on record" in by_code["lead_time"]["explanation"]
    assert sum(f["points"] for f in stored.factors) == pytest.approx(stored.score)


@pytest.mark.asyncio
async def test_material_detail_returns_the_factor_by_factor_explanation(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_scorable(db_session)
    await async_client.post(f"{BASE}/run", params=AS_OF_Q)
    res = await async_client.get(f"{BASE}/materials/MAT-A", params=AS_OF_Q)
    data = res.json()["data"]
    current = data["current"]
    assert len(current["factors"]) == 9 and current["summary"].startswith("Score 30.0 of 100")
    assert all(f["explanation"] for f in current["factors"])
    assert [h["score_id"] for h in data["history"]] == [current["score_id"]]
    listing = (await async_client.get(f"{BASE}/scores", params=AS_OF_Q)).json()["data"]
    assert [s["material_id"] for s in listing["scores"]] == ["MAT-A"]
    assert "factors" not in listing["scores"][0]  # the list is summary only
    one = (await async_client.get(f"{BASE}/scores/{current['score_id']}")).json()["data"]
    assert one["factors"] == current["factors"]
    assert (await async_client.get(f"{BASE}/scores/MRS-NOPE")).status_code == 404


@pytest.mark.asyncio
async def test_not_enough_data_is_reported_and_nothing_is_stored(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_material(db_session, "MAT-S", months=3)  # no forecast, 3 months of history
    res = await async_client.post(f"{BASE}/run", params=AS_OF_Q)
    data = res.json()["data"]
    assert data["scored"] == [] and data["not_scored"][0]["material_id"] == "MAT-S"
    assert "No score" in data["not_scored"][0]["reason"]
    assert (await async_client.get(f"{BASE}/scores", params=AS_OF_Q)).json()["data"]["scores"] == []
    count = (
        await db_session.execute(text("SELECT count(*) FROM material_risk_scores"))
    ).scalar_one()
    assert count == 0


@pytest.mark.asyncio
async def test_data_after_the_as_of_date_cannot_change_a_score(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_scorable(db_session)
    first = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    db_session.add(
        PurchaseRecord(
            material_id="MAT-A",
            supplier_id="SUP-1",
            purchase_date=date(2026, 5, 20),
            quantity=99999,
            unit_price=900,
        )
    )
    await db_session.commit()
    second = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    assert second["score"] == first["score"] and second["inputs_version"] == first["inputs_version"]
    assert second["score_id"] != first["score_id"]  # a new record, not an overwrite


# ── Configurable, versioned weights ──────────────────────────────────────────

V2 = {
    "weights": {**CFG["weights"], "price_change": 5, "predicted_increase": 25},
    "ramps": CFG["ramps"],
    "bands": CFG["bands"],
    "min_evaluable_weight": CFG["min_evaluable_weight"],
}


@pytest.mark.asyncio
async def test_new_weights_make_a_new_version_and_old_scores_keep_their_own(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_scorable(db_session)
    first = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    before = (await async_client.get(f"{BASE}/scores/{first['score_id']}")).json()["data"]

    saved = await async_client.post(
        f"{BASE}/weights", json={"config": V2, "note": "Weight forecasts more"}
    )
    assert saved.status_code == 201 and saved.json()["data"]["version"] == 2
    second = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    # (5*0 + 10*0 + 25*1 + 5*0 + 15*0.2) / 60 * 100 = 46.67
    assert second["weight_version"] == 2 and second["score"] == pytest.approx(46.6667, abs=1e-3)

    after = (await async_client.get(f"{BASE}/scores/{first['score_id']}")).json()["data"]
    assert (
        after == before and after["weight_version"] == 1 and after["score"] == pytest.approx(30.0)
    )
    sets = (await async_client.get(f"{BASE}/weights")).json()["data"]
    assert sets["active_version"] == 2 and [v["version"] for v in sets["versions"]] == [2, 1]
    assert sets["versions"][1]["config"]["weights"] == CFG["weights"]  # version 1 is unchanged
    history = (await async_client.get(f"{BASE}/materials/MAT-A", params=AS_OF_Q)).json()["data"][
        "history"
    ]
    assert [h["weight_version"] for h in history] == [2, 1]


@pytest.mark.asyncio
async def test_a_stored_score_can_be_reproduced_from_its_own_record(
    async_client: AsyncClient, db_session: AsyncSession
):
    """The stored factor values and weights are enough to recompute the stored score exactly."""
    await seed_scorable(db_session)
    scored = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    record = (await async_client.get(f"{BASE}/scores/{scored['score_id']}")).json()["data"]
    again = engine.score_material(
        {f["code"]: Reading(f["value"], "") for f in record["factors"]}, record["config"]
    )
    assert again["score"] == pytest.approx(record["score"], abs=1e-3)
    assert again["level"] == record["level"]


@pytest.mark.asyncio
async def test_invalid_weights_are_rejected_and_only_admins_can_change_them(
    async_client: AsyncClient, client_as, db_session: AsyncSession
):
    bad_sum = {**V2, "weights": {**V2["weights"], "demand": 50}}
    res = await async_client.post(f"{BASE}/weights", json={"config": bad_sum, "note": "Too heavy"})
    assert res.status_code == 422 and "add up to 100" in res.json()["message"]
    unknown = {**V2, "extra": 1}
    assert (
        await async_client.post(f"{BASE}/weights", json={"config": unknown, "note": "x" * 6})
    ).status_code == 422
    assert (
        await async_client.post(f"{BASE}/weights", json={"config": V2, "note": "ok"})
    ).status_code == 422
    assert (await async_client.get(f"{BASE}/weights")).json()["data"]["active_version"] == 1
    reviewer = make_principal("USR-ADMIN-001", "rev", "Rev", "reviewer")
    async with client_as(reviewer) as client:
        denied = await client.post(
            f"{BASE}/weights", json={"config": V2, "note": "Reviewer change"}
        )
        assert denied.status_code == 403


@pytest.mark.asyncio
async def test_roles_for_running_reading_and_configuring(client_as, db_session: AsyncSession):
    await seed_scorable(db_session)
    for role, read, run in (
        ("admin", 200, 201),
        ("reviewer", 200, 201),
        ("read_only_reviewer", 200, 403),
        ("verifier", 403, 403),
        ("process_owner", 403, 403),
    ):
        who = make_principal("USR-ADMIN-001", f"r_{role}", role, role)
        async with client_as(who) as client:
            assert (await client.get(f"{BASE}/scores", params=AS_OF_Q)).status_code == read, role
            assert (await client.post(f"{BASE}/run", params=AS_OF_Q)).status_code == run, role


@pytest.mark.asyncio
async def test_unknown_material_and_empty_data(async_client: AsyncClient, db_session: AsyncSession):
    assert (await async_client.post(f"{BASE}/run")).status_code == 404  # nothing loaded yet
    assert (await async_client.get(f"{BASE}/scores")).json()["data"]["has_data"] is False
    await seed_scorable(db_session)
    missing = await async_client.post(f"{BASE}/run", params={**AS_OF_Q, "material_id": "NOPE"})
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_stored_scores_and_weight_sets_are_immutable_in_the_database(
    async_client: AsyncClient, db_session: AsyncSession
):
    from app.api.db.triggers import MATERIAL_RISK_IMMUTABILITY_SQL

    await db_session.execute(text(MATERIAL_RISK_IMMUTABILITY_SQL))  # as the migration does
    await db_session.commit()
    await seed_scorable(db_session)
    await async_client.post(f"{BASE}/run", params=AS_OF_Q)
    for statement in (
        "UPDATE material_risk_scores SET score = 99",
        "DELETE FROM material_risk_scores",
        "UPDATE material_risk_weight_sets SET note = 'edited'",
        "DELETE FROM material_risk_weight_sets",
    ):
        with pytest.raises(DBAPIError, match="immutable"):
            await db_session.execute(text(statement))
        await db_session.rollback()
    score = (await db_session.execute(text("SELECT score FROM material_risk_scores"))).scalar_one()
    assert score == pytest.approx(30.0)


# ── Decoupled from the R-001..R-007 rule engine ──────────────────────────────

RISK_FILES = sorted(
    [
        *(APP / "manufacturing" / "service").glob("risk_*.py"),
        APP / "manufacturing" / "models" / "risk_score.py",
        APP / "manufacturing" / "routes" / "risk_routes.py",
        APP / "manufacturing" / "schemas" / "risk_schemas.py",
    ]
)
RULE_PACKAGES = ("rules", "remediation", "reconstruction")


def imported_modules(path: Path) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            found.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
    return found


def test_the_scoring_code_imports_nothing_from_the_rule_engine():
    assert len(RISK_FILES) == 7
    for path in RISK_FILES:
        source = path.read_text(encoding="utf-8")
        assert "RuleConfig" not in source and "rule_configs" not in source, path.name
        for module in imported_modules(path):
            for package in RULE_PACKAGES:
                assert f"modules.v1.{package}" not in module, f"{path.name} imports {module}"


def test_the_rule_engine_code_imports_nothing_from_the_scoring_service():
    scoring = (
        "risk_scoring",
        "risk_factors",
        "risk_types",
        "risk_score",
        "risk_routes",
        "risk_schemas",
    )
    for package in RULE_PACKAGES:
        for path in (APP / package).rglob("*.py"):
            for module in imported_modules(path):
                assert not any(module.endswith(name) for name in scoring), (
                    f"{path} imports {module}"
                )
                assert "MaterialRisk" not in path.read_text(encoding="utf-8"), path


def test_the_scoring_tables_share_no_foreign_key_or_table_with_the_rule_engine():
    tables = SQLModel.metadata.tables
    for name in ("material_risk_scores", "material_risk_weight_sets"):
        targets = {fk.column.table.name for fk in tables[name].foreign_keys}
        assert "rule_configs" not in targets, name
    rule_targets = {fk.column.table.name for fk in tables["rule_configs"].foreign_keys}
    assert not rule_targets & {"material_risk_scores", "material_risk_weight_sets"}


async def rule_snapshot(session: AsyncSession) -> str:
    await session.rollback()
    rows = await session.execute(
        text("SELECT row_to_json(r)::text FROM (SELECT * FROM rule_configs ORDER BY rule_id) r")
    )
    return "\n".join(rows.scalars().all())


@pytest.mark.asyncio
async def test_scoring_and_weight_changes_never_touch_rule_configuration(
    async_client: AsyncClient, db_session: AsyncSession
):
    db_session.add_all(
        [
            RuleConfig(rule_code="R-001", name="Amount Deviation", description="d", weight=35, threshold_params={"multiplier": 2.0}),
            RuleConfig(rule_code="R-002", name="Recent Bank Change", description="d", weight=25, threshold_params={"lookback_days": 7}),
        ]
    )  # fmt: skip
    await db_session.commit()
    await seed_scorable(db_session)
    before = await rule_snapshot(db_session)
    await async_client.post(f"{BASE}/run", params=AS_OF_Q)
    await async_client.post(f"{BASE}/weights", json={"config": V2, "note": "Weight forecasts more"})
    await async_client.post(f"{BASE}/run", params=AS_OF_Q)
    after = await rule_snapshot(db_session)
    assert (
        after == before
        and hashlib.sha256(after.encode()).hexdigest()
        == hashlib.sha256(before.encode()).hexdigest()
    )


@pytest.mark.asyncio
async def test_changing_rule_configuration_never_changes_a_material_score(
    async_client: AsyncClient, db_session: AsyncSession
):
    db_session.add(
        RuleConfig(
            rule_code="R-001",
            name="Amount Deviation",
            description="d",
            weight=35,
            threshold_params={"multiplier": 2.0},
        )
    )
    await db_session.commit()
    await seed_scorable(db_session)
    first = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    await db_session.execute(
        text(
            "UPDATE rule_configs SET weight = 90, is_active = false, rule_version = 7, threshold_params = '{\"multiplier\": 9}'"
        )
    )
    await db_session.commit()
    second = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]["scored"][0]
    assert (second["score"], second["level"], second["inputs_version"], second["weight_version"]) == (
        first["score"], first["level"], first["inputs_version"], first["weight_version"],
    )  # fmt: skip


# ── QA follow-up: validation, calendar months, rounding, concurrency ─────────


def test_non_numbers_and_non_finite_numbers_are_rejected_as_settings():
    def bad(config):
        with pytest.raises(ValidationError):
            engine.validate_config(config)

    for weights in (
        {**CFG["weights"], "demand": math.nan, "lead_time": 10},
        {**CFG["weights"], "demand": True},
        {**CFG["weights"], "demand": math.inf},
    ):
        bad({**CFG, "weights": weights})
    bad({**CFG, "ramps": {**CFG["ramps"], "demand": [math.nan, 30]}})
    bad({**CFG, "ramps": {**CFG["ramps"], "demand": [0, math.inf]}})
    bad({**CFG, "ramps": {**CFG["ramps"], "demand": [True, 30]}})
    bad({**CFG, "bands": {"moderate": 25, "high": math.nan, "critical": 75}})
    bad({**CFG, "min_evaluable_weight": math.nan})
    bad({**CFG, "min_evaluable_weight": True})


@pytest.mark.asyncio
async def test_the_weights_endpoint_refuses_nan_and_booleans(
    async_client: AsyncClient, db_session: AsyncSession
):
    base = '{"config": {"weights": %s, "ramps": %s, "bands": {"moderate": 25, "high": 50, "critical": 75}, "min_evaluable_weight": 50}, "note": "Try odd values"}'
    ramps = json.dumps(CFG["ramps"])
    nan_weights = json.dumps({**CFG["weights"], "demand": 5}).replace(
        '"demand": 5', '"demand": NaN'
    )
    bool_weights = json.dumps({**CFG["weights"], "demand": 5}).replace(
        '"demand": 5', '"demand": true'
    )
    for weights in (nan_weights, bool_weights):
        res = await async_client.post(
            f"{BASE}/weights",
            content=base % (weights, ramps),
            headers={"Content-Type": "application/json"},
        )
        assert res.status_code == 422, weights
    assert (await async_client.get(f"{BASE}/weights")).json()["data"]["active_version"] == 1


def test_the_level_comes_from_the_stored_rounded_score():
    config = {
        "weights": {**dict.fromkeys(FACTOR_CODES, 0), "price_change": 100},
        "ramps": {**CFG["ramps"], "price_change": [0, 100000]},
        "bands": CFG["bands"],
        "min_evaluable_weight": 0,
    }
    result = engine.score_material(readings(price_change=24999.96), config)  # score 24.99996
    assert result["score"] == 25.0 and result["level"] == "Moderate"  # not stored as 25.0 and Low


def test_volatility_only_compares_consecutive_calendar_months():
    quarterly = [
        MonthPoint(date(2025 + (i * 3) // 12, (i * 3) % 12 + 1, 1), 100.0 + i * 3, 10.0)
        for i in range(10)
    ]  # a purchase every third month
    reading = factors.volatility(quarterly)
    assert reading.raw is None and "consecutive months" in reading.detail
    gap = points([100, 104, 99, 103, 108, 101, 107, 110])
    gap = [p for i, p in enumerate(gap) if i != 4]  # a missing month breaks two comparisons
    assert (
        factors.volatility(gap).raw is None
    )  # 7 points, but only 5 consecutive changes remain (6 are needed)


def test_demand_trend_uses_calendar_months_and_counts_empty_months_as_zero():
    # purchases in Jan, Feb, Jun only; the latest 3 calendar months (Apr-Jun) vs Jan-Mar
    series = [
        MonthPoint(date(2025, 1, 1), 10.0, 100.0),
        MonthPoint(date(2025, 2, 1), 10.0, 100.0),
        MonthPoint(date(2025, 6, 1), 10.0, 150.0),
    ]
    reading = factors.demand_trend(series)
    assert reading.raw == pytest.approx((50 / 66.6667 - 1) * 100, abs=0.01)  # 50 vs 200/3 per month
    assert factors.demand_trend(series[1:]).raw is None  # history starts after the window start
    quarterly = [MonthPoint(date(2025, m, 1), 10.0, 100.0) for m in (1, 4, 7)]
    assert factors.demand_trend(quarterly).raw == pytest.approx(0.0)  # Feb-Apr vs May-Jul: equal


@pytest.mark.asyncio
async def test_weight_versions_never_collide_under_concurrent_requests(
    db_session: AsyncSession,
):
    user = SimpleNamespace(user_id="USR-TEST-001", username="test_reviewer", role="reviewer")

    async def create():
        async with harness.test_session_factory() as session:
            return await scoring.create_weight_set(session, user, V2, "Concurrent change")

    results = await asyncio.gather(create(), create(), create())  # from an empty table
    assert sorted(r["version"] for r in results) == [2, 3, 4]

    async def first_read():
        async with harness.test_session_factory() as session:
            return (await scoring.active_weight_set(session)).version

    assert await asyncio.gather(first_read(), first_read()) == [4, 4]
    count = (
        await db_session.execute(text("SELECT count(*) FROM material_risk_weight_sets"))
    ).scalar_one()
    assert count == 4


@pytest.mark.asyncio
async def test_the_first_ever_reads_create_version_one_exactly_once(db_session: AsyncSession):
    async def first_read():
        async with harness.test_session_factory() as session:
            return (await scoring.active_weight_set(session)).version

    assert await asyncio.gather(first_read(), first_read(), first_read()) == [1, 1, 1]
    count = (
        await db_session.execute(text("SELECT count(*) FROM material_risk_weight_sets"))
    ).scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_a_material_without_purchases_is_reported_not_silently_dropped(
    async_client: AsyncClient, db_session: AsyncSession
):
    await seed_scorable(db_session)
    db_session.add(Material(material_id="MAT-EMPTY", description="No buys", unit_of_measure="kg"))
    await db_session.commit()
    data = (await async_client.post(f"{BASE}/run", params=AS_OF_Q)).json()["data"]
    assert [s["material_id"] for s in data["scored"]] == ["MAT-A"]
    empty = next(n for n in data["not_scored"] if n["material_id"] == "MAT-EMPTY")
    assert "No purchases" in empty["reason"]
