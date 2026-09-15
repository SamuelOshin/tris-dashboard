"""
Temporal Fixture Service for TRIS v1.4.
Manages the isolated synthetic temporal dataset (TX-TEMP-001 / SUP-TEMP-001)
with the exact six-event August 2026 timeline per Consolidated Specification Section 4.
Pure business logic — raises domain exceptions directly.
"""

from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

# Path where the static Excel workbook is stored
TEMPORAL_FIXTURE_PATH = Path(__file__).resolve().parents[5] / "data" / "v14_temporal_fixture.xlsx"

# Exact six-event timeline definitions (all August 2026)
TIMELINE_EVENTS = [
    {
        "event_number": 1,
        "timestamp": datetime(2026, 8, 26, 14, 15, 0, tzinfo=UTC),
        "description": "Supplier bank-account change becomes effective",
        "entity_type": "Supplier / AccessEvent",
        "reference_id": "SUP-TEMP-001 / AE-TEMP-001",
    },
    {
        "event_number": 2,
        "timestamp": datetime(2026, 8, 27, 8, 0, 0, tzinfo=UTC),
        "description": "Temporary/elevated access becomes active",
        "entity_type": "AccessEvent",
        "reference_id": "AE-TEMP-002",
    },
    {
        "event_number": 3,
        "timestamp": datetime(2026, 8, 28, 9, 32, 0, tzinfo=UTC),
        "description": "First required approval recorded (Level 1)",
        "entity_type": "Approval",
        "reference_id": "APP-TEMP-001",
    },
    {
        "event_number": 4,
        "timestamp": datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC),
        "description": "Material transaction/payment event occurs ($125,000.00)",
        "entity_type": "Transaction",
        "reference_id": "TX-TEMP-001",
    },
    {
        "event_number": 5,
        "timestamp": datetime(2026, 8, 28, 11, 6, 0, tzinfo=UTC),
        "description": "Second required approval recorded post-event (Level 2)",
        "entity_type": "Approval",
        "reference_id": "APP-TEMP-002",
    },
    {
        "event_number": 6,
        "timestamp": datetime(2026, 8, 30, 17, 0, 0, tzinfo=UTC),
        "description": "Temporary/elevated access removed",
        "entity_type": "AccessEvent",
        "reference_id": "AE-TEMP-003",
    },
]


