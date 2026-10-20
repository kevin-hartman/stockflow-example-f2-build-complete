"""create stock adjustments

Revision ID: 20261020212107
Revises: 20261020132619
Create Date: 2026-10-20 16:21:08.142874
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261020212107'
down_revision: Union[str, None] = '20261020132619'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE = "stock_adjustments"
GUARD_FN = "stock_adjustments_immutable"
GUARD_TRG = "trg_stock_adjustments_immutable"


def upgrade() -> None:
    op.create_table(
        "stock_adjustments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("sku", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255), nullable=False),
        sa.Column("prior_quantity", sa.Integer, nullable=False),
        sa.Column("new_quantity", sa.Integer, nullable=False),
        sa.Column("actor", sa.String(255), nullable=False),
        sa.Column("adjusted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "prior_quantity >= 0 AND new_quantity >= 0", name="ck_stock_adjustments_quantities_non_negative"
        ),
        sa.CheckConstraint("char_length(btrim(actor)) > 0", name="ck_stock_adjustments_actor_non_blank"),
        sa.ForeignKeyConstraint(
            ["sku", "location"],
            ["stock_records.sku", "stock_records.location"],
            name="fk_stock_adjustments_stock_record",
        ),
    )
    op.create_index(
        "ix_stock_adjustments_sku_location_adjusted_at", "stock_adjustments", ["sku", "location", sa.text("adjusted_at DESC")]
    )
    op.execute(
        f"""
        CREATE FUNCTION {GUARD_FN}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'stock_adjustments rows are immutable (% rejected)', TG_OP;
        END;
        $$
        """
    )
    op.execute(
        f"CREATE TRIGGER {GUARD_TRG} BEFORE UPDATE OR DELETE ON {TABLE} "
        f"FOR EACH ROW EXECUTE FUNCTION {GUARD_FN}()"
    )


def downgrade() -> None:
    op.drop_table("stock_adjustments")
    op.execute(f"DROP FUNCTION IF EXISTS {GUARD_FN}()")
