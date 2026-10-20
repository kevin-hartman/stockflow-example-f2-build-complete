"""AdjustmentService: set a stock record to a counted value and write its audit record in ONE transaction."""

from sqlalchemy.orm import Session

from app.models import StockAdjustment
from app.repositories.adjustments import AdjustmentRepository
from app.repositories.session import get_session

__all__ = ["AdjustmentService", "NegativeStockLevel", "StockRecordNotFound", "get_session"]


class StockRecordNotFound(LookupError):
    """No stock record exists for the (sku, location) pair being adjusted."""


class NegativeStockLevel(ValueError):
    """An adjustment would take the stock level below zero; `field` names the offending input."""

    def __init__(self, message: str, *, field: str):
        super().__init__(message)
        self.field = field


class AdjustmentService:
    def adjust_to_value(
        self, session: Session, *, sku: str, location: str, quantity: int, actor: str
    ) -> StockAdjustment:
        if quantity < 0:
            raise NegativeStockLevel("corrected quantity must be zero or more", field="quantity")
        return self._apply(session, sku=sku, location=location, actor=actor, compute=lambda _prior: quantity)

    def adjust_by_delta(
        self, session: Session, *, sku: str, location: str, delta: int, actor: str
    ) -> StockAdjustment:
        return self._apply(session, sku=sku, location=location, actor=actor, compute=lambda prior: prior + delta)

    def _apply(self, session: Session, *, sku: str, location: str, actor: str, compute) -> StockAdjustment:
        """Lock the existing pair, set its new level, and write the audit record in one transaction."""
        actor = actor.strip()
        if not actor:
            raise ValueError("actor is required")
        repo = AdjustmentRepository(session)
        record = repo.lock_record(sku, location)
        if record is None:
            raise StockRecordNotFound(f"No stock record for {sku} at {location}")
        prior = record.quantity
        quantity = compute(prior)
        if quantity < 0:
            repo.rollback()
            raise NegativeStockLevel(
                f"Rejected: quantity would go below zero (current {prior}, result {quantity})", field="delta"
            )
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