class TemporalFixtureService:
    """Provides isolated generation, serialization, and ingestion of the v1.4 temporal fixture."""

    @staticmethod
    def get_fixture_records() -> dict[str, list[dict[str, Any]]]:
        """
        Returns the canonical raw dictionary representation of the v1.4 temporal dataset.

        Returns:
            Dictionary mapping sheet names to lists of row dictionaries.
        """
        return {
            "Suppliers": [
                {
                    "supplier_id": "SUP-TEMP-001",
                    "supplier_name": "Apex Temporal Technologies Ltd",
                    "category": "Cloud & IT Services",
                    "risk_tier": "High",
                    "bank_account": "GB82WEST12345678901234",
                    "routing_number": "04-00-04",
                    "bank_change_date": "2026-08-26",
                    "bank_change_reason": "Supplier banking profile update",
                    "active": True,
                    "notes": "v1.4 temporal fixture supplier (August 2026)",
                }
            ],
            "Transactions": [
                {
                    "transaction_id": "TX-TEMP-001",
                    "supplier_id": "SUP-TEMP-001",
                    "invoice_no": "INV-TEMP-260828",
                    "amount_usd": 125000.0,
                    "currency": "USD",
                    "invoice_date": "2026-08-28",
                    "posting_date": "2026-08-28",
                    "approval_required": True,
                    "approval_status": "Approved",
                    "payment_status": "Pending",
                    "description": "Material infrastructure payment (TX-TEMP-001)",
                }
            ],
            "Approvals": [
                {
                    "approval_id": "APP-TEMP-001",
                    "transaction_id": "TX-TEMP-001",
                    "required_level": "Level 1",
                    "approver_name": "Jane Finance",
                    "approver_role": "Finance Manager",
                    "approval_status": "Approved",
                    "approval_date": "2026-08-28 09:32:00",
                    "notes": "First required approval recorded (pre-transaction)",
                },
                {
                    "approval_id": "APP-TEMP-002",
                    "transaction_id": "TX-TEMP-001",
                    "required_level": "Level 2",
                    "approver_name": "Sarah Chen",
                    "approver_role": "CFO",
                    "approval_status": "Approved",
                    "approval_date": "2026-08-28 11:06:00",
                    "notes": "Second required approval recorded (post-transaction)",
                },
            ],
            "Access_Events": [
                {
                    "event_id": "AE-TEMP-001",
                    "user_id": "USR-PO-01",
                    "event_time": "2026-08-26 14:15:00",
                    "system": "Portal",
                    "action": "BANK_CHANGE",
                    "resource": "Bank Accounts",
                    "supplier_id": "SUP-TEMP-001",
                    "result": "Success",
                    "location_context": "Corporate Network",
                    "notes": "Supplier bank-account change becomes effective",
                },
                {
                    "event_id": "AE-TEMP-002",
                    "user_id": "USR-PO-01",
                    "event_time": "2026-08-27 08:00:00",
                    "system": "IAM",
                    "action": "ELEVATED_ACCESS_GRANT",
                    "resource": "Payment Release & Banking",
                    "supplier_id": "SUP-TEMP-001",
                    "result": "Success",
                    "location_context": "Corporate Network",
                    "notes": "Temporary/elevated access becomes active",
                },
                {
                    "event_id": "AE-TEMP-003",
                    "user_id": "USR-PO-01",
                    "event_time": "2026-08-30 17:00:00",
                    "system": "IAM",
                    "action": "ELEVATED_ACCESS_REVOKE",
                    "resource": "Payment Release & Banking",
                    "supplier_id": "SUP-TEMP-001",
                    "result": "Success",
                    "location_context": "Corporate Network",
                    "notes": "Temporary/elevated access removed",
                },
            ],
            "Expected_Cases": [
                {
                    "case_id": "CASE-TEMP-001",
                    "transaction_id": "TX-TEMP-001",
                    "primary_record": "TX-TEMP-001",
                    "supplier_id": "SUP-TEMP-001",
                    "expected_priority": "High",
                    "severity": "High",
                    "assigned_to": "usr-reviewer-01",
                    "description": "Temporal surveillance case for TX-TEMP-001",
                }
            ],
            "Demo_Rules": [
                {
                    "rule_id": "R-007",
                    "rule_name": "Approval Timing / Temporal Completeness",
                    "default_weight": 25,
                    "example_reason_text": (
                        "No approval effective/recorded at or before the transaction's "
                        "event timestamp satisfies the required approval level."
                    ),
                }
            ],
        }

    @staticmethod
    def generate_excel_bytes() -> bytes:
        """
        Generates in-memory Excel workbook (.xlsx) bytes for the temporal fixture.

        Returns:
            bytes containing the .xlsx file content.
        """
        records = TemporalFixtureService.get_fixture_records()
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            for sheet_name, rows in records.items():
                df = pd.DataFrame(rows)
                df.to_excel(writer, sheet_name=sheet_name, index=False)
        return buffer.getvalue()

    @staticmethod
    def write_fixture_file(target_path: Path | str | None = None) -> Path:
        """
        Writes the standalone v14_temporal_fixture.xlsx to disk.

        Args:
            target_path: Destination path. Defaults to TEMPORAL_FIXTURE_PATH.

        Returns:
            Resolved Path of the written file.
        """
        path = Path(target_path).resolve() if target_path else TEMPORAL_FIXTURE_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        excel_bytes = TemporalFixtureService.generate_excel_bytes()
        with open(path, "wb") as f:
            f.write(excel_bytes)
        return path

    @staticmethod
    async def ingest_temporal_fixture(
        session: AsyncSession,
        duplicate_strategy: str = "skip",
    ) -> dict[str, Any]:
        """
        Ingests the v1.4 temporal fixture into the database via IngestionService.

        Args:
            session: Active database session.
            duplicate_strategy: Strategy for handling duplicates ('skip' or 'fail').

        Returns:
            Ingestion summary report dictionary.
        """
        from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService

        excel_bytes = TemporalFixtureService.generate_excel_bytes()
        return await IngestionService.ingest_excel_workbook(
            file_path_or_bytes=excel_bytes,
            session=session,
            filename="v14_temporal_fixture.xlsx",
            duplicate_strategy=duplicate_strategy,
        )
