"""
Ingestion Service for TRIS.
Parses, validates, and populates PostgreSQL tables from synthetic Excel workbooks.
Pure business logic — raises domain exceptions directly.
"""

from typing import Any, ClassVar

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import IngestionError
from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.cases.models.risk_case import CaseHistory, RiskCase
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction


class IngestionService:
    """Handles Excel parsing, sheet validation, and database population."""

    REQUIRED_SHEETS: ClassVar[set[str]] = {"Suppliers", "Transactions"}
    REQUIRED_SUPPLIER_COLUMNS: ClassVar[set[str]] = {"supplier_id", "name"}
    REQUIRED_TRANSACTION_COLUMNS: ClassVar[set[str]] = {
        "transaction_id",
        "supplier_id",
        "amount",
    }

    @staticmethod
    async def ingest_excel_workbook(
        file_path_or_bytes: Any,
        session: AsyncSession,
        filename: str | None = None,
    ) -> dict[str, Any]:
        """
        Parses and validates all sheets of TRIS enterprise workbook.

        Args:
            file_path_or_bytes: Path to .xlsx file or BytesIO object.
            session: Async database session.
            filename: Optional original filename for extension validation.

        Returns:
            Dict[str, Any]: Ingestion summary report.

        Raises:
            IngestionError: If file cannot be read, format is invalid, or schema is missing.
        """
        if filename:
            clean_name = filename.strip().lower()
            if not (clean_name.endswith(".xlsx") or clean_name.endswith(".xls")):
                raise IngestionError(
                    f"Unsupported file format '{filename}'. "
                    "Only .xlsx and .xls Excel workbooks are permitted."
                )

        try:
            excel_file = pd.ExcelFile(file_path_or_bytes)
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

        report: dict[str, Any] = {
            "suppliers_loaded": 0,
            "transactions_loaded": 0,
            "approvals_loaded": 0,
            "access_events_loaded": 0,
            "rules_loaded": 0,
            "cases_loaded": 0,
        }

        # 1. Ingest Suppliers (Mandatory sheet)
        df_sup = excel_file.parse("Suppliers")
        sup_cols = set(df_sup.columns)
        if "supplier_id" not in sup_cols or not ({"supplier_name", "name"} & sup_cols):
            cols = list(df_sup.columns)
            raise IngestionError(
                "Sheet 'Suppliers' is missing mandatory columns. "
                f"Must include 'supplier_id' and 'supplier_name' (or 'name'). Found: {cols}"
            )
        report["suppliers_loaded"] = await IngestionService._ingest_suppliers(df_sup, session)

        # 2. Ingest Transactions (Mandatory sheet)
        df_tx = excel_file.parse("Transactions")
        tx_cols = set(df_tx.columns)
        if (
            "transaction_id" not in tx_cols
            or "supplier_id" not in tx_cols
            or not ({"amount_usd", "amount"} & tx_cols)
        ):
            raise IngestionError(
                "Sheet 'Transactions' is missing mandatory columns. "
                "Must include 'transaction_id', 'supplier_id', and 'amount_usd' (or 'amount'). "
                f"Found: {list(df_tx.columns)}"
            )
        report["transactions_loaded"] = await IngestionService._ingest_transactions(
            df_tx, session
        )

        # 3. Check for at least 1 record in core sheets
        if report["suppliers_loaded"] == 0 and report["transactions_loaded"] == 0:
            raise IngestionError(
                "Uploaded workbook contains 0 valid supplier or transaction records to ingest."
            )

        # 4. Ingest Approvals (Optional sheet)
        if "Approvals" in sheet_names:
            df_app = excel_file.parse("Approvals")
            report["approvals_loaded"] = await IngestionService._ingest_approvals(df_app, session)

        # 5. Ingest Access Events (Optional sheet)
        if "Access_Events" in sheet_names:
            df_ae = excel_file.parse("Access_Events")
            report["access_events_loaded"] = await IngestionService._ingest_access_events(
                df_ae, session
            )

        # 6. Ingest Demo Rules (Optional sheet)
        if "Demo_Rules" in sheet_names:
            df_rules = excel_file.parse("Demo_Rules")
            report["rules_loaded"] = await IngestionService._ingest_rules(df_rules, session)

        # 7. Ingest Initial Cases & Workflow Samples (Optional sheet)
        if "Expected_Cases" in sheet_names:
            df_cases = excel_file.parse("Expected_Cases")
            report["cases_loaded"] = await IngestionService._ingest_expected_cases(
                df_cases, session
            )

        await session.commit()
        return report

    @staticmethod
    async def _ingest_suppliers(df: pd.DataFrame, session: AsyncSession) -> int:
        count = 0
        for _, row in df.iterrows():
            sup_id = str(row.get("supplier_id", "")).strip()
            if not sup_id or pd.isna(sup_id):
                continue

            bank_change = row.get("bank_change_date")
            bank_change_date = None
            if pd.notna(bank_change):
                bank_change_date = pd.to_datetime(bank_change).date()

            supplier = await session.get(Supplier, sup_id)
            if not supplier:
                supplier = Supplier(
                    supplier_id=sup_id,
                    name=str(row.get("supplier_name", sup_id)),
                    category=str(row.get("category", "General")),
                    risk_tier=str(row.get("risk_tier", "Medium")),
                    bank_change_date=bank_change_date,
                    bank_change_reason=str(row.get("bank_change_reason", ""))
                    if pd.notna(row.get("bank_change_reason"))
                    else None,
                    status="Active" if row.get("active", True) else "Suspended",
                    notes=str(row.get("notes", "")) if pd.notna(row.get("notes")) else None,
                )
                session.add(supplier)
                count += 1
        await session.flush()
        return count

    @staticmethod
    async def _ingest_transactions(df: pd.DataFrame, session: AsyncSession) -> int:
        count = 0
        for _, row in df.iterrows():
            tx_id = str(row.get("transaction_id", "")).strip()
            if not tx_id or pd.isna(tx_id):
                continue

            inv_date = pd.to_datetime(row.get("invoice_date")).date()
            post_date = (
                pd.to_datetime(row.get("posting_date")).date()
                if pd.notna(row.get("posting_date"))
                else None
            )

            tx = await session.get(Transaction, tx_id)
            if not tx:
                tx = Transaction(
                    transaction_id=tx_id,
                    supplier_id=str(row.get("supplier_id", "")),
                    invoice_number=str(row.get("invoice_no", "")),
                    amount=float(row.get("amount_usd", 0.0)),
                    currency=str(row.get("currency", "USD")),
                    invoice_date=inv_date,
                    posting_date=post_date,
                    approval_required=bool(row.get("approval_required", True)),
                    approval_status=str(row.get("approval_status", "Approved")),
                    payment_status=str(row.get("payment_status", "Pending")),
                    description=str(row.get("description", ""))
                    if pd.notna(row.get("description"))
                    else None,
                )
                session.add(tx)
                count += 1
        await session.flush()
        return count

    @staticmethod
    async def _ingest_approvals(df: pd.DataFrame, session: AsyncSession) -> int:
        count = 0
        for _, row in df.iterrows():
            app_id = str(row.get("approval_id", "")).strip()
            if not app_id or pd.isna(app_id):
                continue

            app_date = (
                pd.to_datetime(row.get("approval_date"))
                if pd.notna(row.get("approval_date"))
                else None
            )

            app = await session.get(Approval, app_id)
            if not app:
                app = Approval(
                    approval_id=app_id,
                    transaction_id=str(row.get("transaction_id", "")),
                    required_level=str(row.get("required_level", "Level 1")),
                    approver_role=str(row.get("approver_role", ""))
                    if pd.notna(row.get("approver_role"))
                    else None,
                    approval_status=str(row.get("approval_status", "Missing")),
                    approval_date=app_date,
                    notes=str(row.get("notes", "")) if pd.notna(row.get("notes")) else None,
                )
                session.add(app)
                count += 1
        await session.flush()
        return count

    @staticmethod
    async def _ingest_access_events(df: pd.DataFrame, session: AsyncSession) -> int:
        count = 0
        for _, row in df.iterrows():
            event_id = str(row.get("event_id", "")).strip()
            if not event_id or pd.isna(event_id):
                continue

            event_time = pd.to_datetime(row.get("event_time"))
            hour = event_time.hour
            is_off_hours = hour < 6 or hour >= 20

            ae = await session.get(AccessEvent, event_id)
            if not ae:
                ae = AccessEvent(
                    event_id=event_id,
                    user_id=str(row.get("user_id", "")),
                    event_time=event_time,
                    system=str(row.get("system", "ERP")),
                    action=str(row.get("action", "View")),
                    resource=str(row.get("resource", "")),
                    supplier_id=str(row.get("supplier_id", ""))
                    if pd.notna(row.get("supplier_id"))
                    else None,
                    result=str(row.get("result", "Success")),
                    location_context=str(row.get("location_context", ""))
                    if pd.notna(row.get("location_context"))
                    else None,
                    notes=str(row.get("notes", "")) if pd.notna(row.get("notes")) else None,
                    flagged=is_off_hours,
                )
                session.add(ae)
                count += 1
        await session.flush()
        return count

    @staticmethod
    async def _ingest_rules(df: pd.DataFrame, session: AsyncSession) -> int:
        count = 0
        default_configs = {
            "R-001": {"multiplier": 2.0, "exclude_target": True},
            "R-002": {"lookback_days": 7},
            "R-003": {"required_level": "Level 3", "threshold_amount": 50000.0},
            "R-004": {"start_hour": 6, "end_hour": 20},
            "R-005": {"window_days": 30},
            "R-006": {"lookback_days": 90},
        }

        for _, row in df.iterrows():
            rule_code = str(row.get("rule_id", "")).strip()
            if not rule_code or pd.isna(rule_code):
                continue

            stmt = select(RuleConfig).where(RuleConfig.rule_code == rule_code)
            res = await session.execute(stmt)
            rule = res.scalar_one_or_none()

            if not rule:
                rule = RuleConfig(
                    rule_code=rule_code,
                    name=str(row.get("rule_name", rule_code)),
                    description=str(row.get("example_reason_text", "")),
                    weight=int(row.get("default_weight", 20)),
                    threshold_params=default_configs.get(rule_code, {}),
                    rule_version=1,
                    is_active=True,
                )
                session.add(rule)
                count += 1
        await session.flush()
        return count

    @staticmethod
    async def _ingest_expected_cases(df: pd.DataFrame, session: AsyncSession) -> int:
        count = 0
        for _, row in df.iterrows():
            case_id = str(row.get("case_id", "")).strip()
            if not case_id or pd.isna(case_id):
                continue

            case = await session.get(RiskCase, case_id)
            if not case:
                case = RiskCase(
                    case_id=case_id,
                    case_number=f"CASE-{case_id.replace('TEST-CASE-', '2026-')}",
                    priority=str(row.get("expected_priority", "High")),
                    status="New",
                    supplier_id=str(row.get("supplier_id", ""))
                    if pd.notna(row.get("supplier_id"))
                    else None,
                    transaction_id=str(row.get("primary_record", ""))
                    if pd.notna(row.get("primary_record"))
                    else None,
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

                # Initial Case History entry
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
                count += 1
        return count
