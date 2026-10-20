"""S1 AC3: re-filing an existing (sku, location) is resolved at write (upsert)."""

import uuid

import pytest
import sqlalchemy as sa
from psycopg import errors as pgerr
from sqlalchemy.exc import IntegrityError


def _u():
    return uuid.uuid4().hex[:12]


def _file(client, sku, loc, qty, code=None):
    body = {"sku": sku, "location": loc, "quantity": qty}
    if code is not None:
        body["tracking_code"] = code
    return client.post("/api/stock", json=body)


def _get(client, sku, loc):
    return client.get("/api/stock/record", params={"sku": sku, "location": loc})


@pytest.mark.testid("T33")
def test_raw_second_insert_rejected_by_unique(db_session):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    ins = sa.text("INSERT INTO stock_records (sku, location, quantity) VALUES (:s, :l, :q)")
    db_session.execute(ins, {"s": sku, "l": loc, "q": 1})
    db_session.commit()
    with pytest.raises(IntegrityError) as ei:
        db_session.execute(ins, {"s": sku, "l": loc, "q": 2})
    assert isinstance(ei.value.orig, pgerr.UniqueViolation)
    assert "uq_stock_records_sku_location" in str(ei.value.orig)
    db_session.rollback()


@pytest.mark.testid("T34")
def test_direct_on_conflict_do_update_leaves_one_row(db_session):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    up = sa.text(
        "INSERT INTO stock_records (sku, location, quantity, tracking_code) VALUES (:s, :l, :q, :t) "
        "ON CONFLICT (sku, location) DO UPDATE SET quantity = EXCLUDED.quantity, "
        "tracking_code = EXCLUDED.tracking_code"
    )
    db_session.execute(up, {"s": sku, "l": loc, "q": 1, "t": "A"})
    db_session.execute(up, {"s": sku, "l": loc, "q": 9, "t": "B"})
    db_session.commit()
    rows = db_session.execute(
        sa.text("SELECT quantity, tracking_code FROM stock_records WHERE sku=:s AND location=:l"),
        {"s": sku, "l": loc},
    ).all()
    assert [tuple(r) for r in rows] == [(9, "B")]


@pytest.mark.testid("T23")
def test_refile_returns_200_with_new_quantity(client):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    assert _file(client, sku, loc, 3).status_code == 200
    r = _file(client, sku, loc, 8)
    assert r.status_code == 200
    assert r.json()["quantity"] == 8


@pytest.mark.testid("T24")
def test_refile_get_returns_new_quantity(client):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    _file(client, sku, loc, 3)
    _file(client, sku, loc, 8)
    assert _get(client, sku, loc).json()["quantity"] == 8


@pytest.mark.testid("T25")
def test_refile_get_returns_new_tracking_code(client):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    _file(client, sku, loc, 3, "OLD")
    _file(client, sku, loc, 3, "NEW")
    assert _get(client, sku, loc).json()["tracking_code"] == "NEW"


@pytest.mark.testid("T26")
def test_refile_without_tracking_code_clears_it(client):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    _file(client, sku, loc, 3, "OLD")
    _file(client, sku, loc, 4)
    body = _get(client, sku, loc).json()
    assert body["tracking_code"] is None
    assert body["quantity"] == 4


@pytest.mark.testid("T27")
def test_refile_twice_never_conflicts(client):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    _file(client, sku, loc, 1)
    assert _file(client, sku, loc, 2).status_code == 200
    assert _file(client, sku, loc, 3).status_code == 200


@pytest.mark.testid("T28")
def test_refile_lists_location_once(client):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    _file(client, sku, loc, 1)
    _file(client, sku, loc, 2)
    assert client.get("/api/locations").json().count(loc) == 1


@pytest.mark.testid("T29")
def test_same_sku_two_locations_coexist(client):
    sku, l1, l2 = f"S-{_u()}", f"L-{_u()}", f"L-{_u()}"
    _file(client, sku, l1, 5)
    _file(client, sku, l2, 6)
    assert _get(client, sku, l1).json()["quantity"] == 5
    assert _get(client, sku, l2).json()["quantity"] == 6


@pytest.mark.testid("T30")
def test_two_skus_same_location_coexist(client):
    s1, s2, loc = f"S-{_u()}", f"S-{_u()}", f"L-{_u()}"
    _file(client, s1, loc, 5)
    _file(client, s2, loc, 6)
    assert _get(client, s1, loc).json()["quantity"] == 5
    assert _get(client, s2, loc).json()["quantity"] == 6


@pytest.mark.testid("T31")
def test_refile_negative_quantity_422_and_unchanged(client):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    _file(client, sku, loc, 7)
    r = _file(client, sku, loc, -1)
    assert r.status_code == 422
    assert "quantity" in [d["field"] for d in r.json()["detail"]]
    assert _get(client, sku, loc).json()["quantity"] == 7


@pytest.mark.testid("T32")
def test_refile_without_sku_422(client):
    r = client.post("/api/stock", json={"location": f"L-{_u()}", "quantity": 1})
    assert r.status_code == 422
    assert "sku" in [d["field"] for d in r.json()["detail"]]


@pytest.mark.testid("T35")
def test_post_twice_leaves_one_row_with_second_values(client, db_session):
    sku, loc = f"S-{_u()}", f"L-{_u()}"
    assert _file(client, sku, loc, 1, "A").status_code == 200
    assert _file(client, sku, loc, 2, "B").status_code == 200
    rows = db_session.execute(
        sa.text("SELECT quantity, tracking_code FROM stock_records WHERE sku=:s AND location=:l"),
        {"s": sku, "l": loc},
    ).all()
    assert [tuple(r) for r in rows] == [(2, "B")]
