"""F2 S3 AC4: below-zero adjustments are rejected at the write path (real paired-branch DB)."""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import sqlalchemy as sa

from app.database import engine
from app.repositories.adjustments import AdjustmentRepository
from app.services.adjustments import AdjustmentService


def _seed(client):
    sku, loc = f"SKU-{uuid.uuid4()}", f"LOC-{uuid.uuid4()}"
    r = client.post("/api/stock", json={"sku": sku, "location": loc, "quantity": 7})
    assert r.status_code == 200, r.text
    return sku, loc


def _post(client, sku, loc, **mode):
    return client.post("/api/adjustments", json={"sku": sku, "location": loc, "actor": "alice", **mode})


def _fields(resp):
    detail = resp.json()["detail"]
    return {d.get("field") for d in detail if isinstance(d, dict)}


def _qty(client, sku, loc):
    r = client.get(f"/api/skus/{sku}")
    return [x["quantity"] for x in r.json()["locations"] if x["location"] == loc]


def _audit_count(sku, loc):
    with engine.connect() as c:
        return c.execute(
            sa.text("SELECT count(*) FROM stock_adjustments WHERE sku=:s AND location=:l"), {"s": sku, "l": loc}
        ).scalar_one()


def _delta_rejected(client):
    sku, loc = _seed(client)
    return sku, loc, _post(client, sku, loc, delta=-10)


def _qty_rejected(client, value):
    sku, loc = _seed(client)
    return sku, loc, _post(client, sku, loc, quantity=value)


@pytest.mark.testid("T57")
def test_below_zero_delta_post_is_422_naming_delta(client):
    sku, loc = _seed(client)
    r = _post(client, sku, loc, delta=-10)
    assert r.status_code == 422
    assert "delta" in _fields(r)
    assert any("quantity would go below zero" in d.get("message", "") for d in r.json()["detail"])


@pytest.mark.testid("T58")
def test_rejected_delta_leaves_quantity_7(client):
    sku, loc, r = _delta_rejected(client)
    assert r.status_code == 422
    assert _qty(client, sku, loc) == [7]


@pytest.mark.testid("T59")
def test_rejected_delta_writes_no_audit_via_api(client):
    sku, loc, r = _delta_rejected(client)
    assert r.status_code == 422
    assert client.get("/api/adjustments", params={"sku": sku, "location": loc}).json() == []


@pytest.mark.testid("T60")
def test_negative_quantity_post_is_422_naming_quantity(client):
    sku, loc, r = _qty_rejected(client, -3)
    assert r.status_code == 422
    assert "quantity" in _fields(r)


@pytest.mark.testid("T61")
def test_rejected_negative_quantity_leaves_state_untouched(client):
    sku, loc, r = _qty_rejected(client, -3)
    assert r.status_code == 422
    assert _qty(client, sku, loc) == [7]
    assert client.get("/api/adjustments", params={"sku": sku, "location": loc}).json() == []


def _service_rejects(call):
    session = MagicMock()
    with patch.object(AdjustmentRepository, "lock_record", return_value=SimpleNamespace(quantity=7)), patch.object(
        AdjustmentRepository, "add"
    ) as add, patch.object(AdjustmentRepository, "flush") as flush, patch.object(
        AdjustmentRepository, "commit"
    ) as commit:
        with pytest.raises(ValueError) as exc:
            call(session)
    add.assert_not_called()
    commit.assert_not_called()
    flush.assert_not_called()
    return exc.value


@pytest.mark.testid("T62")
def test_service_rejects_below_zero_delta_before_write():
    err = _service_rejects(
        lambda s: AdjustmentService().adjust_by_delta(s, sku="a", location="b", delta=-10, actor="alice")
    )
    assert getattr(err, "field", None) == "delta"
    assert "quantity would go below zero" in str(err)


@pytest.mark.testid("T63")
def test_db_delta_minus_10_is_422_and_quantity_unchanged(client):
    sku, loc, r = _delta_rejected(client)
    assert r.status_code == 422
    assert "delta" in _fields(r)
    assert _qty(client, sku, loc) == [7]


@pytest.mark.testid("T64")
def test_db_rejected_delta_writes_no_audit_row(client):
    sku, loc = _seed(client)
    before = _audit_count(sku, loc)
    assert _post(client, sku, loc, delta=-10).status_code == 422
    assert _audit_count(sku, loc) - before == 0


@pytest.mark.testid("T65")
def test_service_rejects_negative_set_value_before_write():
    err = _service_rejects(
        lambda s: AdjustmentService().adjust_to_value(s, sku="a", location="b", quantity=-2, actor="alice")
    )
    assert getattr(err, "field", None) == "quantity"


@pytest.mark.testid("T66")
def test_db_quantity_minus_2_is_422_and_quantity_unchanged(client):
    sku, loc, r = _qty_rejected(client, -2)
    assert r.status_code == 422
    assert "quantity" in _fields(r)
    assert _qty(client, sku, loc) == [7]


@pytest.mark.testid("T67")
def test_db_rejected_quantity_writes_no_audit_row(client):
    sku, loc = _seed(client)
    before = _audit_count(sku, loc)
    assert _post(client, sku, loc, quantity=-2).status_code == 422
    assert _audit_count(sku, loc) - before == 0
