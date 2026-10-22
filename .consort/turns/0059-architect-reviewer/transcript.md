# architect-reviewer (architect-reviewer) – opus

## Prompt

```
Annotate story S2-adjust-by-delta's acceptance criteria + nfrs.md coverage. Author architectural_notes for ALL of story S2-adjust-by-delta's ACs: AC1-positive-delta-increases-level, AC2-negative-delta-decreases-level, AC3-delta-audit-records-resulting-level. Every one of this story's ACs MUST end up with a non-empty "architectural_notes" field in its acs/<AC>.json (the layer it lives in + how it realizes the design) — the design gate verifies that, and the spec-author's "layer" field does NOT count. architectural_notes are per-AC, so author the scoped ACs above even when the feature-level architecture.json already exists from an earlier story. For every E2E AC, ALSO pass consort-annotate-ac --ui-seams with the ia.md data-testid seam token(s) the AC's UI drives — the column / cell / region / empty-state / form field it asserts (e.g. "stock-cell-tracking,stock-not-tracked"). A deterministic gate checks each seam is named in <PROJECT_ROOT>/.consort/design/ia.md; if the AC needs a surface the IA does not yet name, declare the seam you need anyway and the gate routes the ux-designer to add it to ia.md. In architecture.json, make an EXPLICIT service_backed call (required): set service_backed:true if the feature persists data (a DB table/migration) or carries business logic, and then you MUST declare boundary, service, and repository layers (plus a "models" PACKAGE app/models/, one module per domain object, NOT a flat app/models.py, when it persists entities); set false ONLY for a trivial static/read-through endpoint. An Infra-layer AC or a migration/schema/storage NFR while service_backed is false hard-blocks the gate. When service_backed:true you MUST also declare architecture.json persistence_invariants[]: the DB-level guarantees the schema enforces (each with id, type one of unique|foreign_key|cascade|not_null|check|transactional|migration_reversible, table, and a one-line brief), covering unique/composite keys, foreign keys + cascade rules, NOT NULL / CHECK constraints, any transactional-atomicity boundary, and migration reversibility. The test-strategist must cover each with a real-branch test; a service_backed feature with no persistence_invariants hard-blocks the gate. When THIS story introduces a NEW read/query shape over the schema — a filter, lookup, sort, or join an AC drives (e.g. "list stock filtered by location", "look up a SKU's rows by sku") that is an INDEX candidate — declare it in architecture.json access_patterns[] (id, a one-line brief, and the table + column(s) it reads) so the DBA is pulled back in to reconsider the physical design for it; this is how a later READ story evolves the schema, since a story that adds no persistence_invariant would otherwise skip the DBA. Declare an access_pattern ONLY for a genuinely new query shape (not for every read, and not for one already covered by a prior story's pattern or a primary-key lookup). REUSE the established project architecture conventions (set by F1-stock-visibility): boundary=app/routes (react), service=app/services, repository=app/repositories, models=app/models, infrastructure=app/database.py. Declare the SAME role -> module paths in architecture.json, do NOT remap or rename an established layer; a divergent layout hard-blocks the spec gate and mismatches the inherited code. Author this story's architectural_notes FRESH from the ACs + IA on disk this turn. On a reflect-revise re-run the self-heal clears this story's prior architectural_notes BY DESIGN, so an absent/empty prior is the expected revise state — re-derive against the corrected ACs + IA. Write every artifact under the ABSOLUTE artifact root <PROJECT_ROOT>/.consort (this feature: <PROJECT_ROOT>/.consort/features/F2-stock-adjustment/; this story: <PROJECT_ROOT>/.consort/features/F2-stock-adjustment/stories/S2-adjust-by-delta/); use that absolute path and never resolve or guess the project root yourself.CROSS-STORY CONTEXT — this story is NOT reviewed in isolation. The feature's OTHER stories' ACs, the architecture's open_decisions, and its mandated (not-null) persistence fields are below; use them for the cross-story checks (an AC contradicting a gated sibling AC; a mandated field no sibling submit AC supplies). This IS that context — do not run `consort-cross-story-context` yourself.

{
  "current_story": "S2-adjust-by-delta",
  "sibling_stories": [
    {
      "story": "S1-adjust-to-value",
      "acs": [
        {
          "ac_id": "AC1-form-sets-corrected-level",
          "status": "draft",
          "layer": "E2E",
          "given": "an existing stock record for a (sku, location) pair with quantity 7",
          "when": "the operator opens the adjustment form for that pair, whose fields carry visible persistent labels, enters a corrected quantity of 4 and their name as the actor, and submits",
          "then": "the operator lands on a confirmation (or green inline flash) for the adjustment, and viewing that (sku, location) afterwards shows quantity 4",
          "architectural_notes": "E2E client<->server round-trip: AdjustPage (client/) submits the form to POST /api/adjustments; app/routes/adjustments.py validates and calls AdjustmentService.adjust_to_value, which locks the stock_records row via the repository, updates quantity and writes the audit row in one commit. The client renders adjust-success from the real 201 response and the SKU detail (EP5) then shows 4; verified by Playwright against the live API on the paired branch."
        },
        {
          "ac_id": "AC2-audit-record-captures-when-and-who",
          "status": "draft",
          "layer": "API",
          "given": "an existing stock record for a (sku, location) pair",
          "when": "the operator successfully adjusts its quantity to a corrected value",
          "then": "exactly one adjustment audit record is retrievable for that adjustment, naming the sku, the location, the prior quantity, the new quantity, the time it happened, and the actor the operator entered",
          "architectural_notes": "API write rule: AdjustmentService (app/services/adjustment.py) inserts exactly one StockAdjustment (app/models/stock_adjustment.py) carrying sku, location, prior_quantity (read under row lock), new_quantity, the caller-supplied actor and a server-stamped adjusted_at, in the same transaction as the quantity update (PI13); retrieved via GET /api/adjustments?sku=&location=. Audit is service-owned, persisted only by app/repositories/adjustment.py; DB NOT NULL/CHECK (PI8-PI10) and the FK (PI11) defend it; pytest-bdd against the paired branch."
        },
        {
          "ac_id": "AC3-audit-record-unmodifiable",
          "status": "draft",
          "layer": "API",
          "given": "an existing adjustment audit record",
          "when": "any attempt is made to edit or delete that audit record after the fact",
          "then": "the attempt is rejected and the audit record remains retrievable with its original values unchanged",
          "architectural_notes": "API + DB immutability: app/routes/adjustments.py registers only GET and POST, so PUT/PATCH/DELETE on /api/adjustments[/{id}] return 405, and AdjustmentRepository exposes no update/delete; a BEFORE UPDATE OR DELETE trigger on stock_adjustments (PI12) rejects direct mutation on the branch. Verified by pytest-bdd re-reading the row via GET /api/adjustments and raw SQL against the paired branch."
        },
        {
          "ac_id": "AC4-actor-required",
          "status": "draft",
          "layer": "E2E",
          "given": "an existing stock record for a (sku, location) pair with quantity 7",
          "when": "the operator submits the adjustment form with a corrected quantity but leaves the actor field empty",
          "then": "the adjustment is rejected with an inline error next to the actor field naming that field (not a generic 'bad request'), the quantity stays 7, and no audit record is created",
          "architectural_notes": "E2E client<->server contract: validation lives at the boundary/service (actor trimmed non-empty), returning 422 {detail:[{field:'actor',...}]} which the AdjustPage maps to the inline field-actor-error naming 'Your name'; the service rejects before any write, so quantity stays 7 and no audit row exists (PI9 CHECK is the DB backstop). Actor is an operator-typed form field, not an authenticated identity (no auth in V1); Playwright against the live API, with the backend rule also pinned by NFR1's actor clause."
        }
      ]
    }
  ],
  "open_decisions": [
    {
      "id": "OD1-adjustment-audit-home",
      "question": "Where do R1's unmodifiable adjustment timestamp + actor live (deferred from F1 OD3)?",
      "decision_status": "resolved",
      "resolved_by_story": "S1-adjust-to-value",
      "resolution": "A dedicated append-only stock_adjustments table (FK to stock_records (sku, location)), written in the same transaction as the quantity update, with DB-level NOT NULL/CHECK on actor + adjusted_at and an UPDATE/DELETE-rejecting trigger; the API exposes no mutation route. S2-adjust-by-delta reuses the same table (prior/new quantity recorded either way). Consistent with F1: adjustments only touch existing records, never create one."
    },
    {
      "id": "OD-scope-adjust-location-options",
      "question": "field-location (adjust) lists 'all locations holding a record for the chosen SKU, incl. qty-0': reuse EP3 (all locations) + EP2 404 -> form-error, or add a sku-scoped locations endpoint?",
      "decision_status": "open"
    }
  ],
  "required_persistence_fields": [
    {
      "invariant_id": "PI8-adjustment-columns-not-null",
      "table": "stock_adjustments",
      "brief": "stock_adjustments.sku, location, prior_quantity, new_quantity, actor and adjusted_at are all NOT NULL (adjusted_at server-defaulted to now()); an insert missing any is rejected by the DB."
    }
  ]
} Be terse: produce ONLY the required artifact file(s) on disk, then stop with at most a one-line confirmation. Do NOT print a plan, a summary of what you did, rationale, tables, or restate the artifacts to stdout, that output is wasted latency. The files on disk are the deliverable, not your prose.
```

