"""baseline_v13_schema

Revision ID: 0f3c9a7b5d21
Revises:
Create Date: 2026-10-05 12:00:00.000000

The original TRIS tables (v1.3 and the v1.4 audit log): users, suppliers, transactions,
approvals, access events, rule configuration, risk cases, case history, notifications,
ingestion jobs and the security audit log. Until now no migration created them: the
application built them with SQLModel create_all() when it started (since removed) and the
migration history
began after them, so `alembic upgrade head` could not build an empty database.

This revision creates whichever of these tables are missing, in the shape they had before
the later migrations: `transactions` without `event_timestamp` and `risk_cases` without the
material-cost columns (the migrations that follow add them). A database that already has the
tables is left untouched, so existing installations are not affected. It also installs the one
original database trigger, the immutability of `case_history` (the later triggers are created by
the migrations that add their tables). Until now that trigger was only installed by the seed
script, so a database built without the seed would not have enforced it.

The downgrade does nothing on purpose: dropping the original tables would destroy data.
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0f3c9a7b5d21"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the original tables that do not exist yet."""
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "access_events" not in existing:
        op.create_table(
            "access_events",
            sa.Column("event_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("user_id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column("event_time", sa.DateTime(), nullable=False),
            sa.Column("system", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column("action", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column("resource", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column("supplier_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
            sa.Column("result", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column(
                "location_context", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True
            ),
            sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("flagged", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("event_id"),
        )
        op.create_index(
            op.f("ix_access_events_event_id"), "access_events", ["event_id"], unique=False
        )
        op.create_index(
            op.f("ix_access_events_event_time"), "access_events", ["event_time"], unique=False
        )
        op.create_index(
            op.f("ix_access_events_flagged"), "access_events", ["flagged"], unique=False
        )
        op.create_index(op.f("ix_access_events_system"), "access_events", ["system"], unique=False)
        op.create_index(
            op.f("ix_access_events_user_id"), "access_events", ["user_id"], unique=False
        )

    if "notifications" not in existing:
        op.create_table(
            "notifications",
            sa.Column(
                "notification_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
            ),
            sa.Column(
                "recipient_user_id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True
            ),
            sa.Column("recipient_role", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
            sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("category", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("severity", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
            sa.Column("link_url", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False),
            sa.Column("read_at", sa.DateTime(), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("notification_id"),
        )
        op.create_index(
            op.f("ix_notifications_category"), "notifications", ["category"], unique=False
        )
        op.create_index(
            op.f("ix_notifications_created_at"), "notifications", ["created_at"], unique=False
        )
        op.create_index(
            op.f("ix_notifications_is_read"), "notifications", ["is_read"], unique=False
        )
        op.create_index(
            op.f("ix_notifications_notification_id"),
            "notifications",
            ["notification_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_notifications_recipient_role"),
            "notifications",
            ["recipient_role"],
            unique=False,
        )
        op.create_index(
            op.f("ix_notifications_recipient_user_id"),
            "notifications",
            ["recipient_user_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_notifications_severity"), "notifications", ["severity"], unique=False
        )

    if "rule_configs" not in existing:
        op.create_table(
            "rule_configs",
            sa.Column("rule_id", sa.Integer(), nullable=False),
            sa.Column("rule_code", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
            sa.Column("weight", sa.Integer(), nullable=False),
            sa.Column("threshold_params", sa.JSON(), nullable=False),
            sa.Column("rule_version", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("rule_id"),
        )
        op.create_index(
            op.f("ix_rule_configs_is_active"), "rule_configs", ["is_active"], unique=False
        )
        op.create_index(
            op.f("ix_rule_configs_rule_code"), "rule_configs", ["rule_code"], unique=True
        )

    if "security_audit_log" not in existing:
        op.create_table(
            "security_audit_log",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("event_type", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("actor_id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
            sa.Column(
                "actor_username", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True
            ),
            sa.Column("actor_role", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
            sa.Column("resource_type", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
            sa.Column("resource_id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
            sa.Column("detail", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
            sa.Column("ip_address", sqlmodel.sql.sqltypes.AutoString(length=45), nullable=True),
            sa.Column("occurred_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_security_audit_log_event_type"),
            "security_audit_log",
            ["event_type"],
            unique=False,
        )
        op.create_index(
            op.f("ix_security_audit_log_occurred_at"),
            "security_audit_log",
            ["occurred_at"],
            unique=False,
        )

    if "suppliers" not in existing:
        op.create_table(
            "suppliers",
            sa.Column("supplier_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
            sa.Column("category", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column("risk_tier", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("bank_account", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
            sa.Column("routing_number", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
            sa.Column("bank_change_date", sa.Date(), nullable=True),
            sa.Column("bank_change_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("supplier_id"),
        )
        op.create_index(op.f("ix_suppliers_category"), "suppliers", ["category"], unique=False)
        op.create_index(op.f("ix_suppliers_name"), "suppliers", ["name"], unique=False)
        op.create_index(op.f("ix_suppliers_risk_tier"), "suppliers", ["risk_tier"], unique=False)
        op.create_index(
            op.f("ix_suppliers_supplier_id"), "suppliers", ["supplier_id"], unique=False
        )

    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("user_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("username", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
            sa.Column("email", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
            sa.Column(
                "hashed_password", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False
            ),
            sa.Column("role", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("department", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("user_id"),
        )
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
        op.create_index(op.f("ix_users_user_id"), "users", ["user_id"], unique=False)
        op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    if "ingestion_jobs" not in existing:
        op.create_table(
            "ingestion_jobs",
            sa.Column("job_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=30), nullable=False),
            sa.Column("filename", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
            sa.Column("file_size_bytes", sa.Integer(), nullable=False),
            sa.Column("uploaded_by", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column(
                "duplicate_strategy", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False
            ),
            sa.Column("total_rows", sa.Integer(), nullable=False),
            sa.Column("processed_rows", sa.Integer(), nullable=False),
            sa.Column("inserted_rows", sa.Integer(), nullable=False),
            sa.Column("updated_rows", sa.Integer(), nullable=False),
            sa.Column("skipped_rows", sa.Integer(), nullable=False),
            sa.Column("error_rows", sa.Integer(), nullable=False),
            sa.Column("summary_report", sa.JSON(), nullable=False),
            sa.Column("error_log", sa.JSON(), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["uploaded_by"],
                ["users.user_id"],
            ),
            sa.PrimaryKeyConstraint("job_id"),
        )
        op.create_index(
            op.f("ix_ingestion_jobs_created_at"), "ingestion_jobs", ["created_at"], unique=False
        )
        op.create_index(
            op.f("ix_ingestion_jobs_job_id"), "ingestion_jobs", ["job_id"], unique=False
        )
        op.create_index(
            op.f("ix_ingestion_jobs_status"), "ingestion_jobs", ["status"], unique=False
        )
        op.create_index(
            op.f("ix_ingestion_jobs_uploaded_by"), "ingestion_jobs", ["uploaded_by"], unique=False
        )

    if "transactions" not in existing:
        op.create_table(
            "transactions",
            sa.Column(
                "transaction_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
            ),
            sa.Column("supplier_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column(
                "invoice_number", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False
            ),
            sa.Column("amount", sa.Float(), nullable=False),
            sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False),
            sa.Column("invoice_date", sa.Date(), nullable=False),
            sa.Column("due_date", sa.Date(), nullable=True),
            sa.Column("posting_date", sa.Date(), nullable=True),
            sa.Column("approval_required", sa.Boolean(), nullable=False),
            sa.Column(
                "approval_status", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
            ),
            sa.Column(
                "payment_status", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
            ),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["supplier_id"],
                ["suppliers.supplier_id"],
            ),
            sa.PrimaryKeyConstraint("transaction_id"),
        )
        op.create_index(op.f("ix_transactions_amount"), "transactions", ["amount"], unique=False)
        op.create_index(
            op.f("ix_transactions_approval_status"),
            "transactions",
            ["approval_status"],
            unique=False,
        )
        op.create_index(
            op.f("ix_transactions_invoice_date"), "transactions", ["invoice_date"], unique=False
        )
        op.create_index(
            op.f("ix_transactions_invoice_number"), "transactions", ["invoice_number"], unique=False
        )
        op.create_index(
            op.f("ix_transactions_payment_status"), "transactions", ["payment_status"], unique=False
        )
        op.create_index(
            op.f("ix_transactions_supplier_id"), "transactions", ["supplier_id"], unique=False
        )
        op.create_index(
            op.f("ix_transactions_transaction_id"), "transactions", ["transaction_id"], unique=False
        )

    if "approvals" not in existing:
        op.create_table(
            "approvals",
            sa.Column("approval_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column(
                "transaction_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
            ),
            sa.Column(
                "required_level", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
            ),
            sa.Column("approver_name", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True),
            sa.Column("approver_role", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
            sa.Column(
                "approval_status", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False
            ),
            sa.Column("approval_date", sa.DateTime(), nullable=True),
            sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["transaction_id"],
                ["transactions.transaction_id"],
            ),
            sa.PrimaryKeyConstraint("approval_id"),
        )
        op.create_index(
            op.f("ix_approvals_approval_id"), "approvals", ["approval_id"], unique=False
        )
        op.create_index(
            op.f("ix_approvals_approval_status"), "approvals", ["approval_status"], unique=False
        )
        op.create_index(
            op.f("ix_approvals_transaction_id"), "approvals", ["transaction_id"], unique=False
        )

    if "risk_cases" not in existing:
        op.create_table(
            "risk_cases",
            sa.Column("case_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("case_number", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("priority", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("supplier_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("transaction_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("assigned_to", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True),
            sa.Column("department", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
            sa.Column("trigger_signals", sa.JSON(), nullable=False),
            sa.Column("evaluation_snapshot", sa.JSON(), nullable=False),
            sa.Column("root_cause", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("corrective_action", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("closure_type", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True),
            sa.Column(
                "closure_evidence", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True
            ),
            sa.Column("verified_by", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True),
            sa.Column("closure_date", sa.DateTime(), nullable=True),
            sa.Column("follow_up_requirement", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column(
                "recurrence_monitoring", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["supplier_id"],
                ["suppliers.supplier_id"],
            ),
            sa.ForeignKeyConstraint(
                ["transaction_id"],
                ["transactions.transaction_id"],
            ),
            sa.PrimaryKeyConstraint("case_id"),
        )
        op.create_index(
            op.f("ix_risk_cases_assigned_to"), "risk_cases", ["assigned_to"], unique=False
        )
        op.create_index(op.f("ix_risk_cases_case_id"), "risk_cases", ["case_id"], unique=False)
        op.create_index(
            op.f("ix_risk_cases_case_number"), "risk_cases", ["case_number"], unique=True
        )
        op.create_index(
            op.f("ix_risk_cases_created_at"), "risk_cases", ["created_at"], unique=False
        )
        op.create_index(op.f("ix_risk_cases_priority"), "risk_cases", ["priority"], unique=False)
        op.create_index(op.f("ix_risk_cases_status"), "risk_cases", ["status"], unique=False)
        op.create_index(
            op.f("ix_risk_cases_supplier_id"), "risk_cases", ["supplier_id"], unique=False
        )
        op.create_index(
            op.f("ix_risk_cases_transaction_id"), "risk_cases", ["transaction_id"], unique=False
        )

    if "case_history" not in existing:
        op.create_table(
            "case_history",
            sa.Column("history_id", sa.Integer(), nullable=False),
            sa.Column("case_id", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
            sa.Column("timestamp", sa.DateTime(), nullable=False),
            sa.Column("actor", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
            sa.Column("action", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
            sa.Column(
                "previous_status", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True
            ),
            sa.Column("new_status", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
            sa.Column("note", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.ForeignKeyConstraint(
                ["case_id"],
                ["risk_cases.case_id"],
            ),
            sa.PrimaryKeyConstraint("history_id"),
        )
        op.create_index(op.f("ix_case_history_case_id"), "case_history", ["case_id"], unique=False)
        op.create_index(
            op.f("ix_case_history_timestamp"), "case_history", ["timestamp"], unique=False
        )

    message = "Case_History rows are immutable: UPDATE and DELETE operations are prohibited"
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION prevent_case_history_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION '{message}';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_case_history_immutable ON case_history")
    op.execute(
        """
        CREATE TRIGGER trg_case_history_immutable
            BEFORE UPDATE OR DELETE ON case_history
            FOR EACH ROW EXECUTE FUNCTION prevent_case_history_mutation()
        """
    )


def downgrade() -> None:
    """Nothing to undo: the original tables are never dropped by a migration."""
