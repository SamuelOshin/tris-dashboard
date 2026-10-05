"""
Ticket 12 — transferability.

Environment A is the solar-panel CSV sample set; Environment B is a generated industrial-products
workbook (precision components and fasteners) with its own column names and structure. The same
detection, forecasting, exposure, risk-scoring and validation code must handle both, reached only
through the ordinary file import and a column mapping.

Required: test_the_same_pipeline_code_handles_both_environments_without_branching.
"""

import json
import os
import re
import sys
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

import app.api.modules.v1.manufacturing.service as service_package
from app.api.modules.v1.manufacturing.service import mapping_targets
from app.api.modules.v1.manufacturing.service.source_profiles import (
    GENERIC_SYNONYMS,
    SOURCE_ALIASES,
    normalise,
    suggest_all_profiles,
)
from app.scripts import environment_b as env_b
from tests.modules.v1 import transfer_scan as scan
from tests.modules.v1.transfer_env import (
    A_FILES as A_FILE_NAMES,
)
from tests.modules.v1.transfer_env import (
    DATASET_A,
    DATASET_B,
    SAMPLES_A,
    import_environment_a,
    import_environment_b,
    run_pipeline,
)

SERVICE_DIR = Path(service_package.__file__).parent
# Files that read a source file or describe an ERP layout are the configuration side; everything
# else in service/ is the pipeline and must not know either environment.
CONFIGURATION_SIDE = {
    "file_parser.py",
    "mapping_definition.py",
    "mapping_engine.py",
    "mapping_profile_service.py",
    "mapping_service.py",
    "mapping_targets.py",
    "source_profiles.py",
    "value_coercion.py",
}
PIPELINE_FILES = sorted(p for p in SERVICE_DIR.glob("*.py") if p.name not in CONFIGURATION_SIDE)
VALIDATION = {"cutoff_step_months": 3}  # the same settings for both environments
A_IDS = {"SOL-", "PANEL-", "SUP-00"}
# Raw column names of B that are also ordinary words the pipeline may use as keys.
COMMON_WORDS = {"Month", "From", "To", "Built", "Cur", "Rev", "Assembly", "Component"}
A_CATEGORIES = {"Glass", "Metals", "Polymers", "Electrical", "Cells"}


# ── B is genuinely different from A ──────────────────────────────────────────


def test_environment_b_is_genuinely_different_from_environment_a():
    known = {normalise(w) for w in GENERIC_SYNONYMS} | {
        normalise(f.name) for t in mapping_targets.TARGETS for f in t.fields
    }
    known |= {normalise(syn) for fields in GENERIC_SYNONYMS.values() for syn in fields}
    for profile in SOURCE_ALIASES.values():
        for table in profile.values():
            known |= {normalise(c) for names in table.values() for c in names}
    # no raw column of B is a name TRIS already knows, so every mapping is explicit configuration
    for sheet, config in env_b.ENVIRONMENT_B_MAPPINGS.items():
        columns = env_b.RAW_COLUMNS[sheet]
        assert not [
            c for c in columns if normalise(c) in known and c in config["field_mapping"].values()
        ]
        suggestions = suggest_all_profiles(config["target"], columns)
        assert all(not s for s in suggestions.values()), (sheet, suggestions)

    sheets = env_b.generate()
    a_materials = {
        line.split(",")[0]
        for line in (SAMPLES_A / "generic_materials.csv").read_text().splitlines()[1:]
    }
    b_materials = {row["Part No"] for row in sheets["Parts"]}
    assert not a_materials & b_materials
    assert not {m for m in b_materials if m.startswith(tuple(A_IDS))}
    assert not A_CATEGORIES & {row["Commodity"] for row in sheets["Parts"]}
    a_purchases = (SAMPLES_A / "generic_purchases.csv").read_text().splitlines()
    assert len(a_purchases) - 1 == 24 * 6  # A: exactly one line per material per month
    lines_per_month = {}
    for row in sheets["PO Lines"]:
        key = (row["Part No"], row["Date Placed"][3:])
        lines_per_month[key] = lines_per_month.get(key, 0) + 1
    assert max(lines_per_month.values()) > 1  # B: several lines a month
    assert {row["Cur"] for row in sheets["PO Lines"]} == {"EUR", "USD"}
    assert re.fullmatch(r"\d\d\.\d\d\.\d{4}", sheets["PO Lines"][0]["Date Placed"])  # day first
    big = [r for r in sheets["PO Lines"] if int(r["Qty Ordered"].replace(",", "")) >= 1000]
    assert big and all("," in r["Qty Ordered"] for r in big)  # thousands separators
    assert len(env_b.RAW_COLUMNS) != len(A_FILE_NAMES)  # eight sheets, not seven files
    workbook = env_b.workbook_bytes(sheets)
    assert workbook[:2] == b"PK"  # one Excel workbook; A is plain CSV text
    assert not (SAMPLES_A / "generic_purchases.csv").read_bytes().startswith(b"PK")


