# architect-reviewer (architect-reviewer) – opus

## Prompt

```
Annotate story S3-reject-negative-stock's acceptance criteria + nfrs.md coverage. Author architectural_notes for ALL of story S3-reject-negative-stock's ACs: AC1-negative-delta-rejected-inline, AC2-negative-corrected-value-rejected-inline, AC3-adjust-to-exactly-zero-accepted, AC4-negative-rejected-at-write-without-form. Every one of this story's ACs MUST end up with a non-empty "architectural_notes" field in its acs/<AC>.json (the layer it lives in + how it realizes the design) — the design gate verifies that, and the spec-author's "layer" field does NOT count. architectural_notes are per-AC, so author the scoped ACs above even when the feature-level architecture.json already exists from an earlier story. For every E2E AC, ALSO pass consort-annotate-ac --ui-seams with the ia.md data-testid seam token(s) the AC's UI drives — the column / cell / region / empty-state / form field it asserts (e.g. "stock-cell-tracking,stock-not-tracked"). A deterministic gate checks each seam is named in <PROJECT_ROOT>/.consort/design/ia.md; if the AC needs a surface the IA does not yet name, declare the seam you need anyway and the gate routes the ux-designer to add it to ia.md. In architecture.json, make an EXPLICIT service_backed call (required): set service_backed:true if the feature persists data (a DB table/migration) or carries business logic, and then you MUST declare boundary, service, and repository layers (plus a "models" PACKAGE app/models/, one module per domain object, NOT a flat app/models.py, when it persists entities); set false ONLY for a trivial static/read-through endpoint. An Infra-layer AC or a migration/schema/storage NFR while service_backed is false hard-blocks the gate. When service_backed:true you MUST also declare architecture.json persistence_invariants[]: the DB-level guarantees the schema enforces (each with id, type one of unique|foreign_key|cascade|not_null|check|transactional|migration_reversible, table, and a one-line brief), covering unique/composite keys, foreign keys + cascade rules, NOT NULL / CHECK constraints, any transactional-atomicity boundary, and migration reversibility. The test-strategist must cover each with a real-branch test; a service_backed feature with no persistence_invariants hard-blocks the gate. When THIS story introduces a NEW read/query shape over the schema — a filter, lookup, sort, or join an AC drives (e.g. "list stock filtered by location", "look up a SKU's rows by sku") that is an INDEX candidate — declare it in architecture.json access_patterns[] (id, a one-line brief, and the table + column(s) it reads) so the DBA is pulled back in to reconsider the physical design for it; this is how a later READ story evolves the schema, since a story that adds no persistence_invariant would otherwise skip the DBA. Declare an access_pattern ONLY for a genuinely new query shape (not for every read, and not for one already covered by a prior story's pattern or a primary-key lookup). REUSE the established project architecture conventions (set by F1-stock-visibility): boundary=app/routes (react), service=app/services, repository=app/repositories, models=app/models, infrastructure=app/database.py. Declare the SAME role -> module paths in architecture.json, do NOT remap or rename an established layer; a divergent layout hard-blocks the spec gate and mismatches the inherited code. Author this story's architectural_notes FRESH from the ACs + IA on disk this turn. On a reflect-revise re-run the self-heal clears this story's prior architectural_notes BY DESIGN, so an absent/empty prior is the expected revise state — re-derive against the corrected ACs + IA. Write every artifact under the ABSOLUTE artifact root <PROJECT_ROOT>/.consort (this feature: <PROJECT_ROOT>/.consort/features/F2-stock-adjustment/; this story: <PROJECT_ROOT>/.consort/features/F2-stock-adjustment/stories/S3-reject-negative-stock/); use that absolute path and never resolve or guess the project root yourself.CROSS-STORY CONTEXT — this story is NOT reviewed in isolation. The feature's OTHER stories' ACs, the architecture's open_decisions, and its mandated (not-null) persistence fields are below; use them for the cross-story checks (an AC contradicting a gated sibling AC; a mandated field no sibling submit AC supplies). This IS that context — do not run `consort-cross-story-context` yourself.

{
  "current_story": "S3-reject-negative-stock",
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
    },
    {
      "story": "S2-adjust-by-delta",
      "acs": [
        {
          "ac_id": "AC1-positive-delta-increases-level",
          "status": "draft",
          "layer": "E2E",
          "given": "an existing stock record for a (sku, location) pair with quantity 7",
          "when": "the operator opens the adjustment form for that pair, chooses to adjust by a delta, enters +5 and their name as the actor, and submits",
          "then": "the operator lands on a confirmation (or green inline flash) for the adjustment, and viewing that (sku, location) afterwards shows quantity 12",
          "architectural_notes": "E2E client<->server round-trip: AdjustPage (client/) switches adjust-mode to delta and POSTs {sku, location, delta:+5, actor} to /api/adjustments; app/routes/adjustments.py validates and calls AdjustmentService.adjust_by_delta (app/services/adjustment.py), which locks the stock_records row via app/repositories, sets quantity = prior + delta and writes the audit row in one commit (PI13). The client renders adjust-success from the real 201 and the SKU detail then shows 12; Playwright against the live API on the paired branch, with NFR3's delta clause pinning one row at 12."
        },
        {
          "ac_id": "AC2-negative-delta-decreases-level",
          "status": "draft",
          "layer": "E2E",
          "given": "an existing stock record for a (sku, location) pair with quantity 7",
          "when": "the operator submits the adjustment form with a delta of -3 and their name as the actor",
          "then": "viewing that (sku, location) afterwards shows quantity 4",
          "architectural_notes": "E2E client<->server contract for the sign: the client passes the signed delta (-3) unchanged in the POST body, and the service (not the client or route) applies new = prior + delta under the row lock, so the decrease is server-decided. SKU detail then shows 4; a result below 0 is S3's rejection, with PI10 and the stock_records CHECK as DB backstops. Playwright against the live API on the paired branch."
        },
        {
          "ac_id": "AC3-delta-audit-records-resulting-level",
          "status": "draft",
          "layer": "API",
          "given": "an existing stock record for a (sku, location) pair with quantity 7",
          "when": "the operator successfully adjusts it by a delta of +5",
          "then": "exactly one adjustment audit record is retrievable for that adjustment, showing prior quantity 7, the delta +5, new quantity 12, the time it happened, and the actor the operator entered",
          "architectural_notes": "API write rule: AdjustmentService.adjust_by_delta inserts exactly one StockAdjustment (app/models/stock_adjustment.py) via app/repositories/adjustment.py with prior_quantity 7 (read under lock) and the RESULTING new_quantity 12 (not the delta), plus caller actor and server-stamped adjusted_at, atomically with the quantity update (PI13). The delta +5 is derived as new - prior in EP6/EP7 responses (OD2, no new column), so it cannot drift from stored values; verified by pytest-bdd POSTing to EP6 then reading EP7 against the paired branch."
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
    },
    {
      "id": "OD2-delta-audit-storage",
      "question": "Is the audit delta stored as its own column or derived as new_quantity - prior_quantity?",
      "decision_status": "resolved",
      "resolved_by_story": "S2-adjust-by-delta",
      "resolution": "Derived in the service/response (delta = new_quantity - prior_quantity) for every audit row; no schema change to stock_adjustments, so S1's PI8-PI15 stand unchanged and the delta can never disagree with prior/new."
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

- Bash {"command":"cd <PROJECT_ROOT>/.consort && cat features/F2-stock-adjustment/stories/S3-reject-negative-stock/acs/*.json; grep -n \"S3\\|field-quantity-error\\|field-delta-error\" design/ia.md | head -30","description":"Read S3 ACs and IA negative-stock seams"}
- Bash {"command":"cd <PROJECT_ROOT>/.consort/features/F2-stock-adjustment && python3 - <<'EOF'\nimport json\np='architecture.json'; a=json.load(open(p))\nfor c in a['api_contracts']:\n    if c['id']=='EP6-adjust-stock' and 'would go below zero' not in c['item']:\n        c['item']=c['item'].replace(\"naming the offending field; nothing changes, no audit row.\",\"naming the offending field; nothing changes, no audit row. Negative-stock guard (S3-reject-negative-stock): a negative quantity is 422 field 'quantity'; a delta whose prior + delta < 0 (evaluated by the service against the row-locked current quantity) is 422 field 'delta', message 'quantity would go below zero'; a resulting quantity of exactly 0 is accepted (201).\")\nfor n in a['nfrs']:\n    if n['id']=='NFR2-adjustment-never-negative':\n        n['requirement']=n['requirement'].replace(\"The negative-request rejection UX is S3-reject-negative-stock's.\",\"S3-reject-negative-stock enforces the rejection at the service write path (independent of client checks) with a field-named 422.\")\n        new=[{\"clause\":\"POST /api/adjustments with delta -10 on quantity 7 (bypassing the form) returns 422 naming field 'delta', leaves stock_records.quantity at 7 and writes no stock_adjustments row.\",\"realized_by\":[\"AC4-negative-rejected-at-write-without-form\"]},\n             {\"clause\":\"POST /api/adjustments with quantity -2 returns 422 naming field 'quantity', leaves stock_records.quantity at 7 and writes no stock_adjustments row.\",\"realized_by\":[\"AC4-negative-rejected-at-write-without-form\"]},\n             {\"clause\":\"POST /api/adjustments with delta -7 on quantity 7 returns 201, stock_records.quantity becomes 0 and exactly one stock_adjustments row (prior 7, new 0) is written.\",\"realized_by\":[\"AC3-adjust-to-exactly-zero-accepted\"]}]\n        have={f['clause'] if isinstance(f,dict) else f for f in n['fitness_functions']}\n        n['fitness_functions']+= [x for x in new if x['clause'] not in have]\n        n['fitness_function']=\" AND \".join(f['clause'] if isinstance(f,dict) else f for f in n['fitness_functions'])\njson.dump(a,open(p,'w'),indent=2)\nEOF\ncat >> architecture.md <<'EOF'\n\n## S3-reject-negative-stock addendum\n\n- **Layering:** the never-negative rule is owned by `AdjustmentService` (app/services/adjustment.py): after locking the stock_records row via app/repositories, it rejects `quantity < 0` (field `quantity`) and `prior + delta < 0` (field `delta`, \"quantity would go below zero\") BEFORE any write, returning the EP6 422 field-named envelope; result `0` is accepted. Client-side checks in AdjustPage are UX only; the boundary maps 422 `field` to `field-delta-error` / `field-quantity-error`, never `form-error`.\n- **DB backstop:** stock_records CHECK (quantity >= 0) (F1) and PI10 reject any negative that slips past the service; PI13 keeps the update + audit atomic. No new persistence invariant, access pattern or migration.\n- **NFRs:** NFR2 gains three clauses (delta reject + value reject realized by AC4; zero-boundary accept realized by AC3).\n- **Risks:** the service guard must read prior under `FOR UPDATE` so concurrent deltas cannot jointly go below zero; the DB CHECK is the final guard.\n- **Test strategy:** AC1–AC3 Playwright against the live API on the paired branch; AC4 pytest-bdd direct POSTs against the paired branch (no mocks).\n- **Sign-off:** proceed – architect-reviewer.\nEOF\nF=F2-stock-adjustment; S=S3-reject-negative-stock; cd <PROJECT_ROOT>\n./scripts/lk consort-annotate-ac --feature $F --story $S --ac AC1-negative-delta-rejected-inline --layer E2E --api-contract EP6-adjust-stock --ui-seams \"adjust-mode-delta,field-delta,field-delta-error,adjust-current-qty,adjust-audit,adjust-success\" --notes \"E2E client<->server contract: AdjustPage POSTs delta -10 to /api/adjustments; AdjustmentService (app/services/adjustment.py) reads the row-locked prior 7, finds prior + delta < 0 and rejects before any write with the 422 field 'delta' envelope, which the client maps to the inline field-delta-error ('quantity would go below zero'), never a generic form-error. Quantity stays 7 and no audit row exists (PI13); Playwright against the live API on the paired branch, so a client-only check cannot pass it alone.\" &&\n./scripts/lk consort-annotate-ac --feature $F --story $S --ac AC2-negative-corrected-value-rejected-inline --layer E2E --api-contract EP6-adjust-stock --ui-seams \"adjust-mode-value,field-quantity,field-quantity-error,adjust-current-qty,adjust-audit\" --notes \"E2E client<->server contract on the set-to-value path: a quantity of -2 is rejected by the boundary/service validation (quantity >= 0) with the 422 field 'quantity' envelope, rendered by AdjustPage as the inline field-quantity-error naming 'Corrected quantity'. No write occurs, so quantity stays 7 and no audit row (stock_records CHECK and PI10 are DB backstops); Playwright against the live API on the paired branch.\" &&\n./scripts/lk consort-annotate-ac --feature $F --story $S --ac AC3-adjust-to-exactly-zero-accepted --layer E2E --api-contract EP6-adjust-stock --ui-seams \"adjust-mode-delta,field-delta,adjust-success,adjust-current-qty,adjust-audit,adjust-audit-row-<id>\" --notes \"E2E zero-boundary round-trip: AdjustmentService's guard is strictly result < 0, so delta -7 on 7 is accepted, sets quantity 0 and inserts one audit row (prior 7, new 0) in one commit (PI13); the client renders adjust-success from the real 201 and adjust-current-qty shows 0. Backend accept pinned by NFR2's zero clause; Playwright against the live API on the paired branch.\" &&\n./scripts/lk consort-annotate-ac --feature $F --story $S --ac AC4-negative-rejected-at-write-without-form --layer API --api-contract EP6-adjust-stock --notes \"API write rule: the never-negative guard lives in AdjustmentService (app/services/adjustment.py), not the client, so a direct POST /api/adjustments with delta or quantity that would land at -3 returns 422 naming the offending field ('delta' or 'quantity') before any repository write. Quantity stays 7 and no stock_adjustments row is written; stock_records CHECK (quantity >= 0) and PI10 are the DB backstops. pytest-bdd direct HTTP calls against the paired branch, covering NFR2's write-path clauses.\" &&\n./scripts/lk consort-response-formatter --role architect-reviewer --feature $F --story $S","description":"Update architecture, annotate S3 ACs, run self-check"}

## Final reasoning

I annotated all four S3-reject-negative-stock ACs (AC1–AC3 as E2E, AC4 as API), added three never-negative clauses to NFR2 and the 422 rules to the adjustment endpoint contract in `architecture.json`, and appended an S3 section to `architecture.md`; the self-check passes and no new invariant, access pattern or migration was needed.
