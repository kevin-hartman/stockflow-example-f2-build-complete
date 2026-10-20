"""POST/GET /api/adjustments: adjust a stock record to a counted value and read its immutable audit trail."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from sqlalchemy.orm import Session

from app.services.adjustments import AdjustmentService, NegativeStockLevel, StockRecordNotFound, get_session

router = APIRouter(prefix="/api/adjustments")
service = AdjustmentService()


class AdjustIn(BaseModel):
    sku: str = Field(min_length=1, max_length=255)
    location: str = Field(min_length=1, max_length=255)
    quantity: int | None = None
    delta: int | None = None
    actor: str = Field(min_length=1, max_length=255)

    @field_validator("sku", "location", "actor")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v.strip()

    @field_validator("quantity")
    @classmethod
    def _not_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("corrected quantity must be zero or more")
        return v

    @field_validator("delta")
    @classmethod
    def _non_zero(cls, v: int | None) -> int | None:
        if v == 0:
            raise ValueError("delta must not be zero")
        return v

    @model_validator(mode="after")
    def _one_mode(self) -> "AdjustIn":
        if (self.quantity is None) == (self.delta is None):
            raise ValueError("provide exactly one of quantity or delta")
        return self


class AdjustmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    location: str
    prior_quantity: int
    new_quantity: int
    actor: str
    adjusted_at: datetime

    @field_serializer("adjusted_at")
    def _utc(self, v: datetime) -> str:
        return v.astimezone(timezone.utc).isoformat()


@router.post("", response_model=AdjustmentOut, status_code=201)
def adjust(body: AdjustIn, session: Session = Depends(get_session)):
    try:
        if body.delta is not None:
            return service.adjust_by_delta(
                session, sku=body.sku, location=body.location, delta=body.delta, actor=body.actor
            )
        return service.adjust_to_value(
            session, sku=body.sku, location=body.location, quantity=body.quantity, actor=body.actor
        )
    except StockRecordNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NegativeStockLevel as exc:
        return JSONResponse(status_code=422, content={"detail": [{"field": exc.field, "message": str(exc)}]})


@router.get("", response_model=list[AdjustmentOut])
def list_adjustments(sku: str = Query(...), location: str = Query(...), session: Session = Depends(get_session)):
    return service.list_for(session, sku=sku, location=location)


@router.get("/{adjustment_id}", response_model=AdjustmentOut)
def get_adjustment(adjustment_id: int, session: Session = Depends(get_session)):
    adjustment = service.get(session, adjustment_id)
    if adjustment is None:
        raise HTTPException(status_code=404, detail="No adjustment with that id")
    return adjustment
