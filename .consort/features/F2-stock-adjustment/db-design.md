# F2 DB design

**Table** `stock_adjustments` (model `app/models/stock_adjustment.py`): append-only audit of adjust-to-value, FK to `stock_records(sku, location)`.

**S1-adjust-to-value migration** (one revision `create_stock_adjustments`, down_revision = F1 head): SC1 create table, SC2 CHECKs, SC3 composite FK, SC4 immutability trigger, SC5 pair index. Downgrade: drop trigger, function, table. Purely additive; stock_records not altered.

**Invariants**
- PI8: NOT NULL on sku, location, prior_quantity, new_quantity, actor, adjusted_at (default now()).
- PI9: `ck_stock_adjustments_actor_non_blank`.
- PI10: `ck_stock_adjustments_quantities_non_negative`.
- PI11: composite FK ON DELETE RESTRICT.
- PI12: `trg_stock_adjustments_immutable` BEFORE UPDATE OR DELETE raises.
- PI13: repository performs the stock_records update + audit insert in one transaction (no DDL; constraints above make the insert fail and roll back).
- PI14: downgrade/upgrade recreates table, checks, FK, trigger.
- PI15: migration touches no stock_records rows/columns.

**Access patterns**
- AP3: index `(sku, location, adjusted_at, id)` serves the WHERE + ORDER BY adjusted_at DESC, id DESC via backward scan.
