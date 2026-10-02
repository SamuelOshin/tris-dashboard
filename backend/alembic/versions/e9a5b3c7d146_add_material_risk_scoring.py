"""add_material_risk_scoring

Revision ID: e9a5b3c7d146
Revises: d7f4a2b8c935
Create Date: 2026-10-02 12:00:00.000000

Adds the material risk scoring tables (v2.0, Ticket 9): versioned weight sets and stored,
immutable scores, with database triggers refusing UPDATE and DELETE on both. Checks for existing
objects first because the application also runs SQLModel create_all() on startup.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e9a5b3c7d146"
down_revision: Union[str, Sequence[str], None] = "d7f4a2b8c935"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

WEIGHTS = "material_risk_weight_sets"
SCORES = "material_risk_scores"
INDEXED = ["material_id", "dataset_id", "as_of", "weight_version", "created_by", "created_at"]


def upgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()
    if WEIGHTS not in tables:
        op.create_table(
            WEIGHTS,
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("note", sa.String(length=500), nullable=False),
            sa.Column("created_by", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("version"),
        )
    if SCORES not in tables:
        op.create_table(
            SCORES,
            sa.Column("score_id", sa.String(length=50), nullable=False),
            sa.Column("material_id", sa.String(length=50), nullable=False),
            sa.Column("dataset_id", sa.String(length=100), nullable=True),
            sa.Column("as_of", sa.Date(), nullable=False),
            sa.Column("currency", sa.String(length=10), nullable=True),
            sa.Column("method_version", sa.String(length=20), nullable=False),
            sa.Column("weight_version", sa.Integer(), nullable=False),
            sa.Column("score", sa.Float(), nullable=False),
            sa.Column("level", sa.String(length=20), nullable=False),
            sa.Column("data_coverage_pct", sa.Float(), nullable=False),
            sa.Column("factors", sa.JSON(), nullable=False),
            sa.Column("summary", sa.String(length=1000), nullable=False),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("forecast_run_id", sa.String(length=50), nullable=True),
            sa.Column("inputs_version", sa.String(length=40), nullable=False),
            sa.Column("created_by", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
            sa.ForeignKeyConstraint(["weight_version"], [f"{WEIGHTS}.version"]),
            sa.ForeignKeyConstraint(["created_by"], ["users.user_id"]),
            sa.PrimaryKeyConstraint("score_id"),
        )
    present = {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(SCORES)}
    for column in INDEXED:
        name = f"ix_{SCORES}_{column}"
        if name not in present:
            op.create_index(name, SCORES, [column], unique=False)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_material_risk_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION '% rows are immutable: UPDATE and DELETE are prohibited', TG_TABLE_NAME;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for table in (SCORES, WEIGHTS):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_immutable ON {table}")
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_immutable
                BEFORE UPDATE OR DELETE ON {table}
                FOR EACH ROW EXECUTE FUNCTION prevent_material_risk_mutation()
            """
        )


def downgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()
    for table in (SCORES, WEIGHTS):
        if table in tables:
            op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_immutable ON {table}")
            op.drop_table(table)
    op.execute("DROP FUNCTION IF EXISTS prevent_material_risk_mutation()")