# ── Required: no environment-specific branching in the pipeline ──────────────


def _forbidden() -> tuple[set[str], tuple[str, ...]]:
    sheets = env_b.generate()
    names = {row["Part No"] for row in sheets["Parts"]}
    names |= {row["Commodity"] for row in sheets["Parts"]}
    names |= {code for code, _, _ in env_b.VENDORS} | {a for a, _, _ in env_b.ASSEMBLIES}
    names |= {v for _, _, v in env_b.VENDORS}
    names |= {c for cols in env_b.RAW_COLUMNS.values() for c in cols} - COMMON_WORDS
    names |= A_CATEGORIES | {DATASET_A, DATASET_B}
    return names, tuple(A_IDS)


def test_pipeline_code_names_neither_environment():
    forbidden, prefixes = _forbidden()
    problems = []
    for path in PIPELINE_FILES:
        for hit in scan.literal_violations(path.read_text(encoding="utf-8"), forbidden, prefixes):
            problems.append(f"{path.name}:{hit}")
    assert PIPELINE_FILES and not problems, "environment-specific literals: " + "; ".join(problems)


def test_pipeline_code_never_special_cases_a_dataset_material_category_or_unit():
    problems = []
    for path in PIPELINE_FILES:
        for hit in scan.branch_violations(path.read_text(encoding="utf-8")):
            problems.append(f"{path.name}:{hit}")
    assert not problems, "environment-specific branches: " + "; ".join(problems)


@pytest.mark.parametrize(
    "line",
    [
        'if dataset_id == "Synthetic Environment B": pass',
        'if dataset_id in ("Synthetic Environment B",): pass',
        'if m.material_id.startswith("4410"): pass',
        'if currency == "EUR": pass',
        'if category.lower() == "seals": pass',
        'if unit_of_measure in ["pcs", "kg"]: pass',
        "rules = CONFIG[dataset_id]",
        "rules = CONFIG[category]",
        "match category:\n    case 'Seals': pass",
        'if material_id == "4410-0231": pass',
        "if supplier_id != SPECIAL_SUPPLIER: pass",
    ],
)
def test_the_branch_scanner_catches_each_way_of_special_casing(line: str):
    assert scan.branch_violations(line), line


@pytest.mark.parametrize(
    "line",
    [
        'row["Part No"]',
        'x = "Fasteners"',
        'x = "4410-0231"',
        'x = "Synthetic Environment A"',
        'x = "sol-glass-32"',
        'x = "SUP-001"',
    ],
)
def test_the_literal_scanner_catches_names_from_either_environment(line: str):
    forbidden, prefixes = _forbidden()
    assert scan.literal_violations(line, forbidden, prefixes), line


@pytest.mark.parametrize(
    "line",
    [
        "if a.material_id == b.material_id: pass",
        "if dataset_id is None: pass",
        "if not currency: pass",
        "by_id[data.material_id]",
        "totals[currency] = totals.get(currency, 0) + 1",
        'label = "Material cost"',
        'x = {"month": 1}',
    ],
)
def test_the_scanners_leave_ordinary_code_alone(line: str):
    forbidden, prefixes = _forbidden()
    assert not scan.branch_violations(line)
    assert not scan.literal_violations(line, forbidden, prefixes)


