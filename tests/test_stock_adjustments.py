"""F2 S1: adjust-to-value API, audit record, immutability and migration safety (real paired-branch DB)."""

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.database import SessionLocal, engine

ROOT = Path(__file__).resolve().parents[1]
INI = str(ROOT / "alembic.ini")


def _uid(prefix="S"):
    return f"{prefix}-{uuid.uuid4()}"


def _seed(client, qty=7):
    sku, loc = _uid("SKU"), _uid("LOC")
    r = client.post("/api/stock", json={"sku": sku, "location": loc, "quantity": qty})
    assert r.status_code == 200, r.text
    return sku, loc


def _adjust(client, sku, loc, qty, actor="alice"):
    return client.post("/api/adjustments", json={"sku": sku, "location": loc, "quantity": qty, "actor": actor})


def _list(client, sku, loc):
    r = client.get("/api/adjustments", params={"sku": sku, "location": loc})
    assert r.status_code == 200, r.text
    return r.json()


def _raw_insert(session, **over):
    vals = {"sku": None, "location": None, "prior_quantity": 1, "new_quantity": 2, "actor": "bob",
            "adjusted_at": datetime.now(timezone.utc)}
    vals.update(over)
    session.execute(sa.text(
        "INSERT INTO stock_adjustments (sku, location, prior_quantity, new_quantity, actor, adjusted_at) "
        "VALUES (:sku, :location, :prior_quantity, :new_quantity, :actor, :adjusted_at)"), vals)
    session.flush()


def _seed_row(session, qty=5):
    sku, loc = _uid("SKU"), _uid("LOC")
    session.execute(sa.text("INSERT INTO stock_records (sku, location, quantity) VALUES (:s,:l,:q)"),
                    {"s": sku, "l": loc, "q": qty})
    session.commit()
    return sku, loc


def _adjustments_migration():
    cfg = Config(INI)
    for script in ScriptDirectory.from_config(cfg).walk_revisions():
        text = Path(script.path).read_text()
        if "stock_adjustments" in text and "create_table" in text:
            return cfg, script.revision, script.down_revision or "base"
    pytest.fail("no migration creates stock_adjustments")


@pytest.fixture()
def pg_session():
    assert engine.dialect.name == "postgresql"
    assert str(engine.url.render_as_string(hide_password=True)).startswith("postgresql")
    s = SessionLocal()
    assert s.get_bind().dialect.name == "postgresql"
    try:
        yield s
    finally:
        s.rollback()
        s.close()


# ---- AC2 behavior ----
@pytest.mark.testid("T7")
def test_post_adjustment_returns_201_with_prior_and_new(client):
    sku, loc = _seed(client, 7)
    r = _adjust(client, sku, loc, 4, "alice")
    assert r.status_code == 201, r.text
    b = r.json()
    assert (b["sku"], b["location"], b["prior_quantity"], b["new_quantity"], b["actor"]) == (sku, loc, 7, 4, "alice")


@pytest.mark.testid("T8")
def test_get_lists_exactly_one_record_after_adjustment(client):
    sku, loc = _seed(client, 7)
    _adjust(client, sku, loc, 4, "alice")
    recs = _list(client, sku, loc)
    assert len(recs) == 1
    assert (recs[0]["prior_quantity"], recs[0]["new_quantity"], recs[0]["actor"]) == (7, 4, "alice")


@pytest.mark.testid("T9")
def test_adjusted_at_is_server_stamped_utc(client):
    sku, loc = _seed(client, 7)
    before = datetime.now(timezone.utc) - timedelta(seconds=1)
    _adjust(client, sku, loc, 4)
    after = datetime.now(timezone.utc) + timedelta(seconds=1)
    ts = datetime.fromisoformat(_list(client, sku, loc)[0]["adjusted_at"].replace("Z", "+00:00"))
    assert ts.tzinfo is not None and ts.utcoffset() == timedelta(0)
    assert before <= ts <= after


@pytest.mark.testid("T10")
def test_successive_adjustments_listed_newest_first(client):
    sku, loc = _seed(client, 7)
    _adjust(client, sku, loc, 4, "a")
    _adjust(client, sku, loc, 9, "b")
    recs = _list(client, sku, loc)
    assert len(recs) == 2
    assert recs[0]["new_quantity"] == 9 and recs[1]["new_quantity"] == 4
    assert recs[0]["prior_quantity"] == recs[1]["new_quantity"]


