"""Shared helpers for the Ticket 12 transferability tests (not a test module)."""

import json
from pathlib import Path

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.scripts import environment_b as env_b

MAPPING = "/api/v1/manufacturing/mapping"
ANALYTICS = "/api/v1/manufacturing/analytics"
FORECASTS = "/api/v1/manufacturing/forecasting"
EXPOSURE = "/api/v1/manufacturing/exposure"
RISK = "/api/v1/manufacturing/risk-scoring"
VALIDATION = "/api/v1/manufacturing/validation"

DATASET_A = "Synthetic Environment A"
DATASET_B = env_b.DATASET_ID
SAMPLES_A = Path(__file__).resolve().parents[4] / "docs" / "samples" / "erp_mapping"

# Environment A: the solar-panel CSV samples, one file per table, in the order they must load.
A_FILES = (
    ("generic_materials.csv", "materials"),
    ("generic_purchases.csv", "purchase_records"),
    ("generic_inventory.csv", "inventory_records"),
    ("generic_bom.csv", "bom_entries"),
    ("generic_material_costs.csv", "material_costs"),
    ("generic_supplier_ops.csv", "supplier_operations_metrics"),
    ("generic_production.csv", "production_records"),
)
A_SUPPLIERS = tuple(f"SUP-{n:03d}" for n in range(1, 8))


async def add_suppliers(session: AsyncSession, rows: tuple[tuple[str, str, str], ...]) -> None:
    """The supplier directory is a v1.4 master; both environments' suppliers are loaded into it."""
    for supplier_id, name, category in rows:
        if await session.get(Supplier, supplier_id) is None:
            session.add(Supplier(supplier_id=supplier_id, name=name, category=category))
    await session.commit()


async def _post(client: AsyncClient, route: str, name: str, content: bytes, config: dict):
    return await client.post(
        f"{MAPPING}/{route}",
        files={"file": (name, content, "application/octet-stream")},
        data={"config": json.dumps(config)},
    )


async def import_environment_a(client: AsyncClient, session: AsyncSession) -> dict[str, dict]:
    """Import the solar CSV files using only what the preview suggests (no manual mapping)."""
    await add_suppliers(session, tuple((s, f"{s} Ltd", "Solar") for s in A_SUPPLIERS))
    summaries = {}
    for file_name, target in A_FILES:
        content = (SAMPLES_A / file_name).read_bytes()
        preview = await client.post(
            f"{MAPPING}/preview",
            files={"file": (file_name, content, "text/csv")},
            data={"target": target},
        )
        data = preview.json()["data"]
        mapping = data["suggestions"][data["suggested_profile"]]
        res = await _post(
            client,
            "import",
            file_name,
            content,
            {"target": target, "field_mapping": mapping, "dataset_id": DATASET_A},
        )
        assert res.status_code == 200, res.text
        summaries[target] = res.json()["data"]
    return summaries


async def import_environment_b(client: AsyncClient, session: AsyncSession) -> dict[str, dict]:
    """Import the Excel workbook of Environment B sheet by sheet with its own column mapping."""
    sheets = env_b.generate()
    await add_suppliers(
        session, tuple((code, name, commodity) for code, name, commodity in env_b.VENDORS)
    )
    workbook = env_b.workbook_bytes(sheets)
    summaries = {}
    for sheet in env_b.IMPORT_ORDER:
        mapping = env_b.ENVIRONMENT_B_MAPPINGS[sheet]
        res = await _post(
            client,
            "import",
            "environment_b_industrial.xlsx",
            workbook,
            {
                "target": mapping["target"],
                "field_mapping": mapping["field_mapping"],
                "sheet": sheet,
                "dataset_id": DATASET_B,
            },
        )
        assert res.status_code == 200, res.text
        summaries[mapping["target"]] = res.json()["data"]
    return summaries


async def run_pipeline(client: AsyncClient, dataset_id: str, validation: dict) -> dict:
    """Detection, forecasting, exposure, risk scoring and validation, all through the HTTP API."""
    params = {"dataset_id": dataset_id}
    overview = (await client.get(f"{ANALYTICS}/overview", params=params)).json()["data"]
    listed = (await client.get(f"{FORECASTS}/materials", params=params)).json()["data"]
    forecast_runs = []
    for item in listed["materials"]:
        res = await client.post(f"{FORECASTS}/materials/{item['material_id']}/run", params=params)
        assert res.status_code in (200, 201), res.text
        forecast_runs.append(res.json()["data"])
    exposure = (await client.get(EXPOSURE, params={**params, "horizon_days": 90})).json()["data"]
    scoring = await client.post(f"{RISK}/run", params=params)
    assert scoring.status_code in (200, 201), scoring.text
    run = await client.post(f"{VALIDATION}/runs", json={**validation, "dataset_id": dataset_id})
    assert run.status_code == 201, run.text
    return {
        "overview": overview,
        "forecast_list": listed,
        "forecast_runs": forecast_runs,
        "exposure": exposure,
        "scoring": scoring.json()["data"],
        "validation": run.json()["data"],
    }
