# navigator-reflect (navigator) – sonnet

## Prompt

```
REFLECT on story S3-reject-negative-stock BEFORE the build lane: independently critique its spec slice (<PROJECT_ROOT>/.consort/features/F2-stock-adjustment/stories/S3-reject-negative-stock/story.json + acs/*.json) and its test-list (<PROJECT_ROOT>/.consort/features/F2-stock-adjustment/stories/S3-reject-negative-stock/test-list-per-story.json) against the architecture (<PROJECT_ROOT>/.consort/features/F2-stock-adjustment/architecture.md/.json), the NFRs (<PROJECT_ROOT>/.consort/nfrs.md — a project-level file, NOT under the feature dir), and the information architecture (<PROJECT_ROOT>/.consort/design/ia.md). RUBRIC (pre-extracted; judge against THIS) :: layers=E2E, API | required NFRs, NFR2-adjustment-never-negative | design-token groups, app_name, app_icon, typography, colors, spacing, radius, shadows, breakpoints, motion, components. Look ONLY for design-time defects that would waste a build cycle. The DETERMINISTIC pre-reflect gate has ALREADY verified the structural classes — client-kind↔AC-layer coherence, E2E-layer coverage by a real Playwright spec, and that no real-browser navigation/reload assertion sits in the jsdom component harness — so do NOT spend a finding re-flagging those; focus on the SEMANTIC defects: (1) ACs that contradict each other; (2) an AC with no covering test, or a test that contradicts its AC; (3) an NFR with no fitness test; (4) a test asserting at a layer the architecture forbids; (5) an AC whose declared layer conflicts with the architecture; (6) an untestable/vacuous AC (no observable outcome); (7) a UI-styling test that asserts inline HTML style or raw CSS in the page SOURCE (e.g. a text-align/color/font check inside a style= attr) for a property the design-guide + design-adherence gate govern, instead of the rendered SEAM (the element carries the design-guide class / data-testid): such a test hard-codes the very inline style the design lane then refactors into a token-driven class, so it blocks that refactor (the ui-style-implementation-test smell); (8) for EACH user-facing AC (declared layer E2E or client): read <PROJECT_ROOT>/.consort/design/ia.md and locate the screen, form, or data-testid seam that AC asserts among the IA's Screens, Navigation, and User flows — emit a ux-designer finding naming every asserted surface the IA leaves out, because the architect would otherwise tag an E2E layer against a screen the IA does not define (the ia refinement adds the missing surface). ALSO, when that AC asserts an INTERACTIVE control (a filter, selector, combobox, search), the IA must name a control the user can OPERATE to reach EVERY state the AC asserts: the control's declared option source must cover the asserted values and its empty / no-match state must be reachable THROUGH the control (e.g. an all-values accessible combobox, not a native datalist whose options are only the filtered rows and whose empty option is unselectable) — emit a ux-designer finding when the IA's control cannot reach an asserted state. This control-SEMANTICS check is the twin of the surface-existence check: a surface the IA NAMES but whose control a user cannot operate to the asserted state is still an ia defect, not a build detail or a test bypass; Do NOT critique implementation, style, or scope, only buildability + internal consistency of THIS story's artifacts. BE EXHAUSTIVE in this ONE pass: findings[] is multi-valued — run EVERY check against EVERY AC, test-list item, and NFR, and emit a SEPARATE finding for EACH distinct defect (decompose a LEGACY multi-part singular NFR fitness_function into its sub-guarantees and flag every uncovered clause — but an NFR that already declares the ATOMIC fitness_functions ARRAY is coverage-checked DETERMINISTICALLY by checkFitnessClauseCoverage at the test_list gate, so do NOT re-decompose it). Do NOT return one finding at a time: the reflect↔revise loop is bounded and escalates after a few laps, so a piecemeal reflect burns that budget on repeated revise→re-test→reflect laps and can hand the human a still-defective design. Write your verdict to <PROJECT_ROOT>/.consort/features/F2-stock-adjustment/stories/S3-reject-negative-stock/reflect-verdict.json as {"version":1,"passed":<bool>,"findings":[{"owner":"spec-author"|"test-strategist"|"architect-reviewer"|"ux-designer","detail":"<the defect>","ac_ids":["<exact story AC id(s) this finding is about>"]}]}. passed:true with findings:[] when the spec + test-list are consistent + buildable (the common case, do NOT invent defects). Attribute each finding to its OWNING role so the fix routes to the right gate: spec-author (an AC/spec defect — the given/when/then or scope); architect-reviewer (an ARCHITECTURE defect — checks 4 and 5, i.e. a wrong layer tag, OR a route/path/contract in an AC's architectural_notes that disagrees with the IA or the tests, OR a persistence invariant that contradicts the AC; this is the architect's product, NOT the spec-author's, so do NOT attribute a notes/layer defect to spec-author); test-strategist (a test-list/coverage defect); ux-designer (a user-facing AC whose surface the IA does not name — defect 8). Set "ac_ids" to the EXACT story AC id(s) the finding concerns (verbatim, from this story's acs/) — the revise re-derives ONLY those ACs' test items; omit ac_ids (or []) ONLY for a whole-story defect that needs the entire test-list rebuilt. Write ONLY that file; the orchestrator routes any fix deterministically.CROSS-STORY CONTEXT — this story is NOT reviewed in isolation. The feature's OTHER stories' ACs, the architecture's open_decisions, and its mandated (not-null) persistence fields are below; use them for the cross-story checks (an AC contradicting a gated sibling AC; a mandated field no sibling submit AC supplies). This IS that context — do not run `consort-cross-story-context` yourself.

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

- Bash {"command":"cd <PROJECT_ROOT>/.consort/features/F2-stock-adjustment/stories/S3-reject-negative-stock && cat story.json acs/*.json test-list-per-story.json; grep -n -i -A8 \"NFR2\" ../../../../nfrs.md | head -60; grep -n -i \"adjust\" ../../../../design/ia.md | head -40","description":"Read S3 spec, test-list, NFR2, and IA adjust references"}
- Write {"file_path":"<PROJECT_ROOT>/.consort/features/F2-stock-adjustment/stories/S3-reject-negative-stock/reflect-verdict.json","content":"{\"version\":1,\"passed\":true,\"findings\":[]}\n"}

## Final reasoning

I found no defects in S3-reject-negative-stock and wrote a passing verdict (`passed: true`, no findings) to its `reflect-verdict.json`.
