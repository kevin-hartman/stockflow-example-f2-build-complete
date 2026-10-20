"""F2 S2 AC3: delta adjustment audit records the resulting level (real paired-branch DB)."""

import re
import uuid

import pytest


def _uid(prefix):
    return f"{prefix}-{uuid.uuid4()}"


def _seed(client, qty=7):
    sku, loc = _uid("SKU"), _uid("LOC")
    r = client.post("/api/stock", json={"sku": sku, "location": loc, "quantity": qty})
    assert r.status_code == 200, r.text
    return sku, loc


def _delta(client, sku, loc, delta, actor="alice"):
    return client.post("/api/adjustments", json={"sku": sku, "location": loc, "delta": delta, "actor": actor})


def _list(client, sku, loc):
    r = client.get("/api/adjustments", params={"sku": sku, "location": loc})
    assert r.status_code == 200, r.text
    return r.json()


def _fields(resp):
    return [".".join(str(p) for p in e["loc"]) for e in resp.json()["detail"]]


@pytest.mark.testid("T44")
def test_delta_writes_exactly_one_audit_record(client):
    sku, loc = _seed(client)
    r = _delta(client, sku, loc, 5)
    assert r.status_code == 201, r.text
    assert len(_list(client, sku, loc)) == 1


@pytest.mark.testid("T45")
def test_delta_audit_records_resulting_level_and_derived_delta(client):
    sku, loc = _seed(client)
    assert _delta(client, sku, loc, 5).status_code == 201
    (rec,) = _list(client, sku, loc)
    assert rec["prior_quantity"] == 7
    assert rec["new_quantity"] == 12
    assert rec["new_quantity"] - rec["prior_quantity"] == 5


@pytest.mark.testid("T46")
def test_delta_audit_records_actor_and_utc_timestamp(client):
    sku, loc = _seed(client)
    assert _delta(client, sku, loc, 5, actor="carol").status_code == 201
    (rec,) = _list(client, sku, loc)
    assert rec["actor"] == "carol"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+00:00|Z)", rec["adjusted_at"])


@pytest.mark.testid("T47")
def test_zero_delta_rejected_naming_delta(client):
    sku, loc = _seed(client)
    r = _delta(client, sku, loc, 0)
    assert r.status_code == 422
    assert any("delta" in f for f in _fields(r)) or "delta" in r.text
    assert _list(client, sku, loc) == []


@pytest.mark.testid("T48")
def test_delta_with_empty_actor_rejected_naming_actor(client):
    sku, loc = _seed(client)
    r = _delta(client, sku, loc, 5, actor="")
    assert r.status_code == 422
    assert any("actor" in f for f in _fields(r))
    assert _list(client, sku, loc) == []
