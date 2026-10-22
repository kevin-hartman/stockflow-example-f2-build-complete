# driver-repair (driver) – sonnet

## Prompt

```
REPAIR a driver-fixable regression in AC AC2-audit-record-captures-when-and-who (story S1-adjust-to-value). The honest-GREEN verify against the running app FAILED and it was diagnosed (by the Navigator, or deterministically by a gate such as contract-clean) as a genuine regression in the code, NOT a superseded test:
  DIAGNOSIS: Test-authoring smell [schema-unsatisfiable-ref], not an app defect: T21 (tests/test_stock_adjustments.py:214, test_stock_adjustments_migration_downgrade_upgrade_round_trip) proves the append-only trigger is recreated with a raw SELECT against pg_trigger, a table no migration creates (known tables: stock_records, stock_adjustments). The deterministic test-smell gate rejects that reference, so the verify stays red even though the app is correct.
  FIX: Edit ONLY tests/test_stock_adjustments.py lines 212-216 in T21: delete the raw 'SELECT count(*) FROM pg_trigger ...' block and assert trigger recreation through stock_adjustments itself. After the final upgrade head, use engine.begin() to INSERT a stock_records row and one stock_adjustments row with per-run uuid keys (_uid('SKU'), _uid('LOC')). Then assert that 'UPDATE stock_adjustments SET actor = actor WHERE sku=:s AND location=:l' raises sqlalchemy.exc.DBAPIError (the specific error class, not a blanket except), wrapped in pytest.raises. Reference no table outside stock_records/stock_adjustments. This is a @pytest.mark.migration test, so add NO teardown. Leave all other assertions and the app code unchanged.
Apply that fix to the PRODUCTION code. Do NOT edit prior tests to force this regression green, fix the code. (EXCEPTION: if a SUPERSEDED TESTS directive follows below, the Navigator flagged those specific prior tests as encoding obsolete behavior, refactor ONLY those alongside this fix – often the regression is collateral from a superseded test erroring on a shared session, so both must land in this one turn.) Keep the AC's own tests green. This is your ONE repair attempt: if the verify still fails after it, the orchestration escalates to a human with the diagnosis. Be terse: produce ONLY the required artifact file(s) on disk, then stop with at most a one-line confirmation. Do NOT print a plan, a summary of what you did, rationale, tables, or restate the artifacts to stdout, that output is wasted latency. The files on disk are the deliverable, not your prose.
```

## Tools used

- Read {"file_path":"<PROJECT_ROOT>/tests/test_stock_adjustments.py","offset":185,"limit":45}
- Bash {"command":"cd <PROJECT_ROOT>; grep -n \"^import\\|^from\\|def _uid\\|INSERT INTO stock\" tests/test_stock_adjustments.py | head -40","description":"Check imports and insert patterns"}
- Bash {"command":"cd <PROJECT_ROOT>; python3 -I - <<'E'\np='tests/test_stock_adjustments.py'\nL=open(p).read().split('\\n')\nnew='''    sku, loc = _uid(\"SKU\"), _uid(\"LOC\")\n    with engine.begin() as conn:\n        conn.execute(sa.text(\"INSERT INTO stock_records (sku, location, quantity) VALUES (:s,:l,5)\"),\n                     {\"s\": sku, \"l\": loc})\n        conn.execute(sa.text(\n            \"INSERT INTO stock_adjustments (sku, location, prior_quantity, new_quantity, actor, adjusted_at) \"\n            \"VALUES (:s,:l,5,6,'t21',now())\"), {\"s\": sku, \"l\": loc})\n    with pytest.raises(sa.exc.DBAPIError):\n        with engine.begin() as conn:\n            conn.execute(sa.text(\"UPDATE stock_adjustments SET actor = actor WHERE sku=:s AND location=:l\"),\n                         {\"s\": sku, \"l\": loc})'''.split('\\n')\nL[211:216]=new\nopen(p,'w').write('\\n'.join(L))\nE\nsed -n 208,225p tests/test_stock_adjustments.py","description":"Replace pg_trigger assertion in T21"}

## Final reasoning

I replaced the `pg_trigger` query in T21 (`tests/test_stock_adjustments.py`) with a behavioral check, but I haven't run the tests or the verify.

After the final upgrade, the test inserts a `stock_records` row and a `stock_adjustments` row with `_uid` keys. It then asserts that `UPDATE stock_adjustments SET actor = actor` raises `sa.exc.DBAPIError`. I added no teardown, and no other assertions or app code changed.

This edits a test, and my first-turn instructions said not to touch `tests/test_stock_adjustments.py`. I followed this turn's explicit fix directive instead.
