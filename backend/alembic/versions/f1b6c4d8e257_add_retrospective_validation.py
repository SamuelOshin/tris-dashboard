"""add_retrospective_validation

Revision ID: f1b6c4d8e257
Revises: e9a5b3c7d146
Create Date: 2026-10-03 12:00:00.000000

Adds the retrospective validation tables (v2.0, Ticket 11): runs, frozen cases, revealed outcomes,
summaries and failure records. All five are insert-only: database triggers refuse UPDATE and
DELETE, so a failed or unsuccessful run is preserved. Checks for existing objects first because
the application also runs SQLModel create_all() on startup.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1b6c4d8e257"
down_revision: Union[str, Sequence[str], None] = "e9a5b3c7d146"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RUNS, CASES, OUTCOMES, SUMMARIES, FAILURES = (
    "validation_runs",
    "validation_cases",
    "validation_outcomes",
    "validation_summaries",
    "validation_failures",
)
IMMUTABLE = (FAILURES, OUTCOMES, SUMMARIES, CASES, RUNS)  # children first, for dropping


def _indexes(table: str, columns: list[str]) -> None:
    present = {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(table)}
    for column in columns:
        name = f"ix_{table}_{column}"
        if name not in present:
            op.create_index(name, table, [column], unique=False)


def upgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()
    if RUNS not in tables:
        op.create_table(
            RUNS,
            sa.Column("run_id", sa.String(length=50), nullable=False),
            sa.Column("dataset_id", sa.String(length=100), nullable=True),
            sa.Column("data_end", sa.Date(), nullable=False),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("versions", sa.JSON(), nullable=False),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("created_by", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.user_id"]),
            sa.PrimaryKeyConstraint("run_id"),
        )
    if CASES not in tables:
        op.create_table(
            CASES,
            sa.Column("case_id", sa.String(length=50), nullable=False),
            sa.Column("run_id", sa.String(length=50), nullable=False),
            sa.Column("material_id", sa.String(length=50), nullable=False),
            sa.Column("cutoff", sa.Date(), nullable=False),
            sa.Column("horizon_days", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("withheld_reason", sa.String(length=500), nullable=True),
            sa.Column("target_month", sa.Date(), nullable=True),
            sa.Column("currency", sa.String(length=10), nullable=True),
            sa.Column("last_observed_price", sa.Float(), nullable=True),
            sa.Column("forecast_value", sa.Float(), nullable=True),
            sa.Column("lower_bound", sa.Float(), nullable=True),
            sa.Column("upper_bound", sa.Float(), nullable=True),
            sa.Column("naive_value", sa.Float(), nullable=True),
            sa.Column("model_code", sa.String(length=50), nullable=True),
            sa.Column("model_name", sa.String(length=100), nullable=True),
            sa.Column("model_version", sa.String(length=20), nullable=True),
            sa.Column("dataset_version", sa.String(length=40), nullable=True),
            sa.Column("history_months", sa.Integer(), nullable=True),
            sa.Column("risk_score", sa.Float(), nullable=True),
            sa.Column("risk_level", sa.String(length=20), nullable=True),
            sa.Column("alert", sa.Boolean(), nullable=False),
            sa.Column("risk_factors", sa.JSON(), nullable=False),
            sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["run_id"], [f"{RUNS}.run_id"]),
            sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
            sa.PrimaryKeyConstraint("case_id"),
        )
    if OUTCOMES not in tables:
        op.create_table(
            OUTCOMES,
            sa.Column("outcome_id", sa.String(length=50), nullable=False),
            sa.Column("case_id", sa.String(length=50), nullable=False),
            sa.Column("run_id", sa.String(length=50), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("reason", sa.String(length=500), nullable=True),
            sa.Column("metrics", sa.JSON(), nullable=False),
            sa.Column("classification", sa.String(length=2), nullable=True),
            sa.Column("revealed_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], [f"{CASES}.case_id"]),
            sa.ForeignKeyConstraint(["run_id"], [f"{RUNS}.run_id"]),
            sa.PrimaryKeyConstraint("outcome_id"),
        )
    if SUMMARIES not in tables:
        op.create_table(
            SUMMARIES,
            sa.Column("run_id", sa.String(length=50), nullable=False),
            sa.Column("metrics", sa.JSON(), nullable=False),
            sa.Column("limitations", sa.JSON(), nullable=False),
            sa.Column("problems", sa.JSON(), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["run_id"], [f"{RUNS}.run_id"]),
            sa.PrimaryKeyConstraint("run_id"),
        )
    if FAILURES not in tables:
        op.create_table(
            FAILURES,
            sa.Column("failure_id", sa.String(length=50), nullable=False),
            sa.Column("run_id", sa.String(length=50), nullable=False),
            sa.Column("error_type", sa.String(length=100), nullable=False),
            sa.Column("message", sa.String(length=1000), nullable=False),
            sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["run_id"], [f"{RUNS}.run_id"]),
            sa.PrimaryKeyConstraint("failure_id"),
        )
    _indexes(FAILURES, ["run_id"])
    _indexes(RUNS, ["dataset_id", "created_by", "created_at"])
    _indexes(CASES, ["run_id", "material_id", "cutoff"])
    _indexes(OUTCOMES, ["run_id"])
    present = {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(OUTCOMES)}
    if f"ix_{OUTCOMES}_case_id" not in present:  # one outcome per case
        op.create_index(f"ix_{OUTCOMES}_case_id", OUTCOMES, ["case_id"], unique=True)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_validation_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION '% rows are immutable: UPDATE and DELETE are prohibited', TG_TABLE_NAME;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for table in IMMUTABLE:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_immutable ON {table}")
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_immutable
                BEFORE UPDATE OR DELETE ON {table}
                FOR EACH ROW EXECUTE FUNCTION prevent_validation_mutation()
            """
        )


def downgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()
    for table in IMMUTABLE:
        if table in tables:
            op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_immutable ON {table}")
            op.drop_table(table)
    op.execute("DROP FUNCTION IF EXISTS prevent_validation_mutation()")