@pytest.mark.testid("T11")
def test_other_pair_records_not_returned(client):
    sku, loc = _seed(client, 7)
    sku2, loc2 = _seed(client, 3)
    _adjust(client, sku2, loc2, 1, "z")
    r = _adjust(client, sku, loc, 4, "a")
    assert r.json()["sku"] == sku
    assert [x["sku"] for x in _list(client, sku, loc)] == [sku]
    assert all(x["location"] == loc for x in _list(client, sku, loc))


@pytest.mark.parametrize("tid,actor", [("T12", ""), ("T13", "   "), ("T14", None)])
def test_actor_validation_422_names_actor(client, request, tid, actor):
    request.node.add_marker(pytest.mark.testid(tid))
    sku, loc = _seed(client, 7)
    body = {"sku": sku, "location": loc, "quantity": 4}
    if actor is not None:
        body["actor"] = actor
    r = client.post("/api/adjustments", json=body)
    assert r.status_code == 422
    assert "actor" in str(r.json()["detail"])


@pytest.mark.testid("T15")
def test_rejected_empty_actor_creates_no_record(client):
    sku, loc = _seed(client, 7)
    assert _adjust(client, sku, loc, 4, "").status_code == 422
    assert _list(client, sku, loc) == []


@pytest.mark.testid("T16")
def test_missing_stock_record_404_no_audit(client):
    sku, loc = _uid("SKU"), _uid("LOC")
    assert _adjust(client, sku, loc, 4).status_code == 404
    assert _list(client, sku, loc) == []


# ---- AC2 fitness ----
@pytest.mark.testid("T17")
def test_raw_insert_null_sku_rejected(pg_session):
    sku, loc = _seed_row(pg_session)
    with pytest.raises(sa.exc.IntegrityError, match="null value|not-null|sku"):
        _raw_insert(pg_session, sku=None, location=loc)


@pytest.mark.testid("T18")
def test_raw_insert_negative_new_quantity_rejected(pg_session):
    sku, loc = _seed_row(pg_session)
    with pytest.raises(sa.exc.IntegrityError, match="ck_stock_adjustments_quantities_non_negative"):
        _raw_insert(pg_session, sku=sku, location=loc, new_quantity=-1)


@pytest.mark.testid("T19")
def test_raw_insert_absent_pair_rejected_by_fk(pg_session):
    with pytest.raises(sa.exc.IntegrityError, match="foreign key"):
        _raw_insert(pg_session, sku=_uid("SKU"), location=_uid("LOC"))


@pytest.mark.testid("T20")
def test_failed_audit_insert_rolls_back_quantity(pg_session):
    from app.services.adjustments import AdjustmentService

    sku, loc = _seed_row(pg_session, 7)
    with pytest.raises(sa.exc.DBAPIError):
        AdjustmentService().adjust_to_value(pg_session, sku=sku, location=loc, quantity=4, actor="x" * 100000)
    pg_session.rollback()
    q = pg_session.execute(sa.text("SELECT quantity FROM stock_records WHERE sku=:s AND location=:l"),
                           {"s": sku, "l": loc}).scalar_one()
    n = pg_session.execute(sa.text("SELECT count(*) FROM stock_adjustments WHERE sku=:s AND location=:l"),
                           {"s": sku, "l": loc}).scalar_one()
    assert q == 7 and n == 0


@pytest.mark.migration
@pytest.mark.testid("T21")
def test_stock_adjustments_migration_downgrade_upgrade_round_trip():
    cfg, _rev, down = _adjustments_migration()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, down)
    assert "stock_adjustments" not in sa.inspect(engine).get_table_names()
    command.upgrade(cfg, "head")
    insp = sa.inspect(engine)
    cols = {c["name"]: c for c in insp.get_columns("stock_adjustments")}
    assert {"sku", "location", "prior_quantity", "new_quantity", "actor", "adjusted_at"} <= set(cols)
    for c in ("sku", "location", "prior_quantity", "new_quantity", "actor", "adjusted_at"):
        assert not cols[c]["nullable"]
    checks = " ".join(c["sqltext"] for c in insp.get_check_constraints("stock_adjustments"))
    assert "new_quantity" in checks and ">= 0" in checks
    fks = insp.get_foreign_keys("stock_adjustments")
    assert any(f["referred_table"] == "stock_records" and set(f["constrained_columns"]) == {"sku", "location"}
               for f in fks)
    sku, loc = _uid("SKU"), _uid("LOC")
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO stock_records (sku, location, quantity) VALUES (:s,:l,5)"),
                     {"s": sku, "l": loc})
        conn.execute(sa.text(
            "INSERT INTO stock_adjustments (sku, location, prior_quantity, new_quantity, actor, adjusted_at) "
            "VALUES (:s,:l,5,6,'t21',now())"), {"s": sku, "l": loc})
    with pytest.raises(sa.exc.DBAPIError):
        with engine.begin() as conn:
            conn.execute(sa.text("UPDATE stock_adjustments SET actor = actor WHERE sku=:s AND location=:l"),
                         {"s": sku, "l": loc})


