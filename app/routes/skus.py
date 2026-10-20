"""EP5 GET /api/skus/{sku}: one SKU's stock across every location holding it."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.services.stock import StockService, get_session

router = APIRouter(prefix="/api/skus")
service = StockService()


class SkuLocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    location: str
    quantity: int
    tracking_code: str | None


class SkuDetailOut(BaseModel):
    sku: str
    locations: list[SkuLocationOut]


@router.get("/{sku}", response_model=SkuDetailOut)
def get_sku_detail(sku: str, session: Session = Depends(get_session)):
    return SkuDetailOut(sku=sku, locations=service.sku_locations(session, sku=sku))
