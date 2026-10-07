"""
Case study 01: one material-cost story from data import to validated results.

Runs the whole walkthrough of docs/CASE_STUDY_01.md through the API of a running TRIS backend
(or, in the test suite, through an in-process client) and prints the figures the document quotes.
With --check it compares them with docs/case_study/CASE_STUDY_01_expected.json, so the document
can be reproduced on an empty database and confirmed.

    uv run python -m app.scripts.case_study --check
    uv run python -m app.scripts.case_study --write-expected      # after a deliberate change

Everything after the import runs in the default "all data" scope, the one the screens use when no
dataset is chosen, so the figures here are the figures on screen. (Stored forecasts and scores are
kept per scope: results for a chosen dataset are separate from results for all data.)

The accounts are the demo personas of app/scripts/seed.py. The script only ever calls the public
API as those users; it does not touch the database.
"""

import argparse
import asyncio
import json
import sys
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import httpx

from app.scripts.seed import DEMO_PERSONAS

REPO = Path(__file__).resolve().parents[3]
SAMPLES = REPO / "docs" / "samples" / "erp_mapping"
EXPECTED = REPO / "docs" / "case_study" / "CASE_STUDY_01_expected.json"
DATASET = "Synthetic Environment A"
MATERIAL = "SOL-CELL-M10"
SUPPLIERS = tuple(f"SUP-{n:03d}" for n in range(1, 8))
FILES = (
    ("generic_materials.csv", "materials"),
    ("generic_purchases.csv", "purchase_records"),
    ("generic_inventory.csv", "inventory_records"),
    ("generic_bom.csv", "bom_entries"),
    ("generic_material_costs.csv", "material_costs"),
    ("generic_supplier_ops.csv", "supplier_operations_metrics"),
    ("generic_production.csv", "production_records"),
)
API = "/api/v1"
MANUFACTURING = f"{API}/manufacturing"


@dataclass
class Actor:
    """A signed-in user: the client to call the API with and the name the audit trail shows."""

    client: httpx.AsyncClient
    name: str


AsRole = Callable[[str], AbstractAsyncContextManager[Actor]]


def _r(value: float | None, digits: int = 4) -> float | None:
    return None if value is None else round(float(value), digits)


async def _ok(response: httpx.Response, expected: tuple[int, ...] = (200, 201)) -> Any:
    if response.status_code not in expected:
        raise RuntimeError(
            f"{response.request.url} -> {response.status_code}: {response.text[:300]}"
        )
    return response.json()["data"]


async def import_files(as_role: AsRole, out: dict[str, Any]) -> None:
    """Step 1: the seven sample files, each mapped with the layout the preview suggests."""
    counts = {}
    async with as_role("reviewer") as actor:
        for name, target in FILES:
            content = (SAMPLES / name).read_bytes()
            preview = await _ok(
                await actor.client.post(
                    f"{MANUFACTURING}/mapping/preview",
                    files={"file": (name, content, "text/csv")},
                    data={"target": target},
                )
            )
            mapping = preview["suggestions"][preview["suggested_profile"]]
            config = {"target": target, "field_mapping": mapping, "dataset_id": DATASET}
            result = await _ok(
                await actor.client.post(
                    f"{MANUFACTURING}/mapping/import",
                    files={"file": (name, content, "text/csv")},
                    data={"config": json.dumps(config)},
                )
            )
            summary = result["summary"]
            counts[target] = {
                "accepted": summary["rows_accepted"],
                "rejected": summary["rows_rejected"],
                "status": result["status"],
            }
    out["imports"] = counts


async def detect(as_role: AsRole, out: dict[str, Any]) -> None:
    """Step 2: price signals for every material, computed from the imported data."""
    async with as_role("reviewer") as actor:
        overview = await _ok(await actor.client.get(f"{MANUFACTURING}/analytics/overview"))
        detail = await _ok(
            await actor.client.get(f"{MANUFACTURING}/analytics/materials/{MATERIAL}")
        )
    row = next(m for m in overview["materials"] if m["material_id"] == MATERIAL)
    out["detection"] = {
        "materials": len(overview["materials"]),
        "latest_price": row["latest_price"],
        "standard_cost": row["standard_cost"],
        "vs_standard_pct": row["vs_standard_pct"],
        "price_change_3m_pct": row["price_change_3m_pct"],
        "top_supplier_share_pct": row["top_supplier_share_pct"],
        "coverage_days": row["coverage_days"],
        "triggered": sorted(s["code"] for s in row["signals"] if s["status"] == "triggered"),
        "signals_in_detail": len(detail.get("signals", row["signals"])),
    }


