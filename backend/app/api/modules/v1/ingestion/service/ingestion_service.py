"""
Ingestion Service for TRIS (Revision 2.2).
Handles Excel parsing, sheet validation, batch DB operations, row-level error isolation,
circuit breakers, input sanitization, and asynchronous background lifecycle management.
Pure business logic — raises domain exceptions directly.
"""

import asyncio
import logging
import re
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from typing import Any, ClassVar

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel, select

from app.api.core.custom_exceptions.exceptions import (
    IngestionError,
    NotFoundError,
    PermissionDeniedError,
)
from app.api.core.permissions import PRIVILEGED_ROLES
from app.api.db import database
from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import CaseHistory, RiskCase
from app.api.modules.v1.ingestion.models.ingestion_job import IngestionJob
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction

logger = logging.getLogger("tris.ingestion")

CONTROL_CHAR_REGEX = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
CIRCUIT_BREAKER_THRESHOLD = 0.20  # 20%
CIRCUIT_BREAKER_MIN_SAMPLES = 10
CHUNK_SIZE = 500


class CircuitBreakerTrippedError(Exception):
    """Raised when sheet validation or insertion failure rate exceeds 20%."""

    def __init__(
        self,
        sheet_name: str,
        error_count: int,
        total_rows: int,
        is_mandatory: bool,
        stage: str = "validation",
    ):
        self.sheet_name = sheet_name
        self.error_count = error_count
        self.total_rows = total_rows
        self.is_mandatory = is_mandatory
        self.stage = stage
        self.ratio = (error_count / total_rows) if total_rows > 0 else 0.0
        super().__init__(
            f"Circuit breaker tripped on sheet '{sheet_name}' during {stage}: "
            f"{error_count}/{total_rows} ({self.ratio:.1%}) rows failed (tolerance: 20%). "
            f"Action: {'ABORTING ENTIRE JOB' if is_mandatory else 'SKIPPING SHEET'}."
        )


def _to_json_safe(v: Any) -> Any:
    """Coerce pandas/numpy types to native JSON-serializable primitives (D13)."""
    if pd.isna(v):
        return None
    if isinstance(v, (pd.Timestamp, datetime, date)):
        return v.isoformat()
    if hasattr(v, "item"):  # numpy scalar types (int64, float64, bool_)
        return v.item()
    return v


def sanitize_text(value: Any, max_length: int = 255) -> str | None:
    """
    Sanitize text input (D9):
    1. Strip control characters
    2. Enforce max_length truncation
    NOTE: html.escape() is omitted to prevent DB double-encoding.
    """
    if value is None:
        return None
    raw = str(value).strip()
    if not raw or raw.lower() in ("nan", "none", "null"):
        return None
    cleaned = CONTROL_CHAR_REGEX.sub("", raw)
    return cleaned[:max_length] if cleaned else None


async def _prefetch_existing_pks(
    session: AsyncSession,
    model_cls: type,
    pk_attr_name: str,
    candidate_pks: list[str],
) -> set[str]:
    """Single bulk query to fetch all existing primary keys (O(1) roundtrips)."""
    if not candidate_pks:
        return set()
    attr = getattr(model_cls, pk_attr_name)
    stmt = select(attr).where(attr.in_(candidate_pks))
    result = await session.execute(stmt)
    return {str(row[0]) for row in result.fetchall()}


def check_circuit_breaker(
    sheet_name: str,
    total_rows: int,
    error_count: int,
    is_mandatory: bool,
    stage: str = "validation",
) -> None:
    """Evaluates circuit breaker ratio (D10 / D12)."""
    if total_rows < CIRCUIT_BREAKER_MIN_SAMPLES:
        return
    ratio = error_count / total_rows
    if ratio > CIRCUIT_BREAKER_THRESHOLD:
        raise CircuitBreakerTrippedError(
            sheet_name=sheet_name,
            error_count=error_count,
            total_rows=total_rows,
            is_mandatory=is_mandatory,
            stage=stage,
        )


async def _flush_chunk_with_isolation(
    session: AsyncSession,
    chunk: list[tuple[SQLModel, dict[str, Any]]],
    error_log: list[dict[str, Any]],
    sheet_name: str,
) -> tuple[int, int]:
    """
    Attempts bulk chunk flush in savepoint. If DB constraint fails,
    retries row-by-row inside sub-savepoints to isolate bad rows (D5).
    """
    if not chunk:
        return (0, 0)

    try:
        async with session.begin_nested():
            session.add_all([item[0] for item in chunk])
            await session.flush()
        return (len(chunk), 0)
    except Exception:
        # Fallback: isolate row-by-row
        inserted = 0
        errors = 0
        for entity, source_dict in chunk:
            try:
                async with session.begin_nested():
                    session.add(entity)
                    await session.flush()
                inserted += 1
            except Exception as row_exc:
                errors += 1
                error_log.append(
                    {
                        "sheet": sheet_name,
                        "row": getattr(entity, "_source_row_num", -1),
                        "field": "database_constraint",
                        "error": str(row_exc),
                        "raw_value": source_dict,
                    }
                )
        return (inserted, errors)


