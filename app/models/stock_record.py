"""StockRecord: one quantity of a SKU held at a location, unique per (sku, location)."""

from sqlalchemy import CheckConstraint, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StockRecord(Base):
    __tablename__ = "stock_records"
    __table_args__ = (
        UniqueConstraint("sku", "location", name="uq_stock_records_sku_location"),
        CheckConstraint("quantity >= 0", name="ck_stock_records_quantity_non_negative"),
        Index(
            "ix_stock_records_location_sku_held",
            "location",
            "sku",
            postgresql_include=["quantity", "tracking_code"],
            postgresql_where=text("quantity > 0"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    tracking_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
