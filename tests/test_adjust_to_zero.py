"""F2 S3 AC3: a delta taking stock to exactly zero is accepted (real paired-branch DB)."""

import uuid

import pytest
import sqlalchemy as sa

from app.database import engine


def _seed(client):
    sku, loc = f"SKU-{uuid.uuid4()}", f"LOC-{uuid.uuid4()}"
    r = client.post("/api/stock", json={"sku": sku, "location": loc, "quantity": 7})
    assert r.status_code == 200, r.text
    return sku, loc


def _adjust(client, sku, loc):
    return client.post("/api/adjustments", json={"sku": sku, "location": loc, "delta": -7, "actor": "alice"})


@pytest.mark.testid("T53")
def test_delta_to_exactly_zero_accepted_and_quantity_zero(client):
    sku, loc = _seed(client)
    assert _adjust(client, sku, loc).status_code == 201
    r = client.get(f"/api/skus/{sku}")
    assert [x["quantity"] for x in r.json()["locations"] if x["location"] == loc] == [0]


@pytest.mark.testid("T54")
def test_delta_to_zero_writes_one_audit_row_7_to_0(client):
    sku, loc = _seed(client)
    assert _adjust(client, sku, loc).status_code == 201
    with engine.connect() as c:
        rows = c.execute(
            sa.text("SELECT prior_quantity, new_quantity FROM stock_adjustments WHERE sku=:s AND location=:l"),
            {"s": sku, "l": loc},
        ).all()
    assert [tuple(r) for r in rows] == [(7, 0)]
