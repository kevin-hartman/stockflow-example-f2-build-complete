# navigator-reconcile (navigator) – sonnet

## Prompt

```
FEATURE-COMPLETE RECONCILIATION for F1-stock-visibility: every story is now designed + gated. Independently check the WHOLE set of stories against ITSELF — symmetrically, every story vs every other, INCLUDING the first-designed story (which was never checked against its later siblings). The cross-story context (all stories' ACs + the architecture's open_decisions + its mandated not-null fields) is injected below. Look ONLY for CROSS-STORY defects: an AC that contradicts another story's gated AC; a mandated (not-null) field no story's submit AC supplies; two stories' ACs overlapping on the same observable behavior; a persistence invariant anchored to the wrong story. Do NOT re-review a single story in isolation — each already passed its own reflect + gate. Write the verdict to <PROJECT_ROOT>/.consort/features/F1-stock-visibility/reconcile-verdict.json: {"version":1,"passed":<bool>,"findings":[{"owner":"spec-author"|"test-strategist"|"architect-reviewer"|"ux-designer","story":"<the OWNING story to change>","detail":"<the cross-story defect>","ac_ids":["<exact AC id(s)>"],"severity":"blocking"|"advisory"}]}. Use passed:true with findings:[] when the stories are mutually consistent. Each finding names the OWNING story (the one reopened + changed) and its author. Produce ONLY the verdict file, then stop.FEATURE-COMPLETE CROSS-STORY RECONCILIATION — every story below is now designed + gated. Check the WHOLE set against ITSELF, symmetrically (every story vs every other, including the first-designed one): an AC that contradicts another story's gated AC; a mandated (not-null) field no story's submit AC supplies; two stories' ACs that overlap on the same observable behavior; an invariant anchored to the wrong story. For each defect, name the OWNING story (the one to change) + its author (owner). This IS the context — do not run `consort-cross-story-context` yourself.

{
  "stories": [
    {
      "story": "S1-file-stock",
      "acs": [
        {
          "ac_id": "AC1-file-stock-record",
          "status": "draft",
          "layer": "E2E",
          "given": "an operator on the file-stock form, where the locations already on record are offered for selection and a brand-new location can also be entered",
          "when": "they submit a SKU, a location (either an existing one chosen without retyping, or a new one never used before), a quantity, and optionally a tracking_code",
          "then": "the form confirms the stock record was filed for that (sku, location) with the submitted quantity; the tracking_code is stored when given and stored as absent (not tracked) when omitted, and neither a new location nor an omitted tracking_code blocks the submission",
          "architectural_notes": "E2E client-server contract: FileStockPage (client/src/pages) submits via api/stock.ts to POST /api/stock (app/routes/stock.py -> StockService.file_stock -> StockRepository.upsert), and file-confirmation renders the server's returned record. field-location is a creatable combobox fed by GET /api/locations (EP3, distinct stock_records.location), so an existing location is chosen without retyping and a new one is accepted; blank tracking_code is normalized to null (not tracked) in the service. Validation lives at the boundary schema + service, the transaction in the service, persistence only in the repository."
        },
        {
          "ac_id": "AC2-retrieve-stock-record",
          "status": "draft",
          "layer": "E2E",
          "given": "a stock record previously filed for a (sku, location) pair",
          "when": "the operator retrieves the stock for that same (sku, location) later",
          "then": "the returned record shows the same SKU, location, quantity and tracking_code (or 'not tracked' when none was filed) that were filed",
          "architectural_notes": "E2E read-back: the stock-lookup panel calls GET /api/stock/record?sku=&location= (app/routes/stock.py -> StockService.get_record -> StockRepository.get_by_key, a unique-key lookup on (sku, location)) in a later request and lookup-result renders the persisted values; a null tracking_code renders lookup-not-tracked. Verified against the real paired branch, never a mocked response, so a broken read path fails independently of filing."
        },
        {
          "ac_id": "AC3-collision-resolved-at-write",
          "status": "draft",
          "layer": "API",
          "given": "an existing stock record for a (sku, location) pair",
          "when": "the operator files stock for the same (sku, location) again with a different quantity and/or tracking_code",
          "then": "the existing record is updated in place with the newly filed values, exactly one record for that (sku, location) exists, no duplicate is stored, and the operator sees the normal filed confirmation rather than an error page",
          "architectural_notes": "API write rule owned by StockService.file_stock: a re-file of an existing (sku, location) is resolved at write time by StockRepository.upsert (INSERT ... ON CONFLICT (sku, location) DO UPDATE) in one service-owned transaction, returning the normal 200 filed record, never a 409/500. Backed by the UNIQUE (sku, location) constraint (PI1) and atomic upsert (PI6); a pytest-bdd test against the paired branch asserts exactly one row with the new values."
        }
      ]
    },
    {
      "story": "S2-stock-by-location-table",
      "acs": [
        {
          "ac_id": "AC1-table-lists-stock-by-location",
          "status": "draft",
          "layer": "E2E",
          "given": "stock records filed for several SKUs across several locations, some with a tracking_code and some without",
          "when": "the operator opens the home screen",
          "then": "a stock-by-location table shows one row per (sku, location) holding stock, with SKU, location, quantity and tracking code columns; a row with a tracking_code shows it, and a row without one shows an explicit 'not tracked', never a blank cell",
          "architectural_notes": "E2E client-server contract: HomePage (client/src/pages) loads via api/stock.ts + a useStock hook from GET /api/stock (app/routes/stock.py -> StockService.list_stock -> StockRepository.list_held, quantity > 0, ordered by location, sku) and renders one stock-row per returned record. A null tracking_code renders the explicit tracking-not-tracked label in the client, never a blank cell; verified by Playwright against the live API on the paired branch, no mocked envelope."
        },
        {
          "ac_id": "AC2-quantity-right-aligned",
          "status": "draft",
          "layer": "E2E",
          "given": "the home stock-by-location table showing rows with quantities of differing digit lengths",
          "when": "the operator scans the quantity column",
          "then": "every quantity value (and its column header) is right-aligned so digits line up for comparison, while the text columns are left-aligned",
          "architectural_notes": "E2E presentation over real server rows: the StockTable component (client/src/components) styles the stock-col-quantity header and every stock-qty cell right-aligned (tabular-nums, --font-mono) while SKU/location/tracking columns stay left-aligned; no business logic, alignment is a client-only concern. A Playwright test seeds quantities of differing digit lengths on the paired branch and asserts computed text-align per column."
        },
        {
          "ac_id": "AC3-empty-location-state",
          "status": "draft",
          "layer": "E2E",
          "given": "a location that is on record but holds no stock (it has no records, or only quantity-0 records)",
          "when": "the operator views the stock table for that location",
          "then": "an explicit 'No stock at this location' message is shown in place of rows, never a blank page or an empty table body",
          "architectural_notes": "E2E client-server contract per OD1 (resolved): warehouse-select is fed by GET /api/locations (EP3, all distinct locations incl. quantity-0-only ones); choosing one calls GET /api/stock?location= which StockService.list_stock returns [] for a location holding no stock (quantity > 0 filter in StockRepository). The client renders the stock-empty 'No stock at this location' state in place of the table body when the real response is empty; seeded with a quantity-0 record on the paired branch, never mocked."
        }
      ]
    },
    {
      "story": "S3-sku-detail-view",
      "acs": [
        {
          "ac_id": "AC1-lists-stock-across-locations",
          "status": "draft",
          "layer": "E2E",
          "given": "a SKU holding stock at several locations, and other SKUs also holding stock",
          "when": "the operator opens that SKU's detail view",
          "then": "the view lists exactly that SKU's locations holding stock, each with its quantity, and no other SKU's stock",
          "architectural_notes": "E2E client-server contract: SkuDetailPage (client/src/pages, route /sku/:sku) loads via api/skus.ts + useSkuDetail from GET /api/skus/{sku} (app/routes/skus.py -> StockService.get_sku_detail -> StockRepository.list_held_for_sku, WHERE sku = :sku AND quantity > 0 ORDER BY location) and renders one sku-location row per returned location with its right-aligned quantity. Filtering to this SKU is a repository query concern, never client-side; a Playwright test seeds several SKUs on the paired branch and asserts only this SKU's locations appear."
        },
        {
          "ac_id": "AC2-shows-tracking-code",
          "status": "draft",
          "layer": "E2E",
          "given": "a SKU with one location's record filed with a tracking_code and another location's record filed without one",
          "when": "the operator opens that SKU's detail view",
          "then": "the location filed with a tracking_code shows that combined code, and the location filed without one shows an explicit 'not tracked', never a blank",
          "architectural_notes": "E2E client-server contract over EP5: each location's tracking_code from the real response renders in its sku-tracking cell; a null tracking_code renders the explicit sku-tracking-not-tracked 'Not tracked' label in the client, never a blank. Null-normalization was done at write time by StockService (S1); verified by Playwright on the paired branch with one coded and one uncoded record."
        },
        {
          "ac_id": "AC3-par-level-not-tracked",
          "status": "draft",
          "layer": "E2E",
          "given": "a SKU holding stock, for which par level is not tracked",
          "when": "the operator opens that SKU's detail view",
          "then": "the par level region shows an explicit 'not tracked', never a blank region or an error",
          "architectural_notes": "E2E client-server contract over EP5: F1 does not track par level, so the service returns par_level null and the sku-par-level card renders sku-par-not-tracked 'Not tracked' from that real response, never a blank region or sku-error. No persistence change (no par column in F1); Playwright asserts the region against the live API on the paired branch."
        },
        {
          "ac_id": "AC4-sku-with-no-stock-empty-state",
          "status": "draft",
          "layer": "E2E",
          "given": "a SKU that holds no stock at any location (no records, or only quantity-0 records)",
          "when": "the operator opens that SKU's detail view",
          "then": "an explicit empty state stating the SKU has no stock at any location is shown, never a blank page or an error page",
          "architectural_notes": "E2E client-server contract over EP5: for a SKU with no records or only quantity-0 records the service returns 200 with locations [] (no 404, consistent with OD2: no SKU catalog), and SkuDetailPage renders the sku-empty 'This SKU has no stock at any location' state instead of rows or an error page. Playwright seeds a quantity-0-only SKU plus an unfiled SKU on the paired branch, never a mocked envelope."
        }
      ]
    }
  ],
  "open_decisions": [
    {
      "id": "OD1-location-source",
      "question": "Are locations a separate catalog table or derived from distinct stock_records.location, and what is an 'empty location'?",
      "decision_status": "resolved",
      "resolved_by_story": "S1-file-stock",
      "resolution": "Derived: locations = DISTINCT stock_records.location (EP3); a new location comes into existence by filing stock at it. An 'empty location' (S2 stock-empty) is a location whose records all have quantity 0, which the CHECK (quantity >= 0) permits; no separate locations table in F1."
    },
    {
      "id": "OD2-sku-catalog",
      "question": "Is a separate SKU catalog needed to decide whether a SKU is 'known', or does stock_records establish it?",
      "decision_status": "resolved",
      "resolved_by_story": "S1-file-stock",
      "resolution": "No SKU catalog in F1: the first filing of a SKU establishes it; any non-empty trimmed sku string is accepted. A later feature introducing an unknown-SKU rule must reconcile with this."
    },
    {
      "id": "OD3-adjustment-audit-and-overcommit",
      "question": "Where do R1's unmodifiable adjustment timestamp+actor and R2's pick-overcommit rejection live (adjustment/pick ledger table)?",
      "decision_status": "deferred"
    }
  ],
  "required_persistence_fields": [
    {
      "invariant_id": "PI2-sku-not-null",
      "table": "stock_records",
      "brief": "stock_records.sku is NOT NULL; inserting a row without a sku is rejected by the DB."
    },
    {
      "invariant_id": "PI3-location-not-null",
      "table": "stock_records",
      "brief": "stock_records.location is NOT NULL; inserting a row without a location is rejected by the DB."
    },
    {
      "invariant_id": "PI4-quantity-not-null",
      "table": "stock_records",
      "brief": "stock_records.quantity is NOT NULL; inserting a row without a quantity is rejected by the DB (tracking_code stays NULLABLE: absent = not tracked)."
    }
  ]
} Be terse: produce ONLY the required artifact file(s) on disk, then stop with at most a one-line confirmation. Do NOT print a plan, a summary of what you did, rationale, tables, or restate the artifacts to stdout, that output is wasted latency. The files on disk are the deliverable, not your prose.
```

## Tools used

- Write {"file_path":"<PROJECT_ROOT>/.consort/features/F1-stock-visibility/reconcile-verdict.json","content":"{\"version\":1,\"passed\":true,\"findings\":[]}\n"}

## Final reasoning

Wrote `reconcile-verdict.json` with `passed: true` and no findings. I found no cross-story defects in S1, S2 and S3.
