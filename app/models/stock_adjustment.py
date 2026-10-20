"""StockAdjustment: one immutable audit record of an adjust-to-value on a (sku, location) stock record."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKeyConstraint, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"
    __table_args__ = (
        CheckConstraint(
            "prior_quantity >= 0 AND new_quantity >= 0", name="ck_stock_adjustments_quantities_non_negative"
        ),
        CheckConstraint("char_length(btrim(actor)) > 0", name="ck_stock_adjustments_actor_non_blank"),
        ForeignKeyConstraint(
            ["sku", "location"],
            ["stock_records.sku", "stock_records.location"],
            name="fk_stock_adjustments_stock_record",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    prior_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    new_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    adjusted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