@pytest.mark.migration
@pytest.mark.testid("T22")
def test_stock_records_persist_across_adjustments_migration():
    cfg, rev, down = _adjustments_migration()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, down)
    sku, loc = _uid("SKU"), _uid("LOC")
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO stock_records (sku, location, quantity) VALUES (:s,:l,5)"),
                     {"s": sku, "l": loc})
    command.upgrade(cfg, rev)
    q = "SELECT quantity FROM stock_records WHERE sku=:s AND location=:l"
    with engine.connect() as conn:
        assert conn.execute(sa.text(q), {"s": sku, "l": loc}).scalar_one() == 5
    command.downgrade(cfg, down)
    with engine.connect() as conn:
        assert conn.execute(sa.text(q), {"s": sku, "l": loc}).scalar_one() == 5


@pytest.mark.testid("T23")
def test_session_fixture_is_postgres_paired_branch(pg_session):
    assert pg_session.get_bind().dialect.name == "postgresql"
    assert pg_session.execute(sa.text("SELECT 1")).scalar_one() == 1


# ---- AC3 ----
@pytest.mark.testid("T27")
def test_direct_update_rejected_by_trigger(pg_session):
    sku, loc = _seed_row(pg_session)
    _raw_insert(pg_session, sku=sku, location=loc, prior_quantity=5, new_quantity=2, actor="orig")
    pg_session.commit()
    with pytest.raises(sa.exc.DBAPIError):
        pg_session.execute(sa.text("UPDATE stock_adjustments SET actor='evil' WHERE sku=:s AND location=:l"),
                           {"s": sku, "l": loc})
    pg_session.rollback()
    row = pg_session.execute(sa.text("SELECT actor, new_quantity FROM stock_adjustments WHERE sku=:s AND location=:l"),
                             {"s": sku, "l": loc}).one()
    assert tuple(row) == ("orig", 2)


def _make_record(client):
    sku, loc = _seed(client, 7)
    created = _adjust(client, sku, loc, 4, "alice").json()
    return sku, loc, created


@pytest.mark.parametrize("tid,method", [("T24", "put"), ("T25", "patch"), ("T26", "delete")])
def test_mutating_methods_405_and_record_unchanged(client, request, tid, method):
    request.node.add_marker(pytest.mark.testid(tid))
    sku, loc, created = _make_record(client)
    url = f"/api/adjustments/{created['id']}"
    kwargs = {} if method == "delete" else {"json": {"actor": "evil", "new_quantity": 99}}
    assert getattr(client, method)(url, **kwargs).status_code == 405
    g = client.get(url)
    assert g.status_code == 200
    assert (g.json()["actor"], g.json()["new_quantity"], g.json()["prior_quantity"]) == ("alice", 4, 7)


@pytest.mark.testid("T28")
def test_all_adjustment_responses_are_json(client):
    sku, loc, created = _make_record(client)
    url = f"/api/adjustments/{created['id']}"
    resps = [
        _adjust(client, sku, loc, 3),
        _adjust(client, sku, loc, 3, ""),
        _adjust(client, _uid("SKU"), _uid("LOC"), 3),
        client.put(url, json={}),
        client.get("/api/adjustments", params={"sku": sku, "location": loc}),
    ]
    assert [r.status_code for r in resps] == [201, 422, 404, 405, 200]
    for r in resps:
        assert r.headers["content-type"].startswith("application/json")
        assert "text/html" not in r.headers["content-type"]
