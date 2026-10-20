"""stock records location sku held index

Revision ID: 20261020132619
Revises: 20261020130920
Create Date: 2026-10-20 08:26:19.386638
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261020132619'
down_revision: Union[str, None] = '20261020130920'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX = "ix_stock_records_location_sku_held"


def upgrade() -> None:
    op.create_index(
        INDEX,
        "stock_records",
        ["location", "sku"],
        postgresql_include=["quantity", "tracking_code"],
        postgresql_where=sa.text("quantity > 0"),
    )


def downgrade() -> None:
    op.drop_index(INDEX, table_name="stock_records")
