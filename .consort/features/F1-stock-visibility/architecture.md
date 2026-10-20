# Architecture – F1-stock-visibility

## Layering summary
Service-backed, persisting feature. React SPA (`client/`, `renders_via: react`) over a JSON API.
boundary `app/routes/` -> service `app/services/` -> repository `app/repositories/` -> models `app/models/` (package; `app/models/stock_record.py`) -> infrastructure `app/database.py`.
Routes obtain their session via the service's re-export of `app/repositories/session.py:get_session`; only the repository touches the ORM. This layout is the project convention. The scaffold's flat `app/models.py` is replaced by the `app/models/` package.

S1 owners: `app/routes/stock.py` (EP1, EP2), `app/routes/locations.py` (EP3), `app/services/stock_service.py`, `app/repositories/stock_repository.py`, `app/models/stock_record.py`; client `client/src/api/stock.ts`, `client/src/hooks/useFileStock.ts`/`useStockRecord.ts`/`useLocations.ts`, `client/src/pages/FileStockPage.tsx`.

| AC | Layer | Contract |
|---|---|---|
| AC1-file-stock-record | E2E | EP1 (+ EP3 option source) |
| AC2-retrieve-stock-record | E2E | EP2 |
| AC3-collision-resolved-at-write | API | EP1 (write rule: upsert) |
| S3 AC1-lists-stock-across-locations | E2E | EP5 |
| S3 AC2-shows-tracking-code | E2E | EP5 |
| S3 AC3-par-level-not-tracked | E2E | EP5 (par_level null) |
| S3 AC4-sku-with-no-stock-empty-state | E2E | EP5 (locations []) |

S3 owners: `app/routes/skus.py` (EP5), `StockService.get_sku_detail`, `StockRepository.list_held_for_sku`; client `client/src/api/skus.ts`, `client/src/hooks/useSkuDetail.ts`, `client/src/pages/SkuDetailPage.tsx` at `/sku/:sku`.

## Architectural Concerns Mapping
| Concern | Owner layer | Module | Notes |
|---|---|---|---|
| Input validation (sku/location non-empty, quantity int >= 0, blank tracking_code -> null) | API boundary (schema) + service (domain rule) | `app/routes/stock.py` Pydantic schemas; `app/services/stock_service.py` | 422 names the offending field |
| Collision resolution (upsert on (sku, location)) | service rule, repository mechanism | `stock_service.file_stock` -> `stock_repository.upsert` | ON CONFLICT DO UPDATE |
| Transactions | service layer | `stock_service` commits once per request | never in models |
| Persistence / ORM | repository | `app/repositories/stock_repository.py` | only ORM toucher |
| Config (DATABASE_URL) | infrastructure | `app/database.py` | env-only, twelve-factor |
| Auth/authz | N/A – out of bounds V1 | — | |
| Audit (timestamp/actor) | N/A for F1 – deferred (OD3) | — | |
| Logging / observability | cross-cutting (substrate) | scaffold | |
| Caching | N/A – out of bounds | — | |

## Pattern proposals
- Repository pattern: `StockRepository` (upsert, get_by_key, distinct_locations) behind the service (DIP).
- Single-responsibility service `StockService.file_stock / get_record / list_locations`.
- Thin routes: parse/validate -> call service -> serialize `StockRecord` DTO.
- Client: `api/` fetch wrappers -> `hooks/` -> `pages/FileStockPage` with creatable combobox `field-location` fed by EP3.
- S2: `StockService.list_stock(location=None)` -> `StockRepository.list_held` (quantity > 0, ORDER BY location, sku) behind EP4 `GET /api/stock`; client `pages/HomePage` + `components/StockTable` (stock-table, right-aligned stock-col-quantity) + `warehouse-select` fed by EP3; empty response -> `stock-empty`.
- S3: `StockService.get_sku_detail(sku)` -> `StockRepository.list_held_for_sku` (WHERE sku = :sku AND quantity > 0 ORDER BY location) behind EP5 `GET /api/skus/{sku}`; served by the UNIQUE (sku, location) index prefix, so no new access pattern. `par_level` is always null in F1 (no par column).

## Risks
- S2 home table is unpaginated; a large stock_records table needs pagination in a later story (AP2 index keeps the filtered read cheap).
- Upsert semantics: a re-file replaces (not adds to) the quantity; adjustments/receipts (F2/F3) must use their own additive operations.
- Locations derived from stock_records (OD1): a location cannot exist without a record; if a catalog is later needed it is an additive table.
- `app/models.py` -> `app/models/` package move must keep Alembic `env.py` metadata import working.
- S3 `par_level: null` is a placeholder; a par-level feature adds a nullable column/table additively and fills it without changing EP5's shape.

## Decisions
- D1 (OD1) locations derived from DISTINCT stock_records.location — recommend: accept (resolved).
- D2 (OD2) no SKU catalog; first filing establishes a SKU — recommend: accept (resolved).
- D3 (OD3) adjustment audit + overcommit deferred to F2/F4 — recommend: defer.
- D5 (S2) 'holding stock' = quantity > 0; a location whose records are all quantity 0 stays in EP3 and lists [] via EP4 -> stock-empty (consistent with OD1) — recommend: accept.
- D6 (S3) a stockless or never-filed SKU returns 200 with `locations: []` (not 404), rendering `sku-empty` — consistent with OD2 (no SKU catalog) — recommend: accept.
- D4 collision = in-place upsert returning 200 (R3) — recommend: accept.

## Test strategy
Real-DB integration tests against the paired Lakebase branch (`DATABASE_URL`, `databricks_postgres`), Alembic upgrade head first, FK-aware targeted DELETE cleanup; pytest-bdd (`.feature` + `tests/step_defs/test_*.py` + `tests/conftest.py`). No mocks, stubs or in-memory DBs.
- AC3 (+ API halves of AC1/AC2): pytest-bdd against EP1/EP2.
- AC1, AC2: Playwright e2e against the live API on the branch.
- S2 AC1–AC3: Playwright e2e against EP4/EP3 on the branch (quantity-0 seed for the empty state); AP2 handed to the DBA.
- S3 AC1–AC4: Playwright e2e against EP5 on the branch (multi-SKU seed, null tracking_code, quantity-0-only SKU); pytest-bdd API checks of EP5 shape.
- PI1–PI7 + NFR1–NFR3 clauses: DB-integration fitness tests on the branch.

## Sign-off
Recommendation: proceed. — architect-reviewer
