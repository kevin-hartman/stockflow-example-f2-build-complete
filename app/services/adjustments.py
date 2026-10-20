"""AdjustmentService: set a stock record to a counted value and write its audit record in ONE transaction."""

from sqlalchemy.orm import Session

from app.models import StockAdjustment
from app.repositories.adjustments import AdjustmentRepository
from app.repositories.session import get_session

__all__ = ["AdjustmentService", "StockRecordNotFound", "get_session"]


class StockRecordNotFound(LookupError):
    """No stock record exists for the (sku, location) pair being adjusted."""


class AdjustmentService:
    def adjust_to_value(
        self, session: Session, *, sku: str, location: str, quantity: int, actor: str
    ) -> StockAdjustment:
        if quantity < 0:
            raise ValueError("quantity must be zero or more")
        actor = actor.strip()
        if not actor:
            raise ValueError("actor is required")
        repo = AdjustmentRepository(session)
        record = repo.lock_record(sku, location)
        if record is None:
            raise StockRecordNotFound(f"No stock record for {sku} at {location}")
        prior = record.quantity
        record.quantity = quantity
        repo.flush()
        adjustment = repo.add(
            StockAdjustment(sku=sku, location=location, prior_quantity=prior, new_quantity=quantity, actor=actor)
        )
        repo.commit()
        return adjustment

    def get(self, session: Session, adjustment_id: int) -> StockAdjustment | None:
        return AdjustmentRepository(session).get(adjustment_id)

    def list_for(self, session: Session, *, sku: str, location: str) -> list[StockAdjustment]:
        return AdjustmentRepository(session).list_for(sku, location)
