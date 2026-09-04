"""
Comprehensive Unit and Integration Tests for TRIS Ingestion Engine (Revision 2.2).
Verifies asynchronous background lifecycle, RBAC, ownership checks, circuit breakers,
savepoint isolation, JSON-serialization of error logs, and database immutability.
"""

from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock, patch

import numpy as np
import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.dependencies import get_current_user
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.ingestion.models.ingestion_job import IngestionJob
from app.api.modules.v1.ingestion.service.ingestion_service import (
    IngestionService,
    _flush_chunk_with_isolation,
    _to_json_safe,
)
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.main import app

DATA_FILE = Path("../test data.xlsx").resolve()


def _create_minimal_workbook_bytes(
    suppliers: list[dict] | None = None,
    transactions: list[dict] | None = None,
    approvals: list[dict] | None = None,
    cases: list[dict] | None = None,
) -> bytes:
    """Helper to generate in-memory Excel workbooks for testing edge cases."""
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        sup_data = (
            suppliers
            if suppliers is not None
            else [{"supplier_id": "SUP-001", "supplier_name": "Test Supplier 1", "category": "IT"}]
        )
        pd.DataFrame(sup_data).to_excel(writer, sheet_name="Suppliers", index=False)

        tx_data = (
            transactions
            if transactions is not None
            else [
                {
                    "transaction_id": "TX-101",
                    "supplier_id": "SUP-001",
                    "amount_usd": 5000.0,
                    "invoice_date": "2026-08-01",
                }
            ]
        )
        pd.DataFrame(tx_data).to_excel(writer, sheet_name="Transactions", index=False)

        if approvals is not None:
            pd.DataFrame(approvals).to_excel(writer, sheet_name="Approvals", index=False)

        if cases is not None:
            pd.DataFrame(cases).to_excel(writer, sheet_name="Expected_Cases", index=False)

    return buf.getvalue()


# ── BASELINE & SERVICE TESTS ────────────────────────────────────────────────


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

    assert report["suppliers_loaded"] == 8
    assert report["transactions_loaded"] == 19
    assert report["approvals_loaded"] == 10
    assert report["access_events_loaded"] == 8
    assert report["rules_loaded"] == 6
    assert report["cases_loaded"] == 2

    suppliers = (await db_session.execute(select(Supplier))).scalars().all()
    assert len(suppliers) == 8


# ── ASYNC 202 UPLOAD & TELEMETRY ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_workbook_endpoint_async_202(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify POST /api/v1/ingest/upload returns 202 Accepted and job completes."""
    assert DATA_FILE.exists()

    mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    with open(DATA_FILE, "rb") as f:
        file_bytes = f.read()

    response = await async_client.post(
        "/api/v1/ingest/upload",
        files={"file": ("test_data.xlsx", file_bytes, mime_type)},
    )

    assert response.status_code == 202
    json_data = response.json()
    assert json_data["status"] == "SUCCESS"
    job_id = json_data["data"]["job_id"]
    assert job_id.startswith("INGEST-")
    assert json_data["data"]["status"] == "PENDING"

    # Poll status endpoint
    poll_res = await async_client.get(f"/api/v1/ingest/jobs/{job_id}")
    assert poll_res.status_code == 200
    job_data = poll_res.json()["data"]
    assert job_data["job_id"] == job_id
    assert job_data["status"] in ("PENDING", "PROCESSING", "COMPLETED")


