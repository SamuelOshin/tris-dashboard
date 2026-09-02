"""
Unit and Integration Tests for Transactions Gateway Routes.
Verifies listing, supplier filtering, and single transaction retrieval.
"""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService

DATA_FILE = Path("../test data.xlsx").resolve()


@pytest.fixture(autouse=True)
async def seed_transactions(db_session: AsyncSession):
    """Seed test dataset containing transactions."""
    await IngestionService.ingest_excel_workbook(DATA_FILE, db_session)


@pytest.mark.asyncio
async def test_get_all_transactions(async_client: AsyncClient):
    """Verify GET /api/v1/transactions returns all 19 invoices."""
    res = await async_client.get("/api/v1/transactions")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert len(data["data"]) == 19


@pytest.mark.asyncio
async def test_filter_transactions_by_supplier(async_client: AsyncClient):
    """Verify filtering transactions by supplier_id (SUP-001 has 8 transactions)."""
    res = await async_client.get("/api/v1/transactions?supplier_id=SUP-001")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 8
    for tx in data:
        assert tx["supplier_id"] == "SUP-001"


@pytest.mark.asyncio
async def test_get_single_transaction(async_client: AsyncClient):
    """Verify retrieving target transaction TX-1999."""
    res = await async_client.get("/api/v1/transactions/TX-1999")
    assert res.status_code == 200
    tx = res.json()["data"]
    assert tx["transaction_id"] == "TX-1999"
    assert tx["amount"] == 104000.00
    assert tx["invoice_number"] == "NC-260828"
