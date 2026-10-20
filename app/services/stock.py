"""StockService: file, retrieve and list stock records (domain rules + one commit per write)."""

from sqlalchemy.orm import Session

from app.models import StockRecord
from app.repositories import stock as stock_repository
from app.repositories.session import get_session

__all__ = ["StockService", "get_session"]


class StockService:
    def file_stock(
        self, session: Session, *, sku: str, location: str, quantity: int, tracking_code: str | None
    ) -> StockRecord:
        if quantity < 0:
            raise ValueError("quantity must be zero or more")
        sku, location = sku.strip(), location.strip()
        if not sku:
            raise ValueError("sku is required")
        if not location:
            raise ValueError("location is required")
        code = (tracking_code or "").strip() or None
        repo = stock_repository.StockRepository(session)
        record = repo.upsert(sku, location, quantity, code)
        repo.commit()
        return record

    def get_record(self, session: Session, *, sku: str, location: str) -> StockRecord | None:
        return stock_repository.StockRepository(session).get_by_key(sku, location)

    def list_stock(self, session: Session, *, location: str | None = None) -> list[StockRecord]:
        return stock_repository.StockRepository(session).list_held(location)

    def sku_locations(self, session: Session, *, sku: str) -> list[StockRecord]:
        """Every location holding stock of this SKU (empty when it has none anywhere)."""
        return stock_repository.StockRepository(session).list_held(sku=sku.strip())

    def list_locations(self, session: Session) -> list[str]:
        return stock_repository.StockRepository(session).distinct_locations()