async def forecast(as_role: AsRole, out: dict[str, Any]) -> None:
    """Step 3: store a 30- and 90-day forecast for every material."""
    params: dict[str, Any] = {}  # the default scope, as on the screens
    async with as_role("reviewer") as actor:
        listed = await _ok(
            await actor.client.get(f"{MANUFACTURING}/forecasting/materials", params=params)
        )
        runs = {}
        for item in listed["materials"]:
            url = f"{MANUFACTURING}/forecasting/materials/{item['material_id']}/run"
            runs[item["material_id"]] = await _ok(await actor.client.post(url, params=params))
    shown = {}
    for horizon in runs[MATERIAL]["horizons"]:
        run = horizon["run"]
        shown[str(horizon["horizon_days"])] = {
            "model": run["model"]["name"],
            "forecast": _r(run["forecast"]["value"], 4),
            "lower": _r(run["forecast"]["lower"], 4),
            "upper": _r(run["forecast"]["upper"], 4),
            "last_price": run["forecast"]["last_observed_price"],
            "change_pct": run["forecast"]["change_pct"],
        }
    out["forecast"] = {
        "materials": len(runs),
        "stored_runs": sum(
            1 for r in runs.values() for h in r["horizons"] if h["status"] == "forecast"
        ),
        MATERIAL: shown,
    }


async def exposure(as_role: AsRole, out: dict[str, Any]) -> None:
    """Step 4: what the forecast costs, then a what-if that must not change the baseline."""
    params = {"horizon_days": 90}
    async with as_role("reviewer") as actor:
        before = await _ok(await actor.client.get(f"{MANUFACTURING}/exposure", params=params))
        scenario = await _ok(
            await actor.client.post(
                f"{MANUFACTURING}/exposure/scenario",
                json={"horizon_days": 90, "scenario": {"price_change_pct": 10}},
            )
        )
        after = await _ok(await actor.client.get(f"{MANUFACTURING}/exposure", params=params))
    mine = next(m for m in before["materials"] if m["material_id"] == MATERIAL)
    scen = next(m for m in scenario["materials"] if m["material_id"] == MATERIAL)
    out["exposure"] = {
        "baseline_unit_cost": mine["baseline_unit_cost"],
        "forecast_unit_cost": mine["forecast_unit_cost"],
        "expected_usage": mine["expected_usage"],
        "projected_exposure": mine["projected_exposure"],
        "scenario_price_plus_10pct": {
            "unit_cost": scen["scenario"]["scenario_unit_cost"],
            "exposure": scen["scenario"]["scenario_exposure"],
            "change_vs_baseline": scen["scenario"]["change_vs_baseline"],
        },
        "baseline_unchanged_by_scenario": before["materials"] == after["materials"],
    }


async def risk(as_role: AsRole, out: dict[str, Any]) -> None:
    """Steps 5 and 6: score with the default weights, lower the High band, score again."""
    async with as_role("reviewer") as actor:
        first = await _ok(await actor.client.post(f"{MANUFACTURING}/risk-scoring/run"))
    out["risk_default_weights"] = {
        "weight_version": first["weight_version"],
        "scores": {s["material_id"]: [_r(s["score"], 1), s["level"]] for s in first["scored"]},
    }
    async with as_role("admin") as actor:  # a configuration change: a new version, never an edit
        weights = await _ok(await actor.client.get(f"{MANUFACTURING}/risk-scoring/weights"))
        active = weights["versions"][0]["config"]
        config = {**active, "bands": {**active["bands"], "high": 40}}
        await _ok(
            await actor.client.post(
                f"{MANUFACTURING}/risk-scoring/weights",
                json={"config": config, "note": "Case study: the High band lowered to 40."},
            )
        )
    async with as_role("reviewer") as actor:
        second = await _ok(await actor.client.post(f"{MANUFACTURING}/risk-scoring/run"))
        mine = next(s for s in second["scored"] if s["material_id"] == MATERIAL)
        detail = await _ok(
            await actor.client.get(f"{MANUFACTURING}/risk-scoring/scores/{mine['score_id']}")
        )
    out["risk_high_band_40"] = {
        "weight_version": second["weight_version"],
        "scores": {s["material_id"]: [_r(s["score"], 1), s["level"]] for s in second["scored"]},
        "case_material_drivers": [
            [f["code"], _r(f["points"], 1)]
            for f in sorted(detail["factors"], key=lambda f: -f["points"])[:3]
        ],
    }
    out["_score_id"] = mine["score_id"]