class IngestionService:
    """Handles Excel parsing, validation, batch DB operations, and async background execution."""

    REQUIRED_SHEETS: ClassVar[set[str]] = {"Suppliers", "Transactions"}

    @staticmethod
    def validate_workbook_preflight(file_bytes: bytes, filename: str | None = None) -> pd.ExcelFile:
        """Synchronous pre-flight check before accepting upload."""
        if filename:
            clean_name = filename.strip().lower()
            if not (clean_name.endswith(".xlsx") or clean_name.endswith(".xls")):
                raise IngestionError(
                    f"Unsupported file format '{filename}'. "
                    "Only .xlsx and .xls Excel workbooks are permitted."
                )

        try:
            excel_file = pd.ExcelFile(BytesIO(file_bytes))
        except Exception as exc:
            raise IngestionError(f"Unable to read file as an Excel workbook: {exc}") from exc

        sheet_names = set(excel_file.sheet_names)
        missing_sheets = IngestionService.REQUIRED_SHEETS - sheet_names
        if missing_sheets:
            sorted_missing = sorted(list(missing_sheets))
            sorted_found = sorted(list(sheet_names))
            raise IngestionError(
                "Invalid TRIS dataset format: workbook is missing mandatory sheets: "
                f"{sorted_missing}. Found sheets: {sorted_found}."
            )

        return excel_file

    @staticmethod
    async def run_ingestion_job(
        job_id: str,
        file_bytes: bytes,
        duplicate_strategy: str = "skip",
        session_factory=None,
    ) -> None:
        """
        Background task worker executing workbook ingestion in an isolated session (D4, D8).
        """
        factory = session_factory or database.async_session_factory
        async with factory() as session:
            job = None
            for _ in range(5):
                job = await session.get(IngestionJob, job_id)
                if job:
                    break
                await asyncio.sleep(0.1)

            if not job:
                logger.error(f"Ingestion job '{job_id}' not found in database after retries.")
                return

            job.status = "PROCESSING"
            job.started_at = datetime.now(UTC)
            await session.commit()

            try:
                excel_file = pd.ExcelFile(BytesIO(file_bytes))
                report, error_log, counts = await IngestionService._execute_pipeline(
                    excel_file=excel_file,
                    session=session,
                    duplicate_strategy=duplicate_strategy,
                )

                job.summary_report = report
                job.error_log = error_log[:200]  # Cap at 200 entries to prevent oversized payloads
                job.total_rows = counts["total_rows"]
                job.processed_rows = counts["processed_rows"]
                job.inserted_rows = counts["inserted_rows"]
                job.updated_rows = counts["updated_rows"]
                job.skipped_rows = counts["skipped_rows"]
                job.error_rows = counts["error_rows"]
                job.completed_at = datetime.now(UTC)

                if job.error_rows > 0:
                    job.status = "COMPLETED_WITH_ERRORS"
                else:
                    job.status = "COMPLETED"

                # Emit notification
                from app.api.modules.v1.notifications.service.notification_service import (
                    NotificationService,
                )

                notif_severity = "SUCCESS" if job.status == "COMPLETED" else "WARNING"
                if job.status == "COMPLETED":
                    notif_msg = (
                        f"Dataset '{job.filename}' processed successfully "
                        f"({job.inserted_rows} inserted, {job.skipped_rows} skipped)."
                    )
                else:
                    notif_msg = (
                        f"Dataset '{job.filename}' processed with {job.error_rows} "
                        f"isolated errors ({job.inserted_rows} inserted)."
                    )
                await NotificationService.emit(
                    db=session,
                    title=f"Ingestion Job {job.job_id} {job.status.replace('_', ' ').title()}",
                    message=notif_msg,
                    category="INGESTION_JOB",
                    severity=notif_severity,
                    recipient_user_id=job.uploaded_by,
                    link_url="/ingestion",
                    metadata_json={"job_id": job.job_id, "status": job.status},
                )

                await session.commit()

            except CircuitBreakerTrippedError as cb_exc:
                logger.warning(f"Circuit breaker tripped for job '{job_id}': {cb_exc}")
                await session.rollback()
                job = await session.get(IngestionJob, job_id)
                if job:
                    job.status = "FAILED"
                    job.completed_at = datetime.now(UTC)
                    current_log = list(job.error_log or [])
                    current_log.append(
                        {
                            "sheet": cb_exc.sheet_name,
                            "row": -1,
                            "field": "circuit_breaker",
                            "error": str(cb_exc),
                            "raw_value": {},
                        }
                    )
                    job.error_log = current_log

                    from app.api.modules.v1.notifications.service.notification_service import (
                        NotificationService,
                    )

                    await NotificationService.emit(
                        db=session,
                        title=f"Ingestion Job {job.job_id} Circuit Breaker Tripped",
                        message=f"Job aborted: {cb_exc}",
                        category="INGESTION_JOB",
                        severity="CRITICAL",
                        recipient_user_id=job.uploaded_by,
                        link_url="/ingestion",
                        metadata_json={"job_id": job.job_id, "error": str(cb_exc)},
                    )

                    await session.commit()

            except Exception as exc:
                logger.exception(f"Unexpected error in background ingestion job '{job_id}': {exc}")
                await session.rollback()
                job = await session.get(IngestionJob, job_id)
                if job:
                    job.status = "FAILED"
                    job.completed_at = datetime.now(UTC)
                    current_log = list(job.error_log or [])
                    current_log.append(
                        {
                            "sheet": "General",
                            "row": -1,
                            "field": "unhandled_exception",
                            "error": str(exc),
                            "raw_value": {},
                        }
                    )
                    job.error_log = current_log

                    from app.api.modules.v1.notifications.service.notification_service import (
                        NotificationService,
                    )

                    await NotificationService.emit(
                        db=session,
                        title=f"Ingestion Job {job.job_id} Failed",
                        message=f"Unexpected error during workbook processing: {exc}",
                        category="INGESTION_JOB",
                        severity="CRITICAL",
                        recipient_user_id=job.uploaded_by,
                        link_url="/ingestion",
                        metadata_json={"job_id": job.job_id, "error": str(exc)},
                    )

                    await session.commit()

    @staticmethod
    async def ingest_excel_workbook(
        file_path_or_bytes: Any,
        session: AsyncSession,
        filename: str | None = None,
        duplicate_strategy: str = "skip",
    ) -> dict[str, Any]:
        """
        Synchronous entry point used by test suites and CLI seed scripts.
        """
        if isinstance(file_path_or_bytes, bytes):
            bytes_data = file_path_or_bytes
        elif hasattr(file_path_or_bytes, "read"):
            bytes_data = file_path_or_bytes.read()
        else:
            with open(file_path_or_bytes, "rb") as f:
                bytes_data = f.read()

        excel_file = IngestionService.validate_workbook_preflight(bytes_data, filename)
        report, error_log, counts = await IngestionService._execute_pipeline(
            excel_file=excel_file,
            session=session,
            duplicate_strategy=duplicate_strategy,
        )
        return report

    @staticmethod
    async def _execute_pipeline(
        excel_file: pd.ExcelFile,
        session: AsyncSession,
        duplicate_strategy: str = "skip",
    ) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, int]]:
        sheet_names = set(excel_file.sheet_names)
        error_log: list[dict[str, Any]] = []
        counts = {
            "total_rows": 0,
            "processed_rows": 0,
            "inserted_rows": 0,
            "updated_rows": 0,
            "skipped_rows": 0,
            "error_rows": 0,
        }
        report: dict[str, Any] = {
            "suppliers_loaded": 0,
            "transactions_loaded": 0,
            "approvals_loaded": 0,
            "access_events_loaded": 0,
            "rules_loaded": 0,
            "cases_loaded": 0,
        }

        # ── 1. MANDATORY SHEET: Suppliers ───────────────────────────────────
        df_sup = excel_file.parse("Suppliers")
        counts["total_rows"] += len(df_sup)
        counts["processed_rows"] += len(df_sup)

        known_supplier_ids = await IngestionService._ingest_suppliers_sheet(
            df=df_sup,
            session=session,
            duplicate_strategy=duplicate_strategy,
            report=report,
            counts=counts,
            error_log=error_log,
        )

        # ── 2. MANDATORY SHEET: Transactions ────────────────────────────────
        df_tx = excel_file.parse("Transactions")
        counts["total_rows"] += len(df_tx)
        counts["processed_rows"] += len(df_tx)

        known_transaction_ids = await IngestionService._ingest_transactions_sheet(
            df=df_tx,
            session=session,
            duplicate_strategy=duplicate_strategy,
            known_supplier_ids=known_supplier_ids,
            report=report,
            counts=counts,
            error_log=error_log,
        )

        if (
            report["suppliers_loaded"] == 0
            and report["transactions_loaded"] == 0
            and counts["skipped_rows"] == 0
        ):
            raise IngestionError(
                "Uploaded workbook contains 0 valid supplier or transaction records to ingest."
            )

        # ── 3. OPTIONAL SHEET: Approvals ────────────────────────────────────
        if "Approvals" in sheet_names:
            df_app = excel_file.parse("Approvals")
            counts["total_rows"] += len(df_app)
            counts["processed_rows"] += len(df_app)
            await IngestionService._ingest_approvals_sheet(
                df=df_app,
                session=session,
                duplicate_strategy=duplicate_strategy,
                known_transaction_ids=known_transaction_ids,
                report=report,
                counts=counts,
                error_log=error_log,
            )

        # ── 4. OPTIONAL SHEET: Access_Events ────────────────────────────────
        if "Access_Events" in sheet_names:
            df_ae = excel_file.parse("Access_Events")
            counts["total_rows"] += len(df_ae)
            counts["processed_rows"] += len(df_ae)
            await IngestionService._ingest_access_events_sheet(
                df=df_ae,
                session=session,
                duplicate_strategy=duplicate_strategy,
                report=report,
                counts=counts,
                error_log=error_log,
            )

        # ── 5. OPTIONAL SHEET: Demo_Rules ───────────────────────────────────
        if "Demo_Rules" in sheet_names:
            df_rules = excel_file.parse("Demo_Rules")
            counts["total_rows"] += len(df_rules)
            counts["processed_rows"] += len(df_rules)
            await IngestionService._ingest_demo_rules_sheet(
                df=df_rules,
                session=session,
                duplicate_strategy=duplicate_strategy,
                report=report,
                counts=counts,
                error_log=error_log,
            )

        # ── 6. OPTIONAL SHEET: Expected_Cases (Strictly Insert-Only D3) ─────
        if "Expected_Cases" in sheet_names:
            df_cases = excel_file.parse("Expected_Cases")
            counts["total_rows"] += len(df_cases)
            counts["processed_rows"] += len(df_cases)
            await IngestionService._ingest_expected_cases_sheet(
                df=df_cases,
                session=session,
                report=report,
                counts=counts,
                error_log=error_log,
            )

        return report, error_log, counts

    # ── SHEET PROCESSING IMPLEMENTATIONS ────────────────────────────────────

    @staticmethod
    async def _ingest_suppliers_sheet(
        df: pd.DataFrame,
        session: AsyncSession,
        duplicate_strategy: str,
        report: dict[str, Any],
        counts: dict[str, int],
        error_log: list[dict[str, Any]],
    ) -> set[str]:
        sheet_name = "Suppliers"
        sup_cols = set(df.columns)
        if "supplier_id" not in sup_cols or not ({"supplier_name", "name"} & sup_cols):
            raise IngestionError(
                f"Sheet 'Suppliers' is missing mandatory columns. Found: {list(df.columns)}"
            )

        raw_ids = [str(r).strip() for r in df["supplier_id"].dropna().unique() if str(r).strip()]
        existing_pks = await _prefetch_existing_pks(session, Supplier, "supplier_id", raw_ids)

        chunk: list[tuple[SQLModel, dict[str, Any]]] = []
        validation_errors = 0
        total_rows = len(df)

        for idx, row in df.iterrows():
            spreadsheet_row_num = idx + 2
            source_dict = {k: _to_json_safe(v) for k, v in row.to_dict().items()}

            sup_id = sanitize_text(row.get("supplier_id"), max_length=50)
            if not sup_id:
                counts["skipped_rows"] += 1
                continue

            name_col = "supplier_name" if "supplier_name" in row else "name"
            sup_name = sanitize_text(row.get(name_col), max_length=255)
            if not sup_name:
                validation_errors += 1
                counts["error_rows"] += 1
                error_log.append(
                    {
                        "sheet": sheet_name,
                        "row": spreadsheet_row_num,
                        "field": name_col,
                        "error": "Supplier name is mandatory",
                        "raw_value": source_dict,
                    }
                )
                continue

            if sup_id in existing_pks:
                if duplicate_strategy == "skip":
                    counts["skipped_rows"] += 1
                    continue
                elif duplicate_strategy == "fail":
                    validation_errors += 1
                    counts["error_rows"] += 1
                    error_log.append(
                        {
                            "sheet": sheet_name,
                            "row": spreadsheet_row_num,
                            "field": "supplier_id",
                            "error": (
                                f"Duplicate primary key '{sup_id}' encountered under strategy=fail"
                            ),
                            "raw_value": source_dict,
                        }
                    )
                    continue

            bank_change = row.get("bank_change_date")
            bank_change_date = None
            if pd.notna(bank_change):
                try:
                    bank_change_date = pd.to_datetime(bank_change).date()
                except Exception as e:
                    validation_errors += 1
                    counts["error_rows"] += 1
                    error_log.append(
                        {
                            "sheet": sheet_name,
                            "row": spreadsheet_row_num,
                            "field": "bank_change_date",
                            "error": f"Invalid date format: {e}",
                            "raw_value": source_dict,
                        }
                    )
                    continue

            supplier = Supplier(
                supplier_id=sup_id,
                name=sup_name,
                category=sanitize_text(row.get("category", "General"), max_length=100) or "General",
                risk_tier=sanitize_text(row.get("risk_tier", "Medium"), max_length=50) or "Medium",
                bank_account=sanitize_text(row.get("bank_account"), max_length=100),
                routing_number=sanitize_text(row.get("routing_number"), max_length=50),
                bank_change_date=bank_change_date,
                bank_change_reason=sanitize_text(row.get("bank_change_reason")),
                status="Active" if row.get("active", True) else "Suspended",
                notes=sanitize_text(row.get("notes")),
            )
            supplier._source_row_num = spreadsheet_row_num
            chunk.append((supplier, source_dict))

            # Event loop yield every 250 rows (D11)
            if idx > 0 and idx % 250 == 0:
                await asyncio.sleep(0)

        # D10: Pre-validation Circuit Breaker
        check_circuit_breaker(
            sheet_name, total_rows, validation_errors, is_mandatory=True, stage="validation"
        )

        # Flush chunk with savepoint isolation (D5)
        inserted, db_errors = await _flush_chunk_with_isolation(
            session, chunk, error_log, sheet_name
        )
        counts["inserted_rows"] += inserted
        counts["error_rows"] += db_errors
        report["suppliers_loaded"] = inserted

        # D12: Cumulative Post-Insert Circuit Breaker
        total_failures = validation_errors + db_errors
        check_circuit_breaker(
            sheet_name, total_rows, total_failures, is_mandatory=True, stage="insertion"
        )

        # Build known suppliers set (existing in DB + newly inserted)
        all_db_sups = await session.execute(select(Supplier.supplier_id))
        return {str(r[0]) for r in all_db_sups.fetchall()}

    @staticmethod
    async def _ingest_transactions_sheet(
        df: pd.DataFrame,
        session: AsyncSession,
        duplicate_strategy: str,
        known_supplier_ids: set[str],
        report: dict[str, Any],
        counts: dict[str, int],
        error_log: list[dict[str, Any]],
    ) -> set[str]:
        sheet_name = "Transactions"
        tx_cols = set(df.columns)
        if (
            "transaction_id" not in tx_cols
            or "supplier_id" not in tx_cols
            or not ({"amount_usd", "amount"} & tx_cols)
        ):
            raise IngestionError(
                f"Sheet 'Transactions' is missing mandatory columns. Found: {list(df.columns)}"
            )

        raw_ids = [str(r).strip() for r in df["transaction_id"].dropna().unique() if str(r).strip()]
        existing_pks = await _prefetch_existing_pks(session, Transaction, "transaction_id", raw_ids)

        chunk: list[tuple[SQLModel, dict[str, Any]]] = []
        validation_errors = 0
        total_rows = len(df)

        for idx, row in df.iterrows():
            spreadsheet_row_num = idx + 2
            source_dict = {k: _to_json_safe(v) for k, v in row.to_dict().items()}

            tx_id = sanitize_text(row.get("transaction_id"), max_length=50)
            if not tx_id:
                counts["skipped_rows"] += 1
                continue

            sup_id = sanitize_text(row.get("supplier_id"), max_length=50)
            # Referential Integrity Check (D7)
            if sup_id not in known_supplier_ids:
                validation_errors += 1
                counts["error_rows"] += 1
                error_log.append(
                    {
                        "sheet": sheet_name,
                        "row": spreadsheet_row_num,
                        "field": "supplier_id",
                        "error": (
                            f"Referential integrity failure: Supplier '{sup_id}' does not exist."
                        ),
                        "raw_value": source_dict,
                    }
                )
                continue

            if tx_id in existing_pks:
                if duplicate_strategy == "skip":
                    counts["skipped_rows"] += 1
                    continue
                elif duplicate_strategy == "fail":
                    validation_errors += 1
                    counts["error_rows"] += 1
                    error_log.append(
                        {
                            "sheet": sheet_name,
                            "row": spreadsheet_row_num,
                            "field": "transaction_id",
                            "error": (
                                f"Duplicate primary key '{tx_id}' encountered under strategy=fail"
                            ),
                            "raw_value": source_dict,
                        }
                    )
                    continue

            amount_col = "amount_usd" if "amount_usd" in row else "amount"
            try:
                amount_val = float(row.get(amount_col, 0.0))
            except Exception as e:
                validation_errors += 1
                counts["error_rows"] += 1
                error_log.append(
                    {
                        "sheet": sheet_name,
                        "row": spreadsheet_row_num,
                        "field": amount_col,
                        "error": f"Invalid amount format: {e}",
                        "raw_value": source_dict,
                    }
                )
                continue

            inv_date_raw = row.get("invoice_date")
            try:
                inv_date = pd.to_datetime(inv_date_raw).date()
            except Exception as e:
                validation_errors += 1
                counts["error_rows"] += 1
                error_log.append(
                    {
                        "sheet": sheet_name,
                        "row": spreadsheet_row_num,
                        "field": "invoice_date",
                        "error": f"Invalid invoice date format: {e}",
                        "raw_value": source_dict,
                    }
                )
                continue

            post_date = None
            if pd.notna(row.get("posting_date")):
                try:
                    post_date = pd.to_datetime(row.get("posting_date")).date()
                except Exception:
                    post_date = None

            tx = Transaction(
                transaction_id=tx_id,
                supplier_id=sup_id,
                invoice_number=sanitize_text(
                    row.get("invoice_no", row.get("invoice_number", "")), max_length=100
                )
                or "",
                amount=amount_val,
                currency=sanitize_text(row.get("currency", "USD"), max_length=10) or "USD",
                invoice_date=inv_date,
                posting_date=post_date,
                approval_required=bool(row.get("approval_required", True)),
                approval_status=sanitize_text(row.get("approval_status", "Approved"), max_length=50)
                or "Approved",
                payment_status=sanitize_text(row.get("payment_status", "Pending"), max_length=50)
                or "Pending",
                description=sanitize_text(row.get("description")),
            )
            tx._source_row_num = spreadsheet_row_num
            chunk.append((tx, source_dict))

            if idx > 0 and idx % 250 == 0:
                await asyncio.sleep(0)

        check_circuit_breaker(
            sheet_name, total_rows, validation_errors, is_mandatory=True, stage="validation"
        )

        inserted, db_errors = await _flush_chunk_with_isolation(
            session, chunk, error_log, sheet_name
        )
        counts["inserted_rows"] += inserted
        counts["error_rows"] += db_errors
        report["transactions_loaded"] = inserted

        total_failures = validation_errors + db_errors
        check_circuit_breaker(
            sheet_name, total_rows, total_failures, is_mandatory=True, stage="insertion"
        )

        all_db_txs = await session.execute(select(Transaction.transaction_id))
        return {str(r[0]) for r in all_db_txs.fetchall()}

    @staticmethod
    async def _ingest_approvals_sheet(
        df: pd.DataFrame,
        session: AsyncSession,
        duplicate_strategy: str,
        known_transaction_ids: set[str],
        report: dict[str, Any],
        counts: dict[str, int],
        error_log: list[dict[str, Any]],
    ) -> None:
        sheet_name = "Approvals"
        raw_ids = [
            str(r).strip()
            for r in df.get("approval_id", pd.Series()).dropna().unique()
            if str(r).strip()
        ]
        existing_pks = await _prefetch_existing_pks(session, Approval, "approval_id", raw_ids)

        chunk: list[tuple[SQLModel, dict[str, Any]]] = []
        validation_errors = 0
        total_rows = len(df)

        for idx, row in df.iterrows():
            spreadsheet_row_num = idx + 2
            source_dict = {k: _to_json_safe(v) for k, v in row.to_dict().items()}

            app_id = sanitize_text(row.get("approval_id"), max_length=50)
            if not app_id:
                counts["skipped_rows"] += 1
                continue

            tx_id = sanitize_text(row.get("transaction_id"), max_length=50)
            # Referential Pre-flight for Approvals -> Transactions (D7)
            if tx_id not in known_transaction_ids:
                validation_errors += 1
                counts["error_rows"] += 1
                error_log.append(
                    {
                        "sheet": sheet_name,
                        "row": spreadsheet_row_num,
                        "field": "transaction_id",
                        "error": (
                            f"Referential integrity failure: Transaction '{tx_id}' does not exist."
                        ),
                        "raw_value": source_dict,
                    }
                )
                continue

            if app_id in existing_pks and duplicate_strategy == "skip":
                counts["skipped_rows"] += 1
                continue

            app_date = None
            if pd.notna(row.get("approval_date")):
                try:
                    app_date = pd.to_datetime(row.get("approval_date"))
                except Exception:
                    app_date = None

            app_entity = Approval(
                approval_id=app_id,
                transaction_id=tx_id,
                required_level=sanitize_text(row.get("required_level", "Level 1"), max_length=50)
                or "Level 1",
                approver_role=sanitize_text(row.get("approver_role")),
                approval_status=sanitize_text(row.get("approval_status", "Missing"), max_length=50)
                or "Missing",
                approval_date=app_date,
                notes=sanitize_text(row.get("notes")),
            )
            app_entity._source_row_num = spreadsheet_row_num
            chunk.append((app_entity, source_dict))

            if idx > 0 and idx % 250 == 0:
                await asyncio.sleep(0)

        # Soft abort on optional sheet if breaker trips (D6)
        try:
            check_circuit_breaker(
                sheet_name, total_rows, validation_errors, is_mandatory=False, stage="validation"
            )
            inserted, db_errors = await _flush_chunk_with_isolation(
                session, chunk, error_log, sheet_name
            )
            counts["inserted_rows"] += inserted
            counts["error_rows"] += db_errors
            report["approvals_loaded"] = inserted
            check_circuit_breaker(
                sheet_name,
                total_rows,
                validation_errors + db_errors,
                is_mandatory=False,
                stage="insertion",
            )
        except CircuitBreakerTrippedError as cb_soft:
            logger.warning(f"Soft circuit breaker tripped on sheet '{sheet_name}': {cb_soft}")
            report["approvals_loaded"] = 0

    @staticmethod
    async def _ingest_access_events_sheet(
        df: pd.DataFrame,
        session: AsyncSession,
        duplicate_strategy: str,
        report: dict[str, Any],
        counts: dict[str, int],
        error_log: list[dict[str, Any]],
    ) -> None:
        sheet_name = "Access_Events"
        raw_ids = [
            str(r).strip()
            for r in df.get("event_id", pd.Series()).dropna().unique()
            if str(r).strip()
        ]
        existing_pks = await _prefetch_existing_pks(session, AccessEvent, "event_id", raw_ids)

        chunk: list[tuple[SQLModel, dict[str, Any]]] = []
        validation_errors = 0
        total_rows = len(df)

        for idx, row in df.iterrows():
            spreadsheet_row_num = idx + 2
            source_dict = {k: _to_json_safe(v) for k, v in row.to_dict().items()}

            event_id = sanitize_text(row.get("event_id"), max_length=50)
            if not event_id:
                counts["skipped_rows"] += 1
                continue

            if event_id in existing_pks and duplicate_strategy == "skip":
                counts["skipped_rows"] += 1
                continue

            try:
                event_time = pd.to_datetime(row.get("event_time"))
            except Exception as e:
                validation_errors += 1
                counts["error_rows"] += 1
                error_log.append(
                    {
                        "sheet": sheet_name,
                        "row": spreadsheet_row_num,
                        "field": "event_time",
                        "error": f"Invalid event timestamp: {e}",
                        "raw_value": source_dict,
                    }
                )
                continue

            hour = event_time.hour
            is_off_hours = hour < 6 or hour >= 20

            ae = AccessEvent(
                event_id=event_id,
                user_id=sanitize_text(row.get("user_id", ""), max_length=50) or "UNKNOWN",
                event_time=event_time,
                system=sanitize_text(row.get("system", "ERP"), max_length=50) or "ERP",
                action=sanitize_text(row.get("action", "View"), max_length=50) or "View",
                resource=sanitize_text(row.get("resource", ""), max_length=100) or "",
                supplier_id=sanitize_text(row.get("supplier_id"), max_length=50),
                result=sanitize_text(row.get("result", "Success"), max_length=50) or "Success",
                location_context=sanitize_text(row.get("location_context"), max_length=100),
                notes=sanitize_text(row.get("notes")),
                flagged=is_off_hours,
            )
            ae._source_row_num = spreadsheet_row_num
            chunk.append((ae, source_dict))

            if idx > 0 and idx % 250 == 0:
                await asyncio.sleep(0)

        try:
            check_circuit_breaker(
                sheet_name, total_rows, validation_errors, is_mandatory=False, stage="validation"
            )
            inserted, db_errors = await _flush_chunk_with_isolation(
                session, chunk, error_log, sheet_name
            )
            counts["inserted_rows"] += inserted
            counts["error_rows"] += db_errors
            report["access_events_loaded"] = inserted
            check_circuit_breaker(
                sheet_name,
                total_rows,
                validation_errors + db_errors,
                is_mandatory=False,
                stage="insertion",
            )
        except CircuitBreakerTrippedError as cb_soft:
            logger.warning(f"Soft circuit breaker tripped on sheet '{sheet_name}': {cb_soft}")
            report["access_events_loaded"] = 0

    @staticmethod
    async def _ingest_demo_rules_sheet(
        df: pd.DataFrame,
        session: AsyncSession,
        duplicate_strategy: str,
        report: dict[str, Any],
        counts: dict[str, int],
        error_log: list[dict[str, Any]],
    ) -> None:
        sheet_name = "Demo_Rules"
        default_configs = {
            "R-001": {"multiplier": 2.0, "exclude_target": True},
            "R-002": {"lookback_days": 7},
            "R-003": {"required_level": "Level 3", "threshold_amount": 50000.0},
            "R-004": {"start_hour": 6, "end_hour": 20},
            "R-005": {"window_days": 30},
            "R-006": {"lookback_days": 90},
        }

        raw_ids = [
            str(r).strip()
            for r in df.get("rule_id", pd.Series()).dropna().unique()
            if str(r).strip()
        ]
        existing_pks = await _prefetch_existing_pks(session, RuleConfig, "rule_code", raw_ids)

        chunk: list[tuple[SQLModel, dict[str, Any]]] = []
        validation_errors = 0
        total_rows = len(df)

        for idx, row in df.iterrows():
            spreadsheet_row_num = idx + 2
            source_dict = {k: _to_json_safe(v) for k, v in row.to_dict().items()}

            rule_code = sanitize_text(row.get("rule_id"), max_length=50)
            if not rule_code:
                counts["skipped_rows"] += 1
                continue

            if rule_code in existing_pks and duplicate_strategy == "skip":
                counts["skipped_rows"] += 1
                continue

            rule = RuleConfig(
                rule_code=rule_code,
                name=sanitize_text(row.get("rule_name", rule_code), max_length=100) or rule_code,
                description=sanitize_text(row.get("example_reason_text", "")),
                weight=int(row.get("default_weight", 20)),
                threshold_params=default_configs.get(rule_code, {}),
                rule_version=1,
                is_active=True,
            )
            rule._source_row_num = spreadsheet_row_num
            chunk.append((rule, source_dict))

            if idx > 0 and idx % 250 == 0:
                await asyncio.sleep(0)

        try:
            check_circuit_breaker(
                sheet_name, total_rows, validation_errors, is_mandatory=False, stage="validation"
            )
            inserted, db_errors = await _flush_chunk_with_isolation(
                session, chunk, error_log, sheet_name
            )
            counts["inserted_rows"] += inserted
            counts["error_rows"] += db_errors
            report["rules_loaded"] = inserted
            check_circuit_breaker(
                sheet_name,
                total_rows,
                validation_errors + db_errors,
                is_mandatory=False,
                stage="insertion",
            )
        except CircuitBreakerTrippedError as cb_soft:
            logger.warning(f"Soft circuit breaker tripped on sheet '{sheet_name}': {cb_soft}")
            report["rules_loaded"] = 0

    @staticmethod
    async def _ingest_expected_cases_sheet(
        df: pd.DataFrame,
        session: AsyncSession,
        report: dict[str, Any],
        counts: dict[str, int],
        error_log: list[dict[str, Any]],
    ) -> None:
        """
        Expected_Cases sheet is STRICTLY insert-if-not-exists (D3 invariant).
        Existing RiskCases are never mutated via workbook upload.
        """
        raw_ids = [
            str(r).strip()
            for r in df.get("case_id", pd.Series()).dropna().unique()
            if str(r).strip()
        ]
        existing_pks = await _prefetch_existing_pks(session, RiskCase, "case_id", raw_ids)

        inserted_cases = 0

        for _idx, row in df.iterrows():
            case_id = sanitize_text(row.get("case_id"), max_length=50)
            if not case_id:
                counts["skipped_rows"] += 1
                continue

            # D3: Strict non-mutation of existing cases
            if case_id in existing_pks:
                counts["skipped_rows"] += 1
                continue

            case = RiskCase(
                case_id=case_id,
                case_number=f"CASE-{case_id.replace('TEST-CASE-', '2026-')}",
                priority=sanitize_text(row.get("expected_priority", "High"), max_length=20)
                or "High",
                status="New",
                supplier_id=sanitize_text(row.get("supplier_id"), max_length=50),
                transaction_id=sanitize_text(row.get("primary_record"), max_length=50),
                trigger_signals=[
                    {"rule_code": flag.strip()}
                    for flag in str(row.get("expected_flags", "")).split(";")
                    if flag.strip()
                ],
                evaluation_snapshot={
                    "explanation": str(row.get("expected_explanation", "")),
                    "next_action": str(row.get("expected_next_action", "")),
                },
            )
            session.add(case)
            await session.flush()

            history = CaseHistory(
                case_id=case_id,
                actor="System / Ingestion Engine",
                action="Case Generated",
                previous_status=None,
                new_status="New",
                note=(
                    "Imported from synthetic test dataset. "
                    f"Target transaction: {row.get('primary_record')}"
                ),
            )
            session.add(history)
            await session.flush()

            inserted_cases += 1
            counts["inserted_rows"] += 1

        report["cases_loaded"] = inserted_cases

    @staticmethod
    async def list_jobs_for_user(
        session: AsyncSession,
        user: User,
        limit: int = 20,
        offset: int = 0,
    ) -> list[IngestionJob]:
        """
        List historical ingestion jobs with pagination.
        Privileged roles (admin, compliance) view all jobs; others see their own.
        """
        stmt = select(IngestionJob).order_by(IngestionJob.created_at.desc())
        is_privileged = user.role.lower() in [r.value for r in PRIVILEGED_ROLES]
        if not is_privileged:
            stmt = stmt.where(IngestionJob.uploaded_by == user.user_id)

        stmt = stmt.limit(limit).offset(offset)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_job_for_user(
        session: AsyncSession,
        user: User,
        job_id: str,
        timeout_minutes: int = 10,
    ) -> IngestionJob:
        """
        Telemetry and audit query for an ingestion job with ownership enforcement.
        Privileged roles (admin, compliance) or job owners have access.
        Applies lightweight staleness guard.
        """
        job = await session.get(IngestionJob, job_id)
        if not job:
            raise NotFoundError(f"Ingestion job '{job_id}' was not found.")

        is_owner = user.user_id == job.uploaded_by
        is_privileged = user.role.lower() in [r.value for r in PRIVILEGED_ROLES]
        if not (is_owner or is_privileged):
            raise PermissionDeniedError(
                f"You do not have permission to view telemetry for ingestion job '{job_id}'."
            )

        # Lightweight staleness guard (D8)
        if job.status == "PROCESSING" and job.started_at:
            now = datetime.now(UTC)
            started = (
                job.started_at if job.started_at.tzinfo else job.started_at.replace(tzinfo=UTC)
            )
            if now - started > timedelta(minutes=timeout_minutes):
                job.status = "FAILED"
                job.completed_at = now
                job.error_log.append(
                    {
                        "sheet": "General",
                        "row": -1,
                        "field": "timeout",
                        "error": (
                            f"Job processing exceeded maximum allowed timeout of "
                            f"{timeout_minutes} minutes."
                        ),
                        "raw_value": {},
                    }
                )
                session.add(job)
                await session.flush()

        return job
