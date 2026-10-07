"""add_mapping_profiles

Revision ID: b5d2e8f4a613
Revises: a4c7d1e9b302
Create Date: 2026-10-01 14:00:00.000000

Adds the mapping_profiles table (v2.0, Ticket 5): reusable ERP/BOM column mappings.

Each step checks for existing objects first, so it also succeeds on a database that already
has the table.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5d2e8f4a613"
down_revision: Union[str, Sequence[str], None] = "a4c7d1e9b302"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "mapping_profiles"
INDEXES = [
    ("ix_mapping_profiles_name", "name", True),
    ("ix_mapping_profiles_target", "target", False),
    ("ix_mapping_profiles_created_by", "created_by", False),
]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if TABLE not in inspector.get_table_names():
        op.create_table(
            TABLE,
            sa.Column("profile_id", sa.String(length=50), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column("source_profile", sa.String(length=30), nullable=False),
            sa.Column("target", sa.String(length=50), nullable=False),
            sa.Column("field_mapping", sa.JSON(), nullable=False),
            sa.Column("defaults", sa.JSON(), nullable=False),
            sa.Column("created_by", sa.String(length=50), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.user_id"]),
            sa.PrimaryKeyConstraint("profile_id"),
        )
    present = {ix["name"] for ix in sa.inspect(op.get_bind()).get_indexes(TABLE)}
    for name, column, unique in INDEXES:
        if name not in present:
            op.create_index(name, TABLE, [column], unique=unique)


def downgrade() -> None:
    if TABLE in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table(TABLE)
