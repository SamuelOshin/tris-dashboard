"""add_administration_tables

Revision ID: b3d8f2a6c941
Revises: f1b6c4d8e257
Create Date: 2026-10-05 18:00:00.000000

Adds the administration tables of the manufacturing extension: `forecast_model_settings`
(every change of whether a forecast model may be used, insert-only) and `dataset_registry`
(named datasets with a synthetic/authorised label). Makes `security_audit_log`, which now also
records configuration and analysis events, insert-only. Checks for existing objects first so
it also succeeds on a database that already has them.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3d8f2a6c941"
down_revision: Union[str, Sequence[str], None] = "f1b6c4d8e257"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SETTINGS = "forecast_model_settings"
REGISTRY = "dataset_registry"


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = inspector.get_table_names()
    if SETTINGS not in tables:
        op.create_table(
            SETTINGS,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("model_code", sa.String(length=50), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("changed_by", sa.String(length=50), nullable=False),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["changed_by"], ["users.user_id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    present = {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(SETTINGS)}
    for column in ("model_code", "changed_by", "changed_at"):
        name = f"ix_{SETTINGS}_{column}"
        if name not in present:
            op.create_index(name, SETTINGS, [column], unique=False)

    if REGISTRY not in tables:
        op.create_table(
            REGISTRY,
            sa.Column("dataset_id", sa.String(length=100), nullable=False),
            sa.Column("label", sa.String(length=20), nullable=False),
            sa.Column("source_type", sa.String(length=40), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column("registered_by", sa.String(length=50), nullable=False),
            sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("label_set_by", sa.String(length=50), nullable=True),
            sa.Column("label_set_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["registered_by"], ["users.user_id"]),
            sa.ForeignKeyConstraint(["label_set_by"], ["users.user_id"]),
            sa.PrimaryKeyConstraint("dataset_id"),
        )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_administration_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION '% rows are immutable: UPDATE and DELETE are prohibited', TG_TABLE_NAME;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for table in (SETTINGS, "security_audit_log"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_immutable ON {table}")
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_immutable
                BEFORE UPDATE OR DELETE ON {table}
                FOR EACH ROW EXECUTE FUNCTION prevent_administration_mutation()
            """
        )


def downgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()
    op.execute("DROP TRIGGER IF EXISTS trg_security_audit_log_immutable ON security_audit_log")
    if SETTINGS in tables:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{SETTINGS}_immutable ON {SETTINGS}")
        op.drop_table(SETTINGS)
    if REGISTRY in tables:
        op.drop_table(REGISTRY)
    op.execute("DROP FUNCTION IF EXISTS prevent_administration_mutation()")
