"""422 shape for every validation refusal: {detail: [{field, message}]} naming the field."""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    detail = [
        {"field": str(err["loc"][-1]) if err.get("loc") else "", "message": err.get("msg", "invalid")}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": detail})
