"""AdjustmentRepository: the only persistence door for stock_adjustments (insert + read; never update/delete)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import StockAdjustment, StockRecord


class AdjustmentRepository:
    def __init__(self, session: Session):
        self.session = session

    def lock_record(self, sku: str, location: str) -> StockRecord | None:
        return self.session.scalars(
            select(StockRecord).where(StockRecord.sku == sku, StockRecord.location == location).with_for_update()
        ).one_or_none()

    def add(self, adjustment: StockAdjustment) -> StockAdjustment:
        self.session.add(adjustment)
        self.session.flush()
        self.session.refresh(adjustment)
        return adjustment

    def get(self, adjustment_id: int) -> StockAdjustment | None:
        return self.session.get(StockAdjustment, adjustment_id)

    def list_for(self, sku: str, location: str) -> list[StockAdjustment]:
        stmt = (
            select(StockAdjustment)
            .where(StockAdjustment.sku == sku, StockAdjustment.location == location)
            .order_by(StockAdjustment.adjusted_at.desc(), StockAdjustment.id.desc())
        )
        return list(self.session.scalars(stmt))

    def flush(self) -> None:
        self.session.flush()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
