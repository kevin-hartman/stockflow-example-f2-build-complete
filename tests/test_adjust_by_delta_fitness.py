"""F2 S2 NFR3: a delta adjustment addresses the existing (sku, location) pair, never inserting a second row."""

import uuid

import pytest
import sqlalchemy as sa


@pytest.mark.testid("T39")
def test_positive_delta_updates_single_existing_row(client, db_session):
    sku, loc = f"SKU-{uuid.uuid4()}", f"LOC-{uuid.uuid4()}"
    r = client.post("/api/stock", json={"sku": sku, "location": loc, "quantity": 7})
    assert r.status_code == 200, r.text
    r = client.post("/api/adjustments", json={"sku": sku, "location": loc, "delta": 5, "actor": "alice"})
    assert r.status_code == 201, r.text
    rows = db_session.execute(
        sa.text("SELECT quantity FROM stock_records WHERE sku=:s AND location=:l"), {"s": sku, "l": loc}
    ).all()
    assert [row[0] for row in rows] == [12]
