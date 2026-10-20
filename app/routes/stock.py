"""EP1 POST /api/stock and EP2 GET /api/stock/record."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.services.stock import StockService, get_session

router = APIRouter(prefix="/api/stock")
service = StockService()


class FileStockIn(BaseModel):
    sku: str = Field(min_length=1)
    location: str = Field(min_length=1)
    quantity: int = Field(ge=0)
    tracking_code: str | None = None

    @field_validator("sku", "location")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v.strip()


class StockRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    sku: str
    location: str
    quantity: int
    tracking_code: str | None


@router.post("", response_model=StockRecordOut)
def file_stock(body: FileStockIn, session: Session = Depends(get_session)):
    return service.file_stock(session, **body.model_dump())


@router.get("", response_model=list[StockRecordOut])
def list_stock(location: str | None = Query(None), session: Session = Depends(get_session)):
    return service.list_stock(session, location=location)


@router.get("/record", response_model=StockRecordOut)
def get_record(sku: str = Query(...), location: str = Query(...), session: Session = Depends(get_session)):
    record = service.get_record(session, sku=sku, location=location)
    if record is None:
        raise HTTPException(status_code=404, detail="No stock record for that SKU at that location")
    return record
