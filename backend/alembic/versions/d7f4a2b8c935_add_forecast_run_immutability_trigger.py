"""add_forecast_run_immutability_trigger

Revision ID: d7f4a2b8c935
Revises: c6e3f9a1b724
Create Date: 2026-10-02 09:00:00.000000

Makes forecast_runs rows immutable at the database level (UPDATE and DELETE are refused), so a
stored forecast can never be silently altered, even by code that bypasses the service layer.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7f4a2b8c935"
down_revision: Union[str, Sequence[str], None] = "c6e3f9a1b724"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_forecast_run_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'forecast_runs rows are immutable: UPDATE and DELETE are prohibited';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_forecast_runs_immutable ON forecast_runs")
    op.execute(
        """
        CREATE TRIGGER trg_forecast_runs_immutable
            BEFORE UPDATE OR DELETE ON forecast_runs
            FOR EACH ROW EXECUTE FUNCTION prevent_forecast_run_mutation()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_forecast_runs_immutable ON forecast_runs")
    op.execute("DROP FUNCTION IF EXISTS prevent_forecast_run_mutation()")
