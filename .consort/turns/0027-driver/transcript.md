# driver (driver) – opus

## Prompt

```
Make ALL of story S1-file-stock's failing tests GREEN in one pass (simplest honest code); implement until every one of the story's tests passes, then run the story's tests once. UI track is ON: the UI must adhere to the project design guide at <PROJECT_ROOT>/.consort/design/design-guide.md (+ the design-guide.json tokens). Build to it. RUBRIC (pre-extracted; judge against THIS) :: layers=E2E, API | required NFRs, NFR1-stock-data-survives-migrations; NFR2-no-negative-stock; NFR3-sku-location-unique-addressable | design-token groups, app_name, app_icon, typography, colors, spacing, radius, shadows, breakpoints, motion, components. The rubric above is pre-extracted from <PROJECT_ROOT>/.consort/features/F1-stock-visibility/architecture.md, <PROJECT_ROOT>/.consort/nfrs.md, and <PROJECT_ROOT>/.consort/design/design-guide.md, open those full files ONLY if you need more detail than it carries (do not re-read them by default). LAYOUT (place/judge code at THESE paths, do not scan for them) :: boundary=app/routes (react) | service=app/services | repository=app/repositories | models=app/models | infrastructure=app/database.py. RUN/REACHABILITY :: python project – source under app/. To confirm the app boots or is reachable, run `uv run uvicorn app.main:app` and GET the health path over HTTP. Reachability is an HTTP response, never just an import succeeding. TESTS :: this story's behavior tests are under tests/step_defs/ (one file per story). Iterate against the single failing test while fixing; the honest-GREEN full run is the authoritative verify. Be terse: produce ONLY the required artifact file(s) on disk, then stop with at most a one-line confirmation. Do NOT print a plan, a summary of what you did, rationale, tables, or restate the artifacts to stdout, that output is wasted latency. The files on disk are the deliverable, not your prose.
```

## Tools used

- Bash {"command":"git status --short | head -30 && ls && ls app app/* tests tests/* client client/src 2>/dev/null | head -100 && ls .consort/cycles/F1-stock-visibility/ 2>/dev/null","description":"Survey project layout and status"}
- Bash {"command":"cat .consort/features/F1-stock-visibility/stories/S1-file-stock/test-list-per-story.json; ls -R .consort/cycles/F1-stock-visibility/; git diff .consort/features/F1-stock-visibility/stories/S1-file-stock/acs/ | head -80","description":"Read story test list and cycle artifacts"}
- Bash {"command":"cat tests/test_stock_refile.py app/routes/stock.py app/services/stock.py app/repositories/stock.py app/routes/errors.py app/models/stock_record.py","description":"Read refile tests and stock layers"}
- Bash {"command":"uv run pytest tests/test_stock_refile.py -q 2>&1 | tail -30","description":"Run S1 refile tests","timeout":300000}
- Bash {"command":"uv run pytest tests/ -q 2>&1 | tail -3; ./scripts/lk consort-response-formatter --role driver --feature F1-stock-visibility --story S1-file-stock 2>&1 | tail -10","description":"Run story backend tests and layering/ux self-check","timeout":400000}
- Bash {"command":"./scripts/lk consort-log --role driver --feature F1-stock-visibility --cycle cycle-001 --level info --event reasoning --message \"AC3 refile tests (T23-T35) already green: StockRepository.upsert uses INSERT ... ON CONFLICT (uq_stock_records_sku_location) DO UPDATE from AC1; no production change needed. Layering/ux self-check conforms.\" 2>&1 | tail -2","description":"Log driver reasoning for the cycle"}

## Final reasoning

All 13 AC3 re-file tests (T23–T35) in `tests/test_stock_refile.py` were already passing, so I made no code changes. AC1's code already saves a filing for an existing SKU and location by updating the record in place. The full backend suite passes (24 tests), and the layering and UI self-check came back clean.
