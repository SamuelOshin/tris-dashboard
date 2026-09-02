"""
Unit and Integration Tests for Supplier Master and Baseline Analytics Engine.
Verifies descriptive statistics calculation, strict target exclusion, and error handling.
"""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.suppliers.service.baseline_service import BaselineService

DATA_FILE = Path("../test data.xlsx").resolve()


@pytest.fixture(autouse=True)
async def seed_data(db_session: AsyncSession):
    """Seed synthetic test data before running supplier tests."""
    await IngestionService.ingest_excel_workbook(DATA_FILE, db_session)


@pytest.mark.asyncio
async def test_get_all_suppliers(async_client: AsyncClient):
    """Verify listing all suppliers."""
    res = await async_client.get("/api/v1/suppliers")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 8
    supplier_ids = [s["supplier_id"] for s in data]
    assert "SUP-001" in supplier_ids
    assert "SUP-008" in supplier_ids


@pytest.mark.asyncio
async def test_get_single_supplier(async_client: AsyncClient):
    """Verify retrieving SUP-001 supplier details."""
    res = await async_client.get("/api/v1/suppliers/SUP-001")
    assert res.status_code == 200
    sup = res.json()["data"]
    assert sup["supplier_id"] == "SUP-001"
    assert sup["name"] == "Northstar Components LLC"
    assert sup["risk_tier"] == "Medium"


@pytest.mark.asyncio
async def test_supplier_not_found(async_client: AsyncClient):
    """Verify 404 response for non-existent supplier."""
    res = await async_client.get("/api/v1/suppliers/SUP-999")
    assert res.status_code == 404
    error = res.json()
    assert error["status"] == "ERROR"
    assert error["status_code"] == 404
    assert error["error_code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_baseline_calculation_strict_exclusion_proof(db_session: AsyncSession):
    """
    Mathematical Proof of Baseline Calculation and Target Exclusion (Acceptance T02).
    For SUP-001:
      Historical baseline invoices: TX-1001 to TX-1007 (7 invoices)
      Target anomaly transaction: TX-1999 ($104,000.00)
    """
    # 1. Baseline with strict exclusion of TX-1999
    baseline = await BaselineService.calculate_baseline(
        supplier_id="SUP-001",
        session=db_session,
        exclude_transaction_id="TX-1999",
    )

    assert baseline["invoice_count"] == 7
    assert baseline["mean_amount"] == 30471.43
    assert baseline["median_amount"] == 30400.0
    assert baseline["min_amount"] == 28500.0
    assert baseline["max_amount"] == 32100.0
    assert baseline["std_dev"] == 1306.03
    assert "TX-1999" not in baseline["baseline_transaction_ids"]
    assert len(baseline["baseline_transaction_ids"]) == 7

    # 2. Verify biased baseline if TX-1999 was mistakenly included
    biased_baseline = await BaselineService.calculate_baseline(
        supplier_id="SUP-001",
        session=db_session,
        exclude_transaction_id=None,
    )
    assert biased_baseline["invoice_count"] == 8
    assert biased_baseline["mean_amount"] == 39662.50  # 317,300 / 8 = 39,662.50
    assert "TX-1999" in biased_baseline["baseline_transaction_ids"]


@pytest.mark.asyncio
async def test_supplier_baseline_endpoint(async_client: AsyncClient):
    """Verify GET /api/v1/suppliers/{id}/baseline route with exclude_tx parameter."""
    res = await async_client.get("/api/v1/suppliers/SUP-001/baseline?exclude_tx=TX-1999")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["supplier_id"] == "SUP-001"
    assert data["invoice_count"] == 7
    assert data["mean_amount"] == 30471.43
    assert data["median_amount"] == 30400.0
    assert data["excluded_transaction_id"] == "TX-1999"