async def case(as_role: AsRole, out: dict[str, Any]) -> None:
    """Steps 7 to 9: open a case, investigate it, refuse the wrong closers, then close it."""
    closure = {
        "root_cause": "The cell supplier's price list was not renegotiated at the last renewal.",
        "corrective_action": "A fixed-price clause was agreed for the next two quarters.",
        "closure_type": "Process Error / Remedied",
        "closure_evidence": "contract_amendment.pdf",
        "closure_date": date.today().isoformat(),
        "follow_up_requirement": "Review the price trend after the next two purchase cycles.",
        "recurrence_monitoring": "Monthly price check for six months.",
    }
    async with as_role("reviewer") as reviewer:
        opened = await _ok(
            await reviewer.client.post(
                f"{MANUFACTURING}/material-cases",
                json={"score_id": out["_score_id"], "note": "Raised from the material cost review"},
            )
        )
        case_id = opened["case"]["case_id"]
        context = await _ok(
            await reviewer.client.get(f"{MANUFACTURING}/material-cases/{case_id}/context")
        )
        transition = f"{API}/cases/{case_id}/transition"
        for status, fields in (
            ("Assigned", {"assigned_to": reviewer.name, "department": "Procurement"}),
            ("Under Investigation", {"note": "Reviewing the supplier price history"}),
        ):
            await _ok(await reviewer.client.post(transition, json={"to_status": status, **fields}))
    # The administrator takes the Corrective Action step: from now on they are a participant in
    # the investigation, although their role would otherwise be allowed to close a case.
    async with as_role("admin") as admin:
        await _ok(
            await admin.client.post(
                transition,
                json={"to_status": "Corrective Action", "root_cause": closure["root_cause"]},
            )
        )
    async with as_role("reviewer") as reviewer:
        await _ok(
            await reviewer.client.post(
                transition,
                json={
                    "to_status": "Pending Verification",
                    "corrective_action": closure["corrective_action"],
                },
            )
        )
        by_reviewer = await reviewer.client.post(
            transition, json={"to_status": "Closed", **closure, "verified_by": reviewer.name}
        )
    async with as_role("admin") as admin:
        by_participating_admin = await admin.client.post(
            transition, json={"to_status": "Closed", **closure, "verified_by": admin.name}
        )
    async with as_role("verifier") as verifier:
        await _ok(
            await verifier.client.post(
                transition, json={"to_status": "Closed", **closure, "verified_by": verifier.name}
            )
        )
        final = await _ok(await verifier.client.get(f"{API}/cases/{case_id}"))
    out["case"] = {
        "category": opened["case"]["case_category"],
        "material_id": opened["case"]["material_id"],
        "stored_score": _r(context["replay"]["stored_score"], 1),
        "replay_reproduces_stored_score": context["replay"]["reproduced"],
        # two different rules, each with its own error: a reviewer may not close at all (role),
        # and an administrator who took part in the investigation may not close it (separation
        # of duties)
        "closure_refused": {
            "reviewer": [by_reviewer.status_code, by_reviewer.json().get("error_code")],
            "participating_admin": [
                by_participating_admin.status_code,
                by_participating_admin.json().get("error_code"),
            ],
        },
        "history": [h["new_status"] for h in final["history"]],
    }


