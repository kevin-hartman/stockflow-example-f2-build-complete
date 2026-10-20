"""StockRepository: the only persistence door for stock_records."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import StockRecord


class StockRepository:
    def __init__(self, session: Session):
        self.session = session

    def upsert(self, sku: str, location: str, quantity: int, tracking_code: str | None) -> StockRecord:
        stmt = (
            insert(StockRecord)
            .values(sku=sku, location=location, quantity=quantity, tracking_code=tracking_code)
            .on_conflict_do_update(
                constraint="uq_stock_records_sku_location",
                set_={"quantity": quantity, "tracking_code": tracking_code},
            )
            .returning(StockRecord)
        )
        return self.session.scalars(stmt, execution_options={"populate_existing": True}).one()

    def get_by_key(self, sku: str, location: str) -> StockRecord | None:
        return self.session.scalars(
            select(StockRecord).where(StockRecord.sku == sku, StockRecord.location == location)
        ).one_or_none()

    def list_held(self, location: str | None = None, sku: str | None = None) -> list[StockRecord]:
        """Records holding stock (quantity > 0), optionally for one location and/or SKU, ordered by location, sku."""
        stmt = select(StockRecord).where(StockRecord.quantity > 0)
        if location is not None:
            stmt = stmt.where(StockRecord.location == location)
        if sku is not None:
            stmt = stmt.where(StockRecord.sku == sku)
        return list(self.session.scalars(stmt.order_by(StockRecord.location, StockRecord.sku)))

    def distinct_locations(self) -> list[str]:
        return list(self.session.scalars(select(StockRecord.location).distinct().order_by(StockRecord.location)))

    def commit(self) -> None:
        self.session.commit()
