"""create stock_records

Revision ID: 20261020130920
Revises: 
Create Date: 2026-10-20 08:09:20.920761
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261020130920'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("sku", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("tracking_code", sa.String(255), nullable=True),
        sa.UniqueConstraint("sku", "location", name="uq_stock_records_sku_location"),
        sa.CheckConstraint("quantity >= 0", name="ck_stock_records_quantity_non_negative"),
    )


def downgrade() -> None:
    op.drop_table("stock_records")
