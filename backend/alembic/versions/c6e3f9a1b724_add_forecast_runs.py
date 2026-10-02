"""add_forecast_runs

Revision ID: c6e3f9a1b724
Revises: b5d2e8f4a613
Create Date: 2026-10-01 18:00:00.000000

Adds the forecast_runs table (v2.0, Ticket 7): immutable stored forecasts with the model
metadata needed to reproduce and audit them. Checks for existing objects first because the
application also runs SQLModel create_all() on startup.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c6e3f9a1b724"
down_revision: Union[str, Sequence[str], None] = "b5d2e8f4a613"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "forecast_runs"
INDEXED = ["material_id", "dataset_id", "as_of", "created_by", "created_at"]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if TABLE not in inspector.get_table_names():
        op.create_table(
            TABLE,
            sa.Column("run_id", sa.String(length=50), nullable=False),
            sa.Column("material_id", sa.String(length=50), nullable=False),
            sa.Column("dataset_id", sa.String(length=100), nullable=True),
            sa.Column("as_of", sa.Date(), nullable=False),
            sa.Column("currency", sa.String(length=10), nullable=True),
            sa.Column("horizon_days", sa.Integer(), nullable=False),
            sa.Column("horizon_months", sa.Integer(), nullable=False),
            sa.Column("model_code", sa.String(length=50), nullable=False),
            sa.Column("model_name", sa.String(length=100), nullable=False),
            sa.Column("model_version", sa.String(length=20), nullable=False),
            sa.Column("dataset_version", sa.String(length=40), nullable=False),
            sa.Column("history_months", sa.Integer(), nullable=False),
            sa.Column("history_start", sa.Date(), nullable=False),
            sa.Column("history_end", sa.Date(), nullable=False),
            sa.Column("forecast_month", sa.Date(), nullable=False),
            sa.Column("forecast_value", sa.Float(), nullable=False),
            sa.Column("lower_bound", sa.Float(), nullable=True),
            sa.Column("upper_bound", sa.Float(), nullable=True),
            sa.Column("interval_level", sa.Float(), nullable=True),
            sa.Column("path", sa.JSON(), nullable=False),
            sa.Column("candidates", sa.JSON(), nullable=False),
            sa.Column("selection_rationale", sa.String(length=2000), nullable=False),
            sa.Column("config", sa.JSON(), nullable=False),
            sa.Column("created_by", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
            sa.ForeignKeyConstraint(["created_by"], ["users.user_id"]),
            sa.PrimaryKeyConstraint("run_id"),
        )
    present = {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(TABLE)}
    for column in INDEXED:
        name = f"ix_{TABLE}_{column}"
        if name not in present:
            op.create_index(name, TABLE, [column], unique=False)


def downgrade() -> None:
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLE)
