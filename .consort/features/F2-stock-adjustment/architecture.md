# Architecture – F2-stock-adjustment (S1-adjust-to-value)

Inherits the F1 layout: boundary `app/routes/` (JSON, React SPA under `client/`) -> service `app/services/` -> repository `app/repositories/` (sole ORM/session user; `session.py` door re-exported by the service) -> models `app/models/` -> infrastructure `app/database.py`. service_backed: true.

## Layer assignments

- AC1-form-sets-corrected-level – **E2E** (form submit -> POST EP6 -> confirmation -> SKU detail shows 4).
- AC2-audit-record-captures-when-and-who – **API** (write rule: atomic quantity update + audit insert; EP6/EP7).
- AC3-audit-record-unmodifiable – **API** (no mutation route -> 405; DB trigger rejects UPDATE/DELETE).
- AC4-actor-required – **E2E** (server 422 naming `actor` rendered inline at `field-actor-error`); backend rule also pinned by NFR1 clause 5 + PI9.

## Architectural Concerns Mapping

| Concern | Owner layer | Module | Notes |
|---|---|---|---|
| Input validation (actor/sku/location/quantity) | Boundary + service | `app/routes/adjustments.py`, `app/services/adjustment.py` | 422 `{detail:[{field,message}]}` naming the field (shared `app/routes/errors.py`) |
| Transactions | Service | `app/services/adjustment.py` | one commit per adjustment (quantity update + audit insert) |
| Audit (who/when) | Service -> repository | `app/repositories/adjustment.py`, `app/models/stock_adjustment.py` | append-only; actor is caller-supplied (no auth in V1) |
| Immutability | Boundary + DB | routes expose GET/POST only; trigger on `stock_adjustments` | defense in depth |
| Persistence | Repository | `app/repositories/adjustment.py`, `app/repositories/stock.py` | `SELECT ... FOR UPDATE` on the stock row to read prior qty |
| Time stamping | DB default / service | `adjusted_at` server default `now()` (UTC) | never client-supplied |
| AuthN/AuthZ | N/A | – | out of bounds for V1 |
| Config | Infrastructure | `app/database.py` | DATABASE_URL from env |
| Caching | N/A | – | out of bounds |

## Pattern proposals

- `AdjustmentService.adjust_to_value(session, sku, location, quantity, actor)` – validates, locks the stock row, writes `StockAdjustment`, updates `StockRecord.quantity`, commits once. S2 (by-delta) adds a sibling operation on the same service (OCP).
- `AdjustmentRepository` (insert + list_by_pair, no update/delete methods) – ISP keeps the immutability visible in the API surface.
- New model module `app/models/stock_adjustment.py`; new routes module `app/routes/adjustments.py`.
- Client: `client/src/api/adjustments.ts`, `hooks/useAdjustStock`, `pages/AdjustPage` with optimistic update reconciled to the 201 response (R5).

## Risks

- FK `ON DELETE RESTRICT` blocks deleting a stock record with history; acceptable (no delete feature) but must be revisited if one is added.
- Trigger-based immutability lives in the migration; the reversibility test must confirm the trigger is recreated.
- Concurrent adjustments of the same pair: serialized via row lock; multi-operator conflict resolution beyond that is out of bounds.

## Decisions

- OD1-adjustment-audit-home – **resolved**: dedicated append-only `stock_adjustments` table (recommended; accepted headless).
- OD-scope-adjust-location-options – **open for PO**: recommend reusing EP3 + EP2 (404 -> `form-error`) for S1, no new endpoint; no S1 AC depends on it (AC1 prefills via `?sku=&location=`).
- Negative corrected quantity rejection UX is deferred to S3-reject-negative-stock; S1 relies on PI10 + F1 PI5 at the DB.

## Test strategy

Real integration tests against the paired Lakebase branch (`databricks_postgres` via DATABASE_URL), pytest-bdd (`tests/features/*.feature`, `tests/step_defs/test_*.py`, `tests/conftest.py`), Alembic upgraded to head first, FK-aware targeted DELETE cleanup (audit rows cleaned by dropping/recreating via a test-only trigger bypass is NOT allowed; tests use unique sku values per scenario). No mocks, stubs, SQLite or in-memory DB. API suite: AC2, AC3 + PI8–PI15. Playwright e2e against the live API: AC1, AC4.

## Sign-off

Recommendation: **proceed**. – architect-reviewer

## S2-adjust-by-delta addendum

- **Layering:** reuses S1's stack unchanged. EP6 `POST /api/adjustments` accepts exactly one of `quantity` | `delta`; `AdjustmentService.adjust_by_delta` (app/services/adjustment.py) reads the stock_records row under `SELECT ... FOR UPDATE` via the repository, computes `new = prior + delta`, updates quantity and inserts one `StockAdjustment` in one commit (PI13). The client `AdjustPage` adds the `adjust-mode` toggle, `field-delta`, `adjust-delta-preview`.
- **Decisions:** OD2 resolved – the audit delta is derived (`new_quantity - prior_quantity`) in responses (EP6/EP7 `delta`), no new column or migration; no new persistence invariant or access pattern (EP7 read shape is AP3).
- **NFRs:** NFR3 gains a delta clause realized by AC1-positive-delta-increases-level. Delta-driven negative results are S3-reject-negative-stock's (NFR2, PI10 + stock_records CHECK as backstop).
- **Risks:** lost-update under concurrent deltas is defended by the row lock; not separately fitness-tested in V1.
- **Test strategy:** AC1/AC2 Playwright against the live API on the paired branch; AC3 pytest-bdd against the paired branch (no mocks).
- **Sign-off:** proceed – architect-reviewer.

## S3-reject-negative-stock addendum

- **Layering:** the never-negative rule is owned by `AdjustmentService` (app/services/adjustment.py): after locking the stock_records row via app/repositories, it rejects `quantity < 0` (field `quantity`) and `prior + delta < 0` (field `delta`, "quantity would go below zero") BEFORE any write, returning the EP6 422 field-named envelope; result `0` is accepted. Client-side checks in AdjustPage are UX only; the boundary maps 422 `field` to `field-delta-error` / `field-quantity-error`, never `form-error`.
- **DB backstop:** stock_records CHECK (quantity >= 0) (F1) and PI10 reject any negative that slips past the service; PI13 keeps the update + audit atomic. No new persistence invariant, access pattern or migration.
- **NFRs:** NFR2 gains three clauses (delta reject + value reject realized by AC4; zero-boundary accept realized by AC3).
- **Risks:** the service guard must read prior under `FOR UPDATE` so concurrent deltas cannot jointly go below zero; the DB CHECK is the final guard.
- **Test strategy:** AC1–AC3 Playwright against the live API on the paired branch; AC4 pytest-bdd direct POSTs against the paired branch (no mocks).
- **Sign-off:** proceed – architect-reviewer.
