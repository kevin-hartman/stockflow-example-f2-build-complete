"""S1 file-stock: DB-level invariants, service guard, JSON boundary, config (real paired branch)."""

import re
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import sqlalchemy as sa
from psycopg import errors as pgerr
from sqlalchemy.exc import IntegrityError

APP_DIR = Path(__file__).resolve().parents[1] / "app"
INSERT = sa.text(
    "INSERT INTO stock_records (sku, location, quantity, tracking_code) "
    "VALUES (:sku, :location, :quantity, :tracking_code)"
)


def _row(**over):
    base = {"sku": f"SKU-{uuid.uuid4()}", "location": f"LOC-{uuid.uuid4()}", "quantity": 1, "tracking_code": None}
    base.update(over)
    return base


def _rejected_with(db_session, violation, **over):
    with pytest.raises(IntegrityError) as ei:
        db_session.execute(INSERT, _row(**over))
    db_session.rollback()
    assert isinstance(ei.value.orig, violation)
    return ei.value


@pytest.mark.testid("T8")
def test_session_fixture_is_real_postgres_on_paired_branch(db_session):
    import os

    assert db_session.get_bind().dialect.name == "postgresql"
    assert not isinstance(db_session, MagicMock)
    expected = os.getenv("DATABASE_URL")
    if expected:
        got = db_session.get_bind().url
        want = sa.engine.make_url(expected)
        assert (got.host, got.port, got.database) == (want.host, want.port, want.database)


@pytest.mark.testid("T9")
def test_database_url_read_from_env_and_not_hardcoded():
    assert 'getenv("DATABASE_URL")' in (APP_DIR / "database.py").read_text()
    literal = re.compile(r"""["']postgres(?:ql)?(?:\+\w+)?://[^"'{}\s]+["']""")
    offenders = [str(p) for p in APP_DIR.rglob("*.py") if literal.search(p.read_text())]
    assert offenders == []


@pytest.mark.testid("T1")
def test_sku_null_rejected(db_session):
    _rejected_with(db_session, pgerr.NotNullViolation, sku=None)


@pytest.mark.testid("T2")
def test_location_null_rejected(db_session):
    _rejected_with(db_session, pgerr.NotNullViolation, location=None)


@pytest.mark.testid("T3")
def test_quantity_null_rejected_tracking_code_null_accepted(db_session):
    _rejected_with(db_session, pgerr.NotNullViolation, quantity=None)
    row = _row(tracking_code=None)
    try:
        db_session.execute(INSERT, row)
        got = db_session.execute(
            sa.text("SELECT tracking_code FROM stock_records WHERE sku=:sku AND location=:location"), row
        ).scalar_one()
        assert got is None
    finally:
        db_session.rollback()


@pytest.mark.testid("T4")
def test_negative_quantity_rejected_by_check(db_session):
    err = _rejected_with(db_session, pgerr.CheckViolation, quantity=-1)
    assert "ck_stock_records_quantity_non_negative" in str(err.orig)


@pytest.mark.testid("T5")
def test_service_rejects_negative_quantity_before_repository():
    from app.services.stock import StockService

    session = MagicMock()
    with patch("app.repositories.stock.StockRepository.upsert") as upsert:
        with pytest.raises(ValueError) as ei:
            StockService().file_stock(session, sku="S", location="L", quantity=-1, tracking_code=None)
    assert "quantity" in str(ei.value)
    upsert.assert_not_called()


@pytest.mark.testid("T6")
def test_post_negative_quantity_422_and_nothing_stored(client, db_session):
    key = {"sku": f"SKU-{uuid.uuid4()}", "location": f"LOC-{uuid.uuid4()}"}
    r = client.post("/api/stock", json={**key, "quantity": -5})
    assert r.status_code == 422
    assert "quantity" in r.text
    n = db_session.execute(
        sa.text("SELECT count(*) FROM stock_records WHERE sku=:sku AND location=:location"), key
    ).scalar_one()
    assert n == 0


@pytest.mark.testid("T17")
def test_story_endpoints_always_return_json(client):
    sku, loc = f"SKU-{uuid.uuid4()}", f"LOC-{uuid.uuid4()}"
    responses = [
        client.post("/api/stock", json={"sku": sku, "location": loc, "quantity": 2}),  # 200
        client.post("/api/stock", json={"sku": sku, "location": loc, "quantity": -1}),  # 422
        client.get("/api/stock/record", params={"sku": sku, "location": loc}),  # 200
        client.get("/api/stock/record", params={"sku": sku, "location": f"none-{uuid.uuid4()}"}),  # 404
        client.get("/api/stock/record"),  # 422 missing query
        client.get("/api/locations"),  # 200
    ]
    assert [r.status_code for r in responses] == [200, 422, 200, 404, 422, 200]
    for r in responses:
        ctype = r.headers["content-type"]
        assert ctype.startswith("application/json") and "text/html" not in ctype
