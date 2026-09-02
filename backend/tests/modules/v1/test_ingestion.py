"""
Unit and Integration Tests for TRIS Ingestion Engine.
Verifies parsing and relational seeding of test data.xlsx.
"""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction

DATA_FILE = Path("../test data.xlsx").resolve()


@pytest.mark.asyncio
async def test_api_health_endpoints(async_client: AsyncClient):
    """Verify root and v1 health endpoints."""
    res_root = await async_client.get("/health")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "HEALTHY"

    res_v1 = await async_client.get("/api/v1/health")
    assert res_v1.status_code == 200
    assert res_v1.json()["status"] == "HEALTHY"


@pytest.mark.asyncio
async def test_ingest_excel_workbook_service(db_session: AsyncSession):
    """Verify IngestionService accurately loads all 8 sheets from test data.xlsx."""
    assert DATA_FILE.exists(), f"Synthetic test file not found at {DATA_FILE}"

    report = await IngestionService.ingest_excel_workbook(DATA_FILE, db_session)

    # 1. Verify report counts
    assert report["suppliers_loaded"] == 8
    assert report["transactions_loaded"] == 19
    assert report["approvals_loaded"] == 10
    assert report["access_events_loaded"] == 8
    assert report["rules_loaded"] == 6
    assert report["cases_loaded"] == 2

    # 2. Verify database records persisted
    suppliers = (await db_session.execute(select(Supplier))).scalars().all()
    assert len(suppliers) == 8

    sup_1 = await db_session.get(Supplier, "SUP-001")
    assert sup_1 is not None
    assert sup_1.name == "Northstar Components LLC"
    assert sup_1.category == "Electrical Components"
    assert str(sup_1.bank_change_date) == "2026-08-26"

    # 3. Verify Target Transaction TX-1999
    tx_1999 = await db_session.get(Transaction, "TX-1999")
    assert tx_1999 is not None
    assert tx_1999.supplier_id == "SUP-001"
    assert tx_1999.amount == 104000.00
    assert tx_1999.invoice_number == "NC-260828"

    # 4. Verify Access Event AE-003
    ae_003 = await db_session.get(AccessEvent, "AE-003")
    assert ae_003 is not None
    assert ae_003.user_id == "USR-204"
    assert ae_003.flagged is True  # 22:47 is off-hours

    # 5. Verify Approvals
    approvals = (await db_session.execute(select(Approval))).scalars().all()
    assert len(approvals) == 10

    # 6. Verify Rules
    rules = (await db_session.execute(select(RuleConfig))).scalars().all()
    assert len(rules) == 6

    # 7. Verify Expected Case TEST-CASE-001
    case = await db_session.get(RiskCase, "TEST-CASE-001")
    assert case is not None
    assert case.priority == "High"
    assert case.status == "New"
    assert case.transaction_id == "TX-1999"


@pytest.mark.asyncio
async def test_upload_workbook_endpoint(async_client: AsyncClient):
    """Verify POST /api/v1/ingest/upload gateway route."""
    assert DATA_FILE.exists()

    mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    with open(DATA_FILE, "rb") as f:
        response = await async_client.post(
            "/api/v1/ingest/upload",
            files={"file": ("test_data.xlsx", f, mime_type)},
        )

    assert response.status_code == 201
    json_data = response.json()
    assert json_data["status"] == "SUCCESS"
    assert json_data["data"]["suppliers_loaded"] == 8
    assert json_data["data"]["transactions_loaded"] == 19


@pytest.mark.asyncio
async def test_upload_wrong_file_extension_rejected(async_client: AsyncClient):
    """Verify non-Excel file extension is rejected with 422."""
    response = await async_client.post(
        "/api/v1/ingest/upload",
        files={"file": ("fake_document.pdf", b"%PDF-1.4...", "application/pdf")},
    )
    assert response.status_code == 422
    err = response.json()
    assert err["status"] == "ERROR"
    assert err["error_code"] == "INGESTION_ERROR"
    assert "Unsupported file format" in err["message"]


@pytest.mark.asyncio
async def test_upload_invalid_excel_sheets_rejected(async_client: AsyncClient):
    """Verify Excel workbook missing mandatory sheets is rejected with 422."""
    from io import BytesIO

    import pandas as pd

    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        pd.DataFrame([{"col1": "val1"}]).to_excel(writer, sheet_name="RandomSheet", index=False)
    buf.seek(0)

    response = await async_client.post(
        "/api/v1/ingest/upload",
        files={
            "file": (
                "wrong_schema.xlsx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 422
    err = response.json()
    assert err["status"] == "ERROR"
    assert err["error_code"] == "INGESTION_ERROR"
    assert "missing mandatory sheets" in err["message"]
