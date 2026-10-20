"""SQLAlchemy models package. Import every entity here so Alembic sees the full metadata."""

from app.models.stock_record import StockRecord

__all__ = ["StockRecord"]