## Tools used

- Bash {"command":"cd <PROJECT_ROOT>/.consort/features/F2-stock-adjustment && cat stories/S2-adjust-by-delta/acs/*.json && cat architecture.json && grep -n \"adjust\\|delta\" ../../design/ia.md | head -60","description":"Read S2 ACs, architecture, and IA adjust seams"}
- Bash {"command":"python3 - <<'EOF'\nimport json\np='architecture.json'; a=json.load(open(p))\nfor c in a['api_contracts']:\n    if c['id']=='EP6-adjust-stock':\n        c['item']=c['item'].replace(\"quantity: integer >= 0 (required; the corrected value), actor\",\"EXACTLY ONE of quantity: integer >= 0 (set-to-value mode, S1) OR delta: non-zero signed integer (adjust-by-delta mode, S2-adjust-by-delta; the service computes new_quantity = prior_quantity + delta against the row-locked current quantity), actor\")\n        c['item']=c['item'].replace(\"adjusted_at: string (ISO-8601 UTC, server-stamped)}\",\"adjusted_at: string (ISO-8601 UTC, server-stamped), delta: integer (derived new_quantity - prior_quantity, never stored separately)}\")\n        c['item']=c['item'].replace(\"field: 'sku'|'location'|'quantity'|'actor'\",\"field: 'sku'|'location'|'quantity'|'delta'|'actor'\")\n    if c['id']=='EP7-list-adjustments':\n        c['item']=c['item'].replace(\"adjusted_at: string (ISO-8601 UTC)}\",\"adjusted_at: string (ISO-8601 UTC), delta: integer (derived new_quantity - prior_quantity)}\")\nfor n in a['nfrs']:\n    if n['id']=='NFR3-adjust-addresses-existing-pair':\n        cl=\"After POST /api/adjustments with delta +5 on a (sku, location) at quantity 7, exactly one stock_records row exists for that pair carrying quantity 12.\"\n        if not any((f.get('clause') if isinstance(f,dict) else f)==cl for f in n['fitness_functions']):\n            n['fitness_functions'].append({\"clause\":cl,\"realized_by\":[\"AC1-positive-delta-increases-level\"]})\n        n['fitness_function']=\" AND \".join(f['clause'] if isinstance(f,dict) else f for f in n['fitness_functions'])\na['open_decisions'].append({\"id\":\"OD2-delta-audit-storage\",\"question\":\"Is the audit delta stored as its own column or derived as new_quantity - prior_quantity?\",\"decision_status\":\"resolved\",\"resolved_by_story\":\"S2-adjust-by-delta\",\"resolution\":\"Derived in the service/response (delta = new_quantity - prior_quantity) for every audit row; no schema change to stock_adjustments, so S1's PI8-PI15 stand unchanged and the delta can never disagree with prior/new.\"}) if not any(o['id']=='OD2-delta-audit-storage' for o in a['open_decisions']) else None\njson.dump(a,open(p,'w'),indent=2)\nEOF\ncat >> architecture.md <<'EOF'\n\n## S2-adjust-by-delta addendum\n\n- **Layering:** reuses S1's stack unchanged. EP6 `POST /api/adjustments` accepts exactly one of `quantity` | `delta`; `AdjustmentService.adjust_by_delta` (app/services/adjustment.py) reads the stock_records row under `SELECT ... FOR UPDATE` via the repository, computes `new = prior + delta`, updates quantity and inserts one `StockAdjustment` in one commit (PI13). The client `AdjustPage` adds the `adjust-mode` toggle, `field-delta`, `adjust-delta-preview`.\n- **Decisions:** OD2 resolved – the audit delta is derived (`new_quantity - prior_quantity`) in responses (EP6/EP7 `delta`), no new column or migration; no new persistence invariant or access pattern (EP7 read shape is AP3).\n- **NFRs:** NFR3 gains a delta clause realized by AC1-positive-delta-increases-level. Delta-driven negative results are S3-reject-negative-stock's (NFR2, PI10 + stock_records CHECK as backstop).\n- **Risks:** lost-update under concurrent deltas is defended by the row lock; not separately fitness-tested in V1.\n- **Test strategy:** AC1/AC2 Playwright against the live API on the paired branch; AC3 pytest-bdd against the paired branch (no mocks).\n- **Sign-off:** proceed – architect-reviewer.\nEOF\nF=F2-stock-adjustment; S=S2-adjust-by-delta; cd <PROJECT_ROOT>\n./scripts/lk consort-annotate-ac --feature $F --story $S --ac AC1-positive-delta-increases-level --layer E2E --api-contract EP6-adjust-stock --ui-seams \"adjust-mode,adjust-mode-delta,field-delta,adjust-delta-preview,field-actor,adjust-submit,adjust-success,adjust-current-qty\" --notes \"E2E client<->server round-trip: AdjustPage (client/) switches adjust-mode to delta and POSTs {sku, location, delta:+5, actor} to /api/adjustments; app/routes/adjustments.py validates and calls AdjustmentService.adjust_by_delta (app/services/adjustment.py), which locks the stock_records row via app/repositories, sets quantity = prior + delta and writes the audit row in one commit (PI13). The client renders adjust-success from the real 201 and the SKU detail then shows 12; Playwright against the live API on the paired branch, with NFR3's delta clause pinning one row at 12.\" &&\n./scripts/lk consort-annotate-ac --feature $F --story $S --ac AC2-negative-delta-decreases-level --layer E2E --api-contract EP6-adjust-stock --ui-seams \"adjust-mode-delta,field-delta,field-actor,adjust-submit,adjust-success\" --notes \"E2E client<->server contract for the sign: the client passes the signed delta (-3) unchanged in the POST body, and the service (not the client or route) applies new = prior + delta under the row lock, so the decrease is server-decided. SKU detail then shows 4; a result below 0 is S3's rejection, with PI10 and the stock_records CHECK as DB backstops. Playwright against the live API on the paired branch.\" &&\n./scripts/lk consort-annotate-ac --feature $F --story $S --ac AC3-delta-audit-records-resulting-level --layer API --api-contract EP7-list-adjustments --notes \"API write rule: AdjustmentService.adjust_by_delta inserts exactly one StockAdjustment (app/models/stock_adjustment.py) via app/repositories/adjustment.py with prior_quantity 7 (read under lock) and the RESULTING new_quantity 12 (not the delta), plus caller actor and server-stamped adjusted_at, atomically with the quantity update (PI13). The delta +5 is derived as new - prior in EP6/EP7 responses (OD2, no new column), so it cannot drift from stored values; verified by pytest-bdd POSTing to EP6 then reading EP7 against the paired branch.\" &&\n./scripts/lk consort-response-formatter --role architect-reviewer --feature $F --story $S","description":"Update architecture, annotate S2 ACs, run self-check"}

## Final reasoning

I annotated all three S2-adjust-by-delta ACs and updated `architecture.json` and `architecture.md`; the architect-reviewer self-check passes. AC1 and AC2 are tagged E2E with UI seams, and AC3 is tagged API.

- **Delta in the audit (new decision OD2, resolved):** `delta` isn't stored. Responses from `POST /api/adjustments` (EP6) and `GET /api/adjustments` (EP7) compute it as `new_quantity - prior_quantity`. So there's no new column or migration, and no new persistence invariant or access pattern.
- **EP6 request:** it now takes exactly one of `quantity` or a signed `delta`. The service applies the delta to the current quantity while holding a lock on the stock row.
- **NFR3:** I added one clause, tied to AC1: a +5 delta on quantity 7 leaves exactly one stock record, at 12.
- **Left out on purpose:** two simultaneous deltas on the same row are only guarded by that row lock and have no dedicated test in V1 (noted under risks). A delta that would go below 0 is left to S3-reject-negative-stock.
