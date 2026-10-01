"""add_manufacturing_schema_and_case_category

Revision ID: a4c7d1e9b302
Revises: cbbdff801f48
Create Date: 2026-10-01 10:00:00.000000

Adds the canonical manufacturing tables (v2.0, Ticket 4) and extends risk_cases with
case_category (default 'financial_exception') plus three nullable material-cost fields (D3).

The application also runs SQLModel create_all() on startup, which can create the new
tables before this migration runs. Every step therefore checks for existing objects so the
migration is safe on both a fresh and an already-synchronised database. Existing risk_cases
rows are backfilled to 'financial_exception' by the column server default.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a4c7d1e9b302"
down_revision: Union[str, Sequence[str], None] = "cbbdff801f48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Dependency order: parents first. Downgrade drops in reverse.
NEW_TABLES = [
    "materials",
    "material_suppliers",
    "material_costs",
    "purchase_records",
    "inventory_records",
    "variance_inputs",
    "bom_entries",
    "production_records",
    "demand_forecasts",
    "supplier_operations_metrics",
    "financial_plan_records",
]

CASE_COLUMNS = ["case_category", "material_id", "forecast_horizon", "projected_exposure_amount"]


def _recorded_at() -> sa.Column:
    return sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False)


def _dataset_id() -> sa.Column:
    return sa.Column("dataset_id", sa.String(length=100), nullable=True)


def _create_tables(inspector: sa.Inspector) -> None:
    existing = set(inspector.get_table_names())

    def create(name: str, *elements: object) -> None:
        if name not in existing:
            op.create_table(name, *elements)

    create(
        "materials",
        sa.Column("material_id", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("unit_of_measure", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        _dataset_id(),
        _recorded_at(),
        sa.PrimaryKeyConstraint("material_id"),
    )
    create(
        "material_suppliers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.String(length=50), nullable=False),
        sa.Column("supplier_id", sa.String(length=50), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("risk_indicator", sa.String(length=20), nullable=True),
        _dataset_id(),
        _recorded_at(),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.supplier_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("material_id", "supplier_id", name="uq_material_supplier"),
    )
    create(
        "material_costs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.String(length=50), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("standard_cost", sa.Float(), nullable=True),
        sa.Column("actual_cost", sa.Float(), nullable=True),
        sa.Column("budget_cost", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint(
            "(standard_cost IS NULL OR standard_cost >= 0) "
            "AND (actual_cost IS NULL OR actual_cost >= 0) "
            "AND (budget_cost IS NULL OR budget_cost >= 0)",
            name="ck_material_costs_non_negative",
        ),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("material_id", "version", name="uq_material_cost_version"),
    )
    create(
        "purchase_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("purchase_reference", sa.String(length=100), nullable=True),
        sa.Column("material_id", sa.String(length=50), nullable=False),
        sa.Column("supplier_id", sa.String(length=50), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint("quantity > 0 AND unit_price >= 0", name="ck_purchase_records_values"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.supplier_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create(
        "inventory_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.String(length=50), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("quantity_on_hand", sa.Float(), nullable=False),
        sa.Column("inventory_value", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("days_of_supply", sa.Float(), nullable=True),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint(
            "quantity_on_hand >= 0 AND (inventory_value IS NULL OR inventory_value >= 0) "
            "AND (days_of_supply IS NULL OR days_of_supply >= 0)",
            name="ck_inventory_records_non_negative",
        ),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create(
        "variance_inputs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.String(length=50), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("standard_price", sa.Float(), nullable=True),
        sa.Column("actual_price", sa.Float(), nullable=True),
        sa.Column("quantity_purchased", sa.Float(), nullable=True),
        sa.Column("reported_ppv_amount", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint("period_end >= period_start", name="ck_variance_inputs_period"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create(
        "bom_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_sku", sa.String(length=50), nullable=False),
        sa.Column("product_description", sa.String(length=500), nullable=True),
        sa.Column("material_id", sa.String(length=50), nullable=False),
        sa.Column("bom_quantity", sa.Float(), nullable=False),
        sa.Column("unit_of_measure", sa.String(length=20), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint("bom_quantity > 0", name="ck_bom_entries_quantity"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create(
        "production_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_sku", sa.String(length=50), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("planned_volume", sa.Float(), nullable=True),
        sa.Column("actual_volume", sa.Float(), nullable=True),
        sa.Column("unit_of_measure", sa.String(length=20), nullable=False),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint("period_end >= period_start", name="ck_production_records_period"),
        sa.CheckConstraint(
            "planned_volume IS NOT NULL OR actual_volume IS NOT NULL",
            name="ck_production_records_has_volume",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    create(
        "demand_forecasts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_sku", sa.String(length=50), nullable=True),
        sa.Column("material_id", sa.String(length=50), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("forecast_quantity", sa.Float(), nullable=False),
        sa.Column("unit_of_measure", sa.String(length=20), nullable=False),
        sa.Column("forecast_source", sa.String(length=100), nullable=True),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint("period_end >= period_start", name="ck_demand_forecasts_period"),
        sa.CheckConstraint(
            "product_sku IS NOT NULL OR material_id IS NOT NULL",
            name="ck_demand_forecasts_has_subject",
        ),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create(
        "supplier_operations_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("supplier_id", sa.String(length=50), nullable=False),
        sa.Column("material_id", sa.String(length=50), nullable=True),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("lead_time_days", sa.Float(), nullable=True),
        sa.Column("on_time_delivery_rate", sa.Float(), nullable=True),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint(
            "(lead_time_days IS NULL OR lead_time_days >= 0) "
            "AND (on_time_delivery_rate IS NULL OR "
            "(on_time_delivery_rate >= 0 AND on_time_delivery_rate <= 1))",
            name="ck_supplier_ops_metrics_values",
        ),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.supplier_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    create(
        "financial_plan_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.String(length=50), nullable=True),
        sa.Column("product_sku", sa.String(length=50), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("budget_amount", sa.Float(), nullable=True),
        sa.Column("forecast_amount", sa.Float(), nullable=True),
        sa.Column("actual_amount", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        _dataset_id(),
        _recorded_at(),
        sa.CheckConstraint("period_end >= period_start", name="ck_financial_plan_records_period"),
        sa.CheckConstraint(
            "budget_amount IS NOT NULL OR forecast_amount IS NOT NULL OR actual_amount IS NOT NULL",
            name="ck_financial_plan_records_has_amount",
        ),
        sa.ForeignKeyConstraint(["material_id"], ["materials.material_id"]),
        sa.PrimaryKeyConstraint("id"),
    )


# (table, column) pairs that carry a plain single-column index named ix_<table>_<column>.
INDEXED_COLUMNS = [
    ("materials", "category"),
    ("materials", "dataset_id"),
    ("material_suppliers", "material_id"),
    ("material_suppliers", "supplier_id"),
    ("material_suppliers", "dataset_id"),
    ("material_costs", "material_id"),
    ("material_costs", "effective_from"),
    ("material_costs", "dataset_id"),
    ("purchase_records", "purchase_reference"),
    ("purchase_records", "material_id"),
    ("purchase_records", "supplier_id"),
    ("purchase_records", "purchase_date"),
    ("purchase_records", "dataset_id"),
    ("inventory_records", "material_id"),
    ("inventory_records", "snapshot_date"),
    ("inventory_records", "dataset_id"),
    ("variance_inputs", "material_id"),
    ("variance_inputs", "period_start"),
    ("variance_inputs", "dataset_id"),
    ("bom_entries", "product_sku"),
    ("bom_entries", "material_id"),
    ("bom_entries", "dataset_id"),
    ("production_records", "product_sku"),
    ("production_records", "period_start"),
    ("production_records", "dataset_id"),
    ("demand_forecasts", "product_sku"),
    ("demand_forecasts", "material_id"),
    ("demand_forecasts", "period_start"),
    ("demand_forecasts", "dataset_id"),
    ("supplier_operations_metrics", "supplier_id"),
    ("supplier_operations_metrics", "material_id"),
    ("supplier_operations_metrics", "metric_date"),
    ("supplier_operations_metrics", "dataset_id"),
    ("financial_plan_records", "material_id"),
    ("financial_plan_records", "product_sku"),
    ("financial_plan_records", "period_start"),
    ("financial_plan_records", "dataset_id"),
]


def _create_indexes(inspector: sa.Inspector) -> None:
    for table, column in INDEXED_COLUMNS:
        name = f"ix_{table}_{column}"
        have = {ix["name"] for ix in inspector.get_indexes(table)}
        if name not in have:
            op.create_index(op.f(name), table, [column], unique=False)


def _extend_risk_cases(inspector: sa.Inspector) -> None:
    have_cols = {c["name"] for c in inspector.get_columns("risk_cases")}
    if "case_category" not in have_cols:
        op.add_column(
            "risk_cases",
            sa.Column(
                "case_category",
                sa.String(length=40),
                nullable=False,
                server_default="financial_exception",
            ),
        )
    if "material_id" not in have_cols:
        op.add_column("risk_cases", sa.Column("material_id", sa.String(length=50), nullable=True))
    if "forecast_horizon" not in have_cols:
        op.add_column("risk_cases", sa.Column("forecast_horizon", sa.Integer(), nullable=True))
    if "projected_exposure_amount" not in have_cols:
        op.add_column(
            "risk_cases", sa.Column("projected_exposure_amount", sa.Float(), nullable=True)
        )

    have_ix = {ix["name"] for ix in inspector.get_indexes("risk_cases")}
    for column in ("case_category", "material_id"):
        if f"ix_risk_cases_{column}" not in have_ix:
            op.create_index(op.f(f"ix_risk_cases_{column}"), "risk_cases", [column], unique=False)

    fk_names = {fk["name"] for fk in inspector.get_foreign_keys("risk_cases")}
    if "fk_risk_cases_material_id" not in fk_names:
        op.create_foreign_key(
            "fk_risk_cases_material_id",
            "risk_cases",
            "materials",
            ["material_id"],
            ["material_id"],
        )
    checks = {ck["name"] for ck in inspector.get_check_constraints("risk_cases")}
    if "ck_risk_cases_case_category" not in checks:
        op.create_check_constraint(
            "ck_risk_cases_case_category",
            "risk_cases",
            "case_category IN ('financial_exception', 'material_cost_risk')",
        )


def upgrade() -> None:
    """Upgrade schema."""
    _create_tables(sa.inspect(op.get_bind()))
    # Re-inspect: the inspector caches table lists taken before creation.
    inspector = sa.inspect(op.get_bind())
    _create_indexes(inspector)
    _extend_risk_cases(inspector)


def downgrade() -> None:
    """Downgrade schema."""
    inspector = sa.inspect(op.get_bind())
    have_cols = {c["name"] for c in inspector.get_columns("risk_cases")}
    checks = {ck["name"] for ck in inspector.get_check_constraints("risk_cases")}
    fks = {fk["name"] for fk in inspector.get_foreign_keys("risk_cases")}
    idx = {ix["name"] for ix in inspector.get_indexes("risk_cases")}

    if "ck_risk_cases_case_category" in checks:
        op.drop_constraint("ck_risk_cases_case_category", "risk_cases", type_="check")
    if "fk_risk_cases_material_id" in fks:
        op.drop_constraint("fk_risk_cases_material_id", "risk_cases", type_="foreignkey")
    for column in ("material_id", "case_category"):
        if f"ix_risk_cases_{column}" in idx:
            op.drop_index(op.f(f"ix_risk_cases_{column}"), table_name="risk_cases")
    for column in reversed(CASE_COLUMNS):
        if column in have_cols:
            op.drop_column("risk_cases", column)

    existing = set(inspector.get_table_names())
    for table in reversed(NEW_TABLES):
        if table in existing:
            op.drop_table(table)
