# architect-reviewer (architect-reviewer) – opus

## Prompt

```
Annotate story S2-stock-by-location-table's acceptance criteria + nfrs.md coverage. Author architectural_notes for ALL of story S2-stock-by-location-table's ACs: AC1-table-lists-stock-by-location, AC2-quantity-right-aligned, AC3-empty-location-state. Every one of this story's ACs MUST end up with a non-empty "architectural_notes" field in its acs/<AC>.json (the layer it lives in + how it realizes the design) — the design gate verifies that, and the spec-author's "layer" field does NOT count. architectural_notes are per-AC, so author the scoped ACs above even when the feature-level architecture.json already exists from an earlier story. For every E2E AC, ALSO pass consort-annotate-ac --ui-seams with the ia.md data-testid seam token(s) the AC's UI drives — the column / cell / region / empty-state / form field it asserts (e.g. "stock-cell-tracking,stock-not-tracked"). A deterministic gate checks each seam is named in <PROJECT_ROOT>/.consort/design/ia.md; if the AC needs a surface the IA does not yet name, declare the seam you need anyway and the gate routes the ux-designer to add it to ia.md. In architecture.json, make an EXPLICIT service_backed call (required): set service_backed:true if the feature persists data (a DB table/migration) or carries business logic, and then you MUST declare boundary, service, and repository layers (plus a "models" PACKAGE app/models/, one module per domain object, NOT a flat app/models.py, when it persists entities); set false ONLY for a trivial static/read-through endpoint. An Infra-layer AC or a migration/schema/storage NFR while service_backed is false hard-blocks the gate. When service_backed:true you MUST also declare architecture.json persistence_invariants[]: the DB-level guarantees the schema enforces (each with id, type one of unique|foreign_key|cascade|not_null|check|transactional|migration_reversible, table, and a one-line brief), covering unique/composite keys, foreign keys + cascade rules, NOT NULL / CHECK constraints, any transactional-atomicity boundary, and migration reversibility. The test-strategist must cover each with a real-branch test; a service_backed feature with no persistence_invariants hard-blocks the gate. When THIS story introduces a NEW read/query shape over the schema — a filter, lookup, sort, or join an AC drives (e.g. "list stock filtered by location", "look up a SKU's rows by sku") that is an INDEX candidate — declare it in architecture.json access_patterns[] (id, a one-line brief, and the table + column(s) it reads) so the DBA is pulled back in to reconsider the physical design for it; this is how a later READ story evolves the schema, since a story that adds no persistence_invariant would otherwise skip the DBA. Declare an access_pattern ONLY for a genuinely new query shape (not for every read, and not for one already covered by a prior story's pattern or a primary-key lookup). REUSE the established project architecture conventions (set by F1-stock-visibility): boundary=app/routes (react), service=app/services, repository=app/repositories, models=app/models, infrastructure=app/database.py. Declare the SAME role -> module paths in architecture.json, do NOT remap or rename an established layer; a divergent layout hard-blocks the spec gate and mismatches the inherited code. Author this story's architectural_notes FRESH from the ACs + IA on disk this turn. On a reflect-revise re-run the self-heal clears this story's prior architectural_notes BY DESIGN, so an absent/empty prior is the expected revise state — re-derive against the corrected ACs + IA. Write every artifact under the ABSOLUTE artifact root <PROJECT_ROOT>/.consort (this feature: <PROJECT_ROOT>/.consort/features/F1-stock-visibility/; this story: <PROJECT_ROOT>/.consort/features/F1-stock-visibility/stories/S2-stock-by-location-table/); use that absolute path and never resolve or guess the project root yourself.CROSS-STORY CONTEXT — this story is NOT reviewed in isolation. The feature's OTHER stories' ACs, the architecture's open_decisions, and its mandated (not-null) persistence fields are below; use them for the cross-story checks (an AC contradicting a gated sibling AC; a mandated field no sibling submit AC supplies). This IS that context — do not run `consort-cross-story-context` yourself.

{
  "current_story": "S2-stock-by-location-table",
  "sibling_stories": [
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

- Bash {"command":"cd <PROJECT_ROOT>/.consort/features/F1-stock-visibility; cat stories/S2-stock-by-location-table/acs/*.json; cat architecture.json; grep -n \"stock-\\|location\" ../../design/ia.md | head -60","description":"Read S2 ACs, architecture, IA seams"}
- Bash {"command":"python3 - <<'EOF'\nimport json\np='architecture.json'; a=json.load(open(p))\na['api_contracts']=[c for c in a['api_contracts'] if c['id']!='EP4-list-stock']+[{\"id\":\"EP4-list-stock\",\"method\":\"GET\",\"path\":\"/api/stock\",\"query\":[\"location\"],\"shape\":\"list\",\"item\":\"bare JSON array of StockRecord {sku: string, location: string, quantity: integer (> 0), tracking_code: string|null (null = not tracked)}: one entry per (sku, location) HOLDING stock (quantity > 0), ordered by location then sku; optional location filters to that one location; [] when nothing is held (incl. a location on record with only quantity-0 records).\",\"story\":\"S2-stock-by-location-table\"}]\na['access_patterns']=[x for x in a['access_patterns'] if x['id']!='AP2-stock-held-by-location']+[{\"id\":\"AP2-stock-held-by-location\",\"table\":\"stock_records\",\"columns\":[\"location\",\"sku\",\"quantity\"],\"story\":\"S2-stock-by-location-table\",\"brief\":\"SELECT sku, location, quantity, tracking_code FROM stock_records WHERE quantity > 0 [AND location = :loc] ORDER BY location, sku (EP4); location-leading filter + sort not served by the (sku, location) unique index.\"}]\njson.dump(a,open(p,'w'),indent=2)\nEOF\ngrep -n \"^#\" architecture.md","description":"Add EP4 list-stock contract and AP2 access pattern"}
- Bash {"command":"cd <PROJECT_ROOT> && L=./scripts/lk; F=F1-stock-visibility; S=S2-stock-by-location-table\n$L consort-annotate-ac --feature $F --story $S --ac AC1-table-lists-stock-by-location --layer E2E --api-contract EP4-list-stock --ui-seams \"stock-table,stock-row-<sku>-<loc>,stock-qty-<sku>-<loc>,stock-tracking-<sku>-<loc>,tracking-not-tracked\" --notes \"E2E client-server contract: HomePage (client/src/pages) loads via api/stock.ts + a useStock hook from GET /api/stock (app/routes/stock.py -> StockService.list_stock -> StockRepository.list_held, quantity > 0, ordered by location, sku) and renders one stock-row per returned record. A null tracking_code renders the explicit tracking-not-tracked label in the client, never a blank cell; verified by Playwright against the live API on the paired branch, no mocked envelope.\" && \\\n$L consort-annotate-ac --feature $F --story $S --ac AC2-quantity-right-aligned --layer E2E --api-contract EP4-list-stock --ui-seams \"stock-table,stock-col-quantity,stock-qty-<sku>-<loc>\" --notes \"E2E presentation over real server rows: the StockTable component (client/src/components) styles the stock-col-quantity header and every stock-qty cell right-aligned (tabular-nums, --font-mono) while SKU/location/tracking columns stay left-aligned; no business logic, alignment is a client-only concern. A Playwright test seeds quantities of differing digit lengths on the paired branch and asserts computed text-align per column.\" && \\\n$L consort-annotate-ac --feature $F --story $S --ac AC3-empty-location-state --layer E2E --api-contract EP4-list-stock --ui-seams \"warehouse-select,stock-empty,stock-table\" --notes \"E2E client-server contract per OD1 (resolved): warehouse-select is fed by GET /api/locations (EP3, all distinct locations incl. quantity-0-only ones); choosing one calls GET /api/stock?location= which StockService.list_stock returns [] for a location holding no stock (quantity > 0 filter in StockRepository). The client renders the stock-empty 'No stock at this location' state in place of the table body when the real response is empty; seeded with a quantity-0 record on the paired branch, never mocked.\" && \\\n$L consort-response-formatter --role architect-reviewer --feature $F --story $S","description":"Annotate S2 ACs and run self-check"}
- Read {"file_path":"<PROJECT_ROOT>/.consort/features/F1-stock-visibility/architecture.md","offset":29,"limit":25}
- Bash {"command":"cd <PROJECT_ROOT>/.consort/features/F1-stock-visibility && python3 - <<'EOF'\np='architecture.md'; s=open(p).read()\ns=s.replace(\"fed by EP3.\\n\",\"fed by EP3.\\n- S2: `StockService.list_stock(location=None)` -> `StockRepository.list_held` (quantity > 0, ORDER BY location, sku) behind EP4 `GET /api/stock`; client `pages/HomePage` + `components/StockTable` (stock-table, right-aligned stock-col-quantity) + `warehouse-select` fed by EP3; empty response -> `stock-empty`.\\n\",1)\ns=s.replace(\"existence by filing\",\"existence by filing\",1)\ns=s.replace(\"- D4 collision\",\"- D5 (S2) 'holding stock' = quantity > 0; a location whose records are all quantity 0 stays in EP3 and lists [] via EP4 -> stock-empty (consistent with OD1) — recommend: accept.\\n- D4 collision\",1)\ns=s.replace(\"- AC1, AC2: Playwright e2e against the live API on the branch.\\n\",\"- AC1, AC2: Playwright e2e against the live API on the branch.\\n- S2 AC1–AC3: Playwright e2e against EP4/EP3 on the branch (quantity-0 seed for the empty state); AP2 handed to the DBA.\\n\",1)\ns=s.replace(\"## Risks\\n\",\"## Risks\\n- S2 home table is unpaginated; a large stock_records table needs pagination in a later story (AP2 index keeps the filtered read cheap).\\n\",1)\nopen(p,'w').write(s)\nEOF","description":"Extend architecture.md with S2 patterns, decision, tests"}

## Final reasoning

I annotated all three S2 ACs as E2E, tied each to a new `GET /api/stock` endpoint (EP4) with IA seams, and added the list-by-location query to `architecture.json` and `architecture.md`; the self-check passed.

Decision for the PO: "holding stock" means quantity > 0, so a location with only quantity-0 records returns an empty list and shows the empty state (recorded as D5, consistent with OD1).

The home table has no pagination; I logged that as a risk for a later story.