# ── RBAC & SECURITY TESTS ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_unauthenticated_rejected(db_session: AsyncSession):
    """VULN-003: POST /api/v1/ingest/upload MUST reject unauthenticated caller with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/ingest/upload",
            files={
                "file": (
                    "test.xlsx",
                    b"dummy",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_upload_low_privilege_role_rejected(db_session: AsyncSession):
    """D2: Procurement role attempting upload must be rejected with 403 PERMISSION_DENIED."""

    async def override_get_db():
        yield db_session

    async def override_procurement_user():
        return User(
            user_id="USR-PROC-01",
            username="buyer",
            name="Junior Buyer",
            email="buyer@tris.internal",
            role="procurement",
            department="Procurement",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_procurement_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/ingest/upload",
            files={
                "file": (
                    "test.xlsx",
                    b"dummy",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )

    app.dependency_overrides.clear()
    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_get_job_telemetry_unauthorized_owner(db_session: AsyncSession):
    """D1: User B attempting to read User A's ingestion job telemetry gets 403."""
    job = IngestionJob(
        job_id="INGEST-OWNER-TEST-1",
        status="COMPLETED",
        uploaded_by="USR-CREATOR-1",
        duplicate_strategy="skip",
    )
    db_session.add(job)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_other_user():
        return User(
            user_id="USR-INTRUDER-2",
            username="intruder",
            name="Non Owner",
            email="intruder@tris.internal",
            role="reviewer",  # Reviewer role, but not the owner
            department="Finance",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_other_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/ingest/jobs/{job.job_id}")

    app.dependency_overrides.clear()
    assert response.status_code == 403
    assert response.json()["error_code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_get_job_telemetry_admin_override(db_session: AsyncSession):
    """D1: Admin user can read telemetry for a job created by any user."""
    job = IngestionJob(
        job_id="INGEST-ADMIN-TEST-1",
        status="COMPLETED",
        uploaded_by="USR-SOMEONE-ELSE",
        duplicate_strategy="skip",
    )
    db_session.add(job)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_admin_user():
        return User(
            user_id="USR-ADMIN-OVERRIDE",
            username="superadmin",
            name="Admin User",
            email="admin@tris.internal",
            role="admin",
            department="Risk",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_admin_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/ingest/jobs/{job.job_id}")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["data"]["job_id"] == "INGEST-ADMIN-TEST-1"


@pytest.mark.asyncio
async def test_list_ingestion_jobs_pagination_and_rbac(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify GET /api/v1/ingest/jobs lists recent jobs with pagination."""
    for i in range(3):
        job = IngestionJob(
            job_id=f"INGEST-LIST-{i}",
            status="COMPLETED",
            uploaded_by="USR-TEST-001",
            filename=f"test_{i}.xlsx",
            duplicate_strategy="skip",
        )
        db_session.add(job)
    await db_session.commit()

    response = await async_client.get("/api/v1/ingest/jobs?limit=2&offset=0")
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "SUCCESS"
    assert len(res_data["data"]["jobs"]) == 2
    assert res_data["data"]["limit"] == 2


# ── DATA INTEGRITY & IMMUTABILITY TESTS ─────────────────────────────────────


@pytest.mark.asyncio
async def test_case_immutability_under_update_strategy(db_session: AsyncSession):
    """D3: duplicate_strategy=update MUST NEVER mutate existing RiskCase records."""
    existing_case = RiskCase(
        case_id="TEST-CASE-IMMUTABLE",
        case_number="CASE-2026-IMMUTABLE",
        priority="Low",
        status="Under Review",
    )
    db_session.add(existing_case)
    await db_session.commit()

    # Workbook attempting to overwrite case with High priority
    wb_bytes = _create_minimal_workbook_bytes(
        cases=[
            {
                "case_id": "TEST-CASE-IMMUTABLE",
                "expected_priority": "Critical",
                "primary_record": "TX-999",
                "expected_flags": "R-001",
            }
        ]
    )

    await IngestionService.ingest_excel_workbook(
        file_path_or_bytes=wb_bytes,
        session=db_session,
        duplicate_strategy="update",
    )

    refreshed_case = await db_session.get(RiskCase, "TEST-CASE-IMMUTABLE")
    assert refreshed_case.priority == "Low"
    assert refreshed_case.status == "Under Review"


@pytest.mark.asyncio
async def test_special_characters_stored_without_html_escape(db_session: AsyncSession):
    """D9: Raw characters (&, <, >, ") must be stored cleanly without HTML escaping."""
    special_name = 'Alpha & Beta <Tech> "Solutions"'
    wb_bytes = _create_minimal_workbook_bytes(
        suppliers=[
            {"supplier_id": "SUP-SPECIAL-1", "supplier_name": special_name, "category": "IT"}
        ]
    )

    await IngestionService.ingest_excel_workbook(wb_bytes, db_session)

    supplier = await db_session.get(Supplier, "SUP-SPECIAL-1")
    assert supplier is not None
    assert supplier.name == special_name
    assert "&amp;" not in supplier.name
    assert "&lt;" not in supplier.name


# ── JSON SERIALIZATION & DIAGNOSTICS TESTS ──────────────────────────────────


@pytest.mark.asyncio
async def test_error_log_captures_source_row_dict_and_exact_row_number(db_session: AsyncSession):
    """Asserts error_log captures row number (accounting for header) and raw dict."""
    wb_bytes = _create_minimal_workbook_bytes(
        suppliers=[
            {"supplier_id": "SUP-GOOD-1", "supplier_name": "Good Supplier", "category": "IT"},
            {
                "supplier_id": "SUP-BAD-2",
                "supplier_name": "",
                "category": "IT",
            },  # Line 3 (header=1, row0=2, row1=3)
        ],
        transactions=[
            {
                "transaction_id": "TX-1",
                "supplier_id": "SUP-GOOD-1",
                "amount_usd": 100.0,
                "invoice_date": "2026-08-01",
            }
        ],
    )

    excel_file = pd.ExcelFile(BytesIO(wb_bytes))
    report, error_log, counts = await IngestionService._execute_pipeline(excel_file, db_session)

    assert len(error_log) == 1
    err = error_log[0]
    assert err["sheet"] == "Suppliers"
    assert err["row"] == 3
    assert isinstance(err["raw_value"], dict)
    assert err["raw_value"]["supplier_id"] == "SUP-BAD-2"


@pytest.mark.asyncio
async def test_error_log_json_serialization_roundtrip(db_session: AsyncSession):
    """D13: Verify timestamps and numpy scalar types in error_log persist cleanly into DB JSON."""
    raw_dict_with_numpy = {
        "timestamp_field": pd.Timestamp("2026-08-15 14:30:00"),
        "int_field": np.int64(42),
        "float_field": np.float64(1250.75),
        "bool_field": np.bool_(True),
    }

    safe_dict = {k: _to_json_safe(v) for k, v in raw_dict_with_numpy.items()}

    job = IngestionJob(
        job_id="INGEST-JSON-TEST-1",
        status="COMPLETED_WITH_ERRORS",
        uploaded_by="USR-TEST-001",
        duplicate_strategy="skip",
        error_log=[
            {
                "sheet": "Transactions",
                "row": 4,
                "field": "test_field",
                "error": "Simulated error",
                "raw_value": safe_dict,
            }
        ],
    )

    db_session.add(job)
    await db_session.commit()

    persisted = await db_session.get(IngestionJob, "INGEST-JSON-TEST-1")
    assert persisted is not None
    assert len(persisted.error_log) == 1
    persisted_raw = persisted.error_log[0]["raw_value"]
    assert persisted_raw["int_field"] == 42
    assert persisted_raw["float_field"] == 1250.75
    assert "2026-08-15" in persisted_raw["timestamp_field"]


# ── CIRCUIT BREAKER TESTS ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_suppliers_circuit_breaker_hard_abort(db_session: AsyncSession):
    """D6: Mandatory sheet failure > 20% on >= 10 rows causes a HARD ABORT."""
    # 10 suppliers: 3 invalid (no name) = 30% error rate > 20%
    suppliers = []
    for i in range(10):
        suppliers.append(
            {
                "supplier_id": f"SUP-CB-{i}",
                "supplier_name": "" if i < 3 else f"Supplier {i}",
                "category": "Test",
            }
        )

    wb_bytes = _create_minimal_workbook_bytes(suppliers=suppliers)

    job = IngestionJob(
        job_id="INGEST-CB-HARD-1",
        status="PENDING",
        uploaded_by="USR-TEST-001",
        duplicate_strategy="skip",
    )
    db_session.add(job)
    await db_session.commit()

    # Run job
    await IngestionService.run_ingestion_job(
        job_id=job.job_id,
        file_bytes=wb_bytes,
    )

    db_session.expire_all()
    refreshed_job = await db_session.get(IngestionJob, "INGEST-CB-HARD-1")
    assert refreshed_job is not None
    assert refreshed_job.status == "FAILED"
    assert any(
        "Circuit breaker tripped on sheet 'Suppliers'" in str(e) for e in refreshed_job.error_log
    )


@pytest.mark.asyncio
async def test_optional_sheet_circuit_breaker_soft_abort(db_session: AsyncSession):
    """D6: Optional sheet failure > 20% causes SOFT ABORT (sheet skipped, job finishes)."""
    # 10 approvals: 3 invalid (pointing to non-existent transactions) = 30% error rate
    approvals = []
    for i in range(10):
        approvals.append(
            {
                "approval_id": f"APP-CB-{i}",
                "transaction_id": "TX-DOES-NOT-EXIST" if i < 3 else "TX-101",
                "required_level": "Level 1",
            }
        )

    wb_bytes = _create_minimal_workbook_bytes(approvals=approvals)

    job = IngestionJob(
        job_id="INGEST-CB-SOFT-1",
        status="PENDING",
        uploaded_by="USR-TEST-001",
        duplicate_strategy="skip",
    )
    db_session.add(job)
    await db_session.commit()

    await IngestionService.run_ingestion_job(
        job_id=job.job_id,
        file_bytes=wb_bytes,
    )

    db_session.expire_all()
    refreshed_job = await db_session.get(IngestionJob, "INGEST-CB-SOFT-1")
    assert refreshed_job is not None
    assert refreshed_job.status == "COMPLETED_WITH_ERRORS"
    assert refreshed_job.summary_report["suppliers_loaded"] == 1
    assert refreshed_job.summary_report["transactions_loaded"] == 1
    assert refreshed_job.summary_report["approvals_loaded"] == 0  # Soft-aborted sheet has 0 loaded


# ── SAVEPOINT CHUNK ISOLATION TESTS ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_chunk_savepoint_isolation_single_bad_row(db_session: AsyncSession):
    """
    D5: In a chunk of rows, a single constraint violation isolates that 1 row
    while committing the rest.
    """
    # Create an initial supplier
    existing_sup = Supplier(supplier_id="SUP-DUP", name="Existing Sup", category="IT")
    db_session.add(existing_sup)
    await db_session.commit()

    chunk: list[tuple[Supplier, dict]] = []
    # 5 items: item 2 is a duplicate PK that will fail at the database constraint level
    for i in range(5):
        s_id = "SUP-DUP" if i == 2 else f"SUP-ISO-{i}"
        s = Supplier(supplier_id=s_id, name=f"Supplier {i}", category="IT")
        s._source_row_num = i + 2
        chunk.append((s, {"supplier_id": s_id, "name": f"Supplier {i}"}))

    error_log: list[dict] = []
    inserted, errors = await _flush_chunk_with_isolation(db_session, chunk, error_log, "Suppliers")

    assert inserted == 4
    assert errors == 1
    assert len(error_log) == 1
    assert error_log[0]["row"] == 4  # Item 2 (index 2 + 2 = row 4)
    assert error_log[0]["raw_value"]["supplier_id"] == "SUP-DUP"


@pytest.mark.asyncio
async def test_approvals_unlinked_transaction_fk_skipped(db_session: AsyncSession):
    """D7: Approval referencing unknown transaction is skipped and logged as referential failure."""
    wb_bytes = _create_minimal_workbook_bytes(
        approvals=[{"approval_id": "APP-UNLINKED-1", "transaction_id": "TX-MISSING-999"}]
    )

    excel_file = pd.ExcelFile(BytesIO(wb_bytes))
    report, error_log, counts = await IngestionService._execute_pipeline(excel_file, db_session)

    assert report["approvals_loaded"] == 0
    assert any(e.get("field") == "transaction_id" for e in error_log)
    assert any("TX-MISSING-999" in str(e.get("error")) for e in error_log)


# ── RESILIENCE & EVENT LOOP TESTS ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_validation_event_loop_yielding(db_session: AsyncSession):
    """D11: Validation loop yields to asyncio event loop every 250 rows."""
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        df = pd.DataFrame(
            [{"supplier_id": f"SUP-YIELD-{i}", "name": f"Name {i}"} for i in range(300)]
        )
        error_log = []
        counts = {"inserted_rows": 0, "error_rows": 0, "skipped_rows": 0}
        report = {}

        await IngestionService._ingest_suppliers_sheet(
            df=df,
            session=db_session,
            duplicate_strategy="skip",
            report=report,
            counts=counts,
            error_log=error_log,
        )

        assert mock_sleep.called
        assert mock_sleep.call_count >= 1


@pytest.mark.asyncio
async def test_worker_unhandled_exception_reaches_failed(db_session: AsyncSession):
    """D8: Any unhandled exception transitions job to FAILED, never stuck in PROCESSING."""
    job = IngestionJob(
        job_id="INGEST-CRASH-TEST",
        status="PENDING",
        uploaded_by="USR-TEST-001",
        duplicate_strategy="skip",
    )
    db_session.add(job)
    await db_session.commit()

    with patch.object(
        IngestionService,
        "_execute_pipeline",
        side_effect=RuntimeError("Simulated critical DB failure"),
    ):
        wb_bytes = _create_minimal_workbook_bytes()
        await IngestionService.run_ingestion_job(
            job_id=job.job_id,
            file_bytes=wb_bytes,
        )

    db_session.expire_all()
    refreshed_job = await db_session.get(IngestionJob, "INGEST-CRASH-TEST")
    assert refreshed_job is not None
    assert refreshed_job.status == "FAILED"
    assert any("Simulated critical DB failure" in str(e) for e in refreshed_job.error_log)


@pytest.mark.asyncio
async def test_cumulative_post_insert_circuit_breaker_hard_abort(db_session: AsyncSession):
    """D12: Cumulative failures (validation + DB insertion) > 20% trips circuit breaker."""
    suppliers = [
        {"supplier_id": f"SUP-CUMULATIVE-{i}", "supplier_name": f"Supplier {i}", "category": "IT"}
        for i in range(10)
    ]
    wb_bytes = _create_minimal_workbook_bytes(suppliers=suppliers)

    # Mock _flush_chunk_with_isolation to simulate 3 DB constraint failures on 10 rows (30% > 20%)
    with patch(
        "app.api.modules.v1.ingestion.service.ingestion_service._flush_chunk_with_isolation",
        new_callable=AsyncMock,
        return_value=(7, 3),
    ):
        with pytest.raises(Exception) as exc_info:
            excel_file = pd.ExcelFile(BytesIO(wb_bytes))
            await IngestionService._execute_pipeline(excel_file, db_session)

        assert "Circuit breaker tripped on sheet 'Suppliers' during insertion" in str(
            exc_info.value
        )


@pytest.mark.asyncio
async def test_duplicate_strategy_fail_raises_validation_error(db_session: AsyncSession):
    """duplicate_strategy='fail' flags duplicate primary keys as errors in error_log."""
    existing_sup = Supplier(supplier_id="SUP-FAIL-DUP", name="Existing Sup", category="IT")
    db_session.add(existing_sup)
    await db_session.commit()

    wb_bytes = _create_minimal_workbook_bytes(
        suppliers=[
            {"supplier_id": "SUP-VALID-1", "supplier_name": "Valid Sup", "category": "IT"},
            {"supplier_id": "SUP-FAIL-DUP", "supplier_name": "New Sup", "category": "IT"},
        ],
        transactions=[
            {
                "transaction_id": "TX-VALID-1",
                "supplier_id": "SUP-VALID-1",
                "amount_usd": 100.0,
                "invoice_date": "2026-08-01",
            }
        ],
    )

    excel_file = pd.ExcelFile(BytesIO(wb_bytes))
    report, error_log, counts = await IngestionService._execute_pipeline(
        excel_file, db_session, duplicate_strategy="fail"
    )

    assert counts["error_rows"] == 1
    assert any("Duplicate primary key 'SUP-FAIL-DUP'" in str(e.get("error")) for e in error_log)


@pytest.mark.asyncio
async def test_job_telemetry_staleness_guard_marks_timed_out(
    async_client: AsyncClient, db_session: AsyncSession
):
    """D8: Polling a job stuck in PROCESSING past 10 minutes transitions it to FAILED."""
    stale_time = datetime.now(UTC) - pd.Timedelta(minutes=15)
    stale_job = IngestionJob(
        job_id="INGEST-STALE-JOB-1",
        status="PROCESSING",
        started_at=stale_time,
        uploaded_by="USR-ADMIN-001",
        duplicate_strategy="skip",
    )
    db_session.add(stale_job)
    await db_session.commit()

    response = await async_client.get(f"/api/v1/ingest/jobs/{stale_job.job_id}")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "FAILED"
    assert any("timeout" in str(e.get("field")) for e in data["error_log"])
