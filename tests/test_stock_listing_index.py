"""S2: SC5 partial index migration, JSON boundary, real-branch session (NFR4/NFR5)."""

import os
import uuid
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.database import engine

INI = str(Path(__file__).resolve().parents[1] / "alembic.ini")
INDEX = "ix_stock_records_location_sku_held"


def _sc5_down_revision(cfg):
    for script in ScriptDirectory.from_config(cfg).walk_revisions():
        if INDEX in Path(script.path).read_text():
            assert script.down_revision, "SC5 must be an additive migration with a down_revision"
            return script.down_revision
    pytest.fail(f"no migration creates {INDEX}")


@pytest.mark.testid("T39")
def test_listing_session_is_real_postgres_branch(db_session):
    assert db_session.get_bind().dialect.name == "postgresql"
    url = sa.engine.make_url(os.environ["DATABASE_URL"])
    bound = db_session.get_bind().url
    assert (bound.host, bound.port, bound.database) == (url.host, url.port, url.database)


@pytest.mark.migration
@pytest.mark.testid("T36")
def test_sc5_index_downgrade_upgrade_round_trip():
    cfg = Config(INI)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, _sc5_down_revision(cfg))
    names = {i["name"] for i in sa.inspect(engine).get_indexes("stock_records")}
    assert INDEX not in names
    command.upgrade(cfg, "head")
    with engine.connect() as c:
        row = c.execute(
            sa.text("select indexdef from pg_indexes where indexname = :n"), {"n": INDEX}
        ).scalar_one()
    assert "(location, sku)" in row and "INCLUDE (quantity, tracking_code)" in row
    assert "quantity > 0" in row


@pytest.mark.migration
@pytest.mark.testid("T37")
def test_sc5_round_trip_preserves_seeded_rows():
    cfg = Config(INI)
    command.upgrade(cfg, "head")
    rows = [
        (f"SKU-{uuid.uuid4()}", f"LOC-{uuid.uuid4()}", 3, f"TC-{uuid.uuid4()}"),
        (f"SKU-{uuid.uuid4()}", f"LOC-{uuid.uuid4()}", 0, None),
    ]
    with engine.begin() as c:
        for sku, loc, q, tc in rows:
            c.execute(
                sa.text(
                    "insert into stock_records (sku, location, quantity, tracking_code) "
                    "values (:s, :l, :q, :t)"
                ),
                {"s": sku, "l": loc, "q": q, "t": tc},
            )
    command.downgrade(cfg, _sc5_down_revision(cfg))
    command.upgrade(cfg, "head")
    with engine.connect() as c:
        for sku, loc, q, tc in rows:
            got = c.execute(
                sa.text(
                    "select sku, location, quantity, tracking_code from stock_records "
                    "where sku = :s and location = :l"
                ),
                {"s": sku, "l": loc},
            ).one()
            assert tuple(got) == (sku, loc, q, tc)


@pytest.mark.testid("T38")
def test_stock_listing_is_json(client):
    loc = f"LOC-{uuid.uuid4()}"
    for params in ({}, {"location": loc}):
        r = client.get("/api/stock", params=params)
        assert r.headers["content-type"].startswith("application/json")
        assert "text/html" not in r.headers["content-type"]
