# F1 DB design

`stock_records` (mirrors `app/models/stock_record.py`): id identity PK, sku/location text NOT NULL, quantity integer NOT NULL, tracking_code text NULL, created_at/updated_at timestamptz default now().

## S1-file-stock migration (single reversible revision)
SC1 create table; SC2 UNIQUE (sku, location); SC3 CHECK quantity >= 0; SC4 index on location. Downgrade drops the table.

## Invariants
- PI1: uq_stock_records_sku_location. PI2/PI3/PI4: NOT NULL columns. PI5: ck_stock_records_quantity_non_negative.
- PI6: repository uses `INSERT ... ON CONFLICT (sku, location) DO UPDATE SET quantity, tracking_code, updated_at=now()` against the unique constraint.
- PI7: initial migration downgrade/upgrade recreates table, unique and check.

## Access patterns
- AP1: btree ix_stock_records_location serves DISTINCT location ORDER BY location (unique index leads with sku, so does not help).

## S2-stock-by-location-table migration
SC5: partial index ix_stock_records_location_sku_held on (location, sku) INCLUDE (quantity, tracking_code) WHERE quantity > 0. Reversible (drop index). No table/column changes.
- AP2: that index serves the quantity > 0 filter, optional location equality, and ORDER BY location, sku as an index-only scan. AP1 keeps its own full location index, since the partial index leaves out zero-quantity rows.
