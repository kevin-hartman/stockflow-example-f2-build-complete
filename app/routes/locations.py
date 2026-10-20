"""EP3 GET /api/locations: every distinct location on record."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.services.stock import StockService, get_session

router = APIRouter(prefix="/api/locations")
service = StockService()


@router.get("", response_model=list[str])
def list_locations(session: Session = Depends(get_session)):
    return service.list_locations(session)