async def validate(as_role: AsRole, out: dict[str, Any]) -> None:
    """Step 10: the retrospective validation with default settings, nothing selected."""
    async with as_role("reviewer") as actor:
        run = await _ok(await actor.client.post(f"{MANUFACTURING}/validation/runs", json={}))
    horizons = {}
    for days, h in run["metrics"]["by_horizon"].items():
        f, w = h["forecast"], h["warning"]
        horizons[days] = {
            "cases": h["cases"],
            "judged": h["evaluated"],
            "mape_pct": _r(f["mape_pct"], 2),
            "closer_than_naive": _r(f["beats_naive_share"], 3),
            "events": w["events"],
            "tp_fp_fn_tn": [w["tp"], w["fp"], w["fn"], w["tn"]],
        }
    out["validation"] = {
        "method": run["versions"]["validation_method"],
        "cutoffs": len(run["config"]["cutoffs"]),
        "by_horizon": horizons,
    }


STEPS = (import_files, detect, forecast, exposure, risk, case, validate)


async def run_case_study(
    as_role: AsRole, log: Callable[[str], None] = print, only: tuple[str, ...] = ()
) -> dict[str, Any]:
    """Run every step (or only the named ones) and return the figures the document quotes."""
    out: dict[str, Any] = {}
    for step in STEPS:
        if only and step.__name__ not in only:
            continue
        log(f"== {step.__doc__.splitlines()[0]}")
        before = set(out)
        await step(as_role, out)
        added = {k: v for k, v in out.items() if k not in before and not k.startswith("_")}
        log(json.dumps(added, indent=1, default=str))
    return {k: v for k, v in out.items() if not k.startswith("_")}


def differences(expected: Any, actual: Any, path: str = "") -> list[str]:
    """Where two result trees differ (numbers compared to 4 decimals)."""
    if isinstance(expected, dict) and isinstance(actual, dict):
        keys = sorted(set(expected) | set(actual))
        return [d for k in keys for d in differences(expected.get(k), actual.get(k), f"{path}/{k}")]
    if isinstance(expected, list) and isinstance(actual, list) and len(expected) == len(actual):
        return [
            d
            for i, (e, a) in enumerate(zip(expected, actual, strict=True))
            for d in differences(e, a, f"{path}[{i}]")
        ]
    if isinstance(expected, float) or isinstance(actual, float):
        same = expected is not None and actual is not None and abs(expected - actual) < 5e-5
        return [] if same else [f"{path}: expected {expected}, got {actual}"]
    return [] if expected == actual else [f"{path}: expected {expected}, got {actual}"]


@asynccontextmanager
async def _signed_in(base_url: str, username: str, name: str, password: str):
    async with httpx.AsyncClient(base_url=base_url, timeout=600) as client:
        login = await client.post(
            f"{API}/auth/login", json={"username": username, "password": password}
        )
        login.raise_for_status()
        yield Actor(client, name)


def _live_roles(base_url: str) -> AsRole:
    people = {p["username"]: p for p in DEMO_PERSONAS}

    def as_role(username: str) -> AbstractAsyncContextManager[Actor]:
        person = people[username]
        return _signed_in(base_url, username, person["name"], person["password"])

    return as_role


async def _main() -> int:
    parser = argparse.ArgumentParser(description="Run case study 01 against a running TRIS backend")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument(
        "--only",
        default="",
        help="run only these steps, comma separated: "
        + ", ".join(step.__name__ for step in STEPS)
        + " (the case step needs the risk step in the same run)",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--check", action="store_true", help="compare with the expected figures")
    group.add_argument(
        "--write-expected", action="store_true", help="store the figures as expected"
    )
    args = parser.parse_args()
    only = tuple(name for name in args.only.split(",") if name)
    results = await run_case_study(_live_roles(args.base_url), only=only)
    if args.write_expected:
        EXPECTED.parent.mkdir(parents=True, exist_ok=True)
        EXPECTED.write_text(json.dumps(results, indent=1), encoding="utf-8")
        print(f"written {EXPECTED}")
    if args.check:
        expected = json.loads(EXPECTED.read_text(encoding="utf-8"))
        if only:  # compare only the figures of the steps that were run
            expected = {k: v for k, v in expected.items() if k in results}
        problems = differences(expected, results)
        print("\nCASE STUDY REPRODUCED: every figure matches" if not problems else "\nDIFFERENCES:")
        print("\n".join(problems))
        return 1 if problems else 0
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