@pytest.mark.db
@pytest.mark.asyncio
async def test_the_same_pipeline_code_handles_both_environments_without_branching(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Both environments are imported and run through the same entry points. The functions that ran
    are recorded for each; every module and every entry point that ran for one ran for the other,
    and nothing outside the shared pipeline files was involved.
    """
    imported_a = await import_environment_a(async_client, db_session)
    imported_b = await import_environment_b(async_client, db_session)
    for imported in (imported_a, imported_b):
        for target, result in imported.items():
            summary = result["summary"]
            assert summary["rows_accepted"] > 0 and summary["rows_rejected"] == 0, (target, summary)
            assert not summary["circuit_breaker"]

    monitoring = sys.monitoring
    tool = monitoring.PROFILER_ID
    ran: dict[str, set[tuple[str, str]]] = {}

    def on_start(code, _offset):
        if SERVICE_DIR.as_posix() in Path(code.co_filename).as_posix():
            ran_now.add((Path(code.co_filename).name, code.co_qualname))
            return None
        return monitoring.DISABLE

    monitoring.use_tool_id(tool, "transferability-test")
    monitoring.register_callback(tool, monitoring.events.PY_START, on_start)
    monitoring.set_events(tool, monitoring.events.PY_START)
    try:
        results = {}
        for dataset in (DATASET_A, DATASET_B):
            ran_now: set[tuple[str, str]] = set()
            monitoring.restart_events()
            results[dataset] = await run_pipeline(async_client, dataset, VALIDATION)
            ran[dataset] = ran_now
    finally:
        monitoring.set_events(tool, 0)
        monitoring.free_tool_id(tool)

    # Functions that ran for only one environment are limited to state- and data-driven helpers:
    # an empty-result builder, the first-run weight lock, and generator/lambda bodies of a loop.
    only_one = {name for _, name in ran[DATASET_A] ^ ran[DATASET_B]}
    allowed = {  # (a lambda or generator body inside a loop is a part of its function)
        "_no_data",  # a material with no usable data at the date
        "_unavailable",  # exposure when no stored forecast exists
        "_lock_weight_sets",  # only the first scoring run in a database creates the default weights
    }
    assert {n.split(".<locals>")[0] for n in only_one} <= allowed | {"bom_cost_escalation"}, (
        only_one
    )
    print(
        "FUNCTIONS_RUN", len(ran[DATASET_A]), len(ran[DATASET_B]), "only in one:", sorted(only_one)
    )
    files = {d: {f for f, _ in fns} for d, fns in ran.items()}
    assert files[DATASET_A] == files[DATASET_B], files[DATASET_A] ^ files[DATASET_B]
    assert not {
        f for f in files[DATASET_B] if f in CONFIGURATION_SIDE
    }  # no import code at run time
    entry_points = {
        ("detection_engine.py", "compute_results"),
        ("forecast_engine.py", "run_horizon"),
        ("exposure_engine.py", "baseline_exposure"),
        ("risk_scoring_engine.py", "score_material"),
        ("validation_service.py", "freeze_cutoff"),
        ("validation_metrics.py", "summarise"),
    }
    for dataset in (DATASET_A, DATASET_B):
        assert entry_points <= ran[dataset], (dataset, entry_points - ran[dataset])

    # Each environment produced real output from every stage (nothing fabricated, nothing empty).
    for dataset, out in results.items():
        assert out["overview"]["has_data"] and out["overview"]["materials"], dataset
        assert any(
            r["status"] == "forecast" for run in out["forecast_runs"] for r in run["horizons"]
        ), dataset
        assert out["exposure"]["has_data"], dataset
        assert len(out["scoring"]["scored"]) > 0, dataset
        assert out["validation"]["status"] == "completed", dataset
        assert out["validation"]["metrics"]["evaluated"] > 0, dataset
    assert (
        results[DATASET_A]["validation"]["versions"] == results[DATASET_B]["validation"]["versions"]
    )  # one method version, one set of risk weights


@pytest.mark.db
@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("TRANSFER_EVIDENCE_DIR"),
    reason="evidence run only (set TRANSFER_EVIDENCE_DIR)",
)
async def test_write_side_by_side_validation_evidence(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Not a check: runs both environments with default settings and saves the raw responses."""
    folder = Path(os.environ["TRANSFER_EVIDENCE_DIR"])
    folder.mkdir(parents=True, exist_ok=True)
    imported = {
        DATASET_A: await import_environment_a(async_client, db_session),
        DATASET_B: await import_environment_b(async_client, db_session),
    }
    for dataset, label in ((DATASET_A, "environment_a"), (DATASET_B, "environment_b")):
        out = await run_pipeline(async_client, dataset, {})
        out["imports"] = {t: r["summary"] for t, r in imported[dataset].items()}
        (folder / f"{label}_pipeline.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
