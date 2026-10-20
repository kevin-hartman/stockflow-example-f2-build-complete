"""EP5 GET /api/skus/{sku}: JSON boundary (NFR5)."""

import uuid

import pytest


def _file(client, sku, location, quantity):
    r = client.post("/api/stock", json={"sku": sku, "location": location, "quantity": quantity})
    assert r.status_code == 200


@pytest.mark.testid("T52")
def test_sku_detail_with_stock_is_json(client):
    sku = f"SKU-{uuid.uuid4()}"
    loc = f"LOC-{uuid.uuid4()}"
    _file(client, sku, loc, 4)
    r = client.get(f"/api/skus/{sku}")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert [x["location"] for x in r.json()["locations"]] == [loc]


@pytest.mark.testid("T64")
def test_sku_detail_without_stock_is_200_json_empty(client):
    sku = f"SKU-{uuid.uuid4()}"
    r = client.get(f"/api/skus/{sku}")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert r.json()["locations"] == []
