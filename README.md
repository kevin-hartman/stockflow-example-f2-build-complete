# StockFlow – F2 build-complete snapshot

## What this is

A **fully-built snapshot** of StockFlow, a warehouse-management app for a mid-market operation
that has outgrown spreadsheets. **V1** lets the team see and adjust stock at one warehouse. Its
first two features are both **built**: view stock by SKU and location (F1), and **F2 – "Adjust
the stock level of a SKU at a location"**. F2's design lane *and* its test-driven build lane are
complete, so you can stand this up and run it, replay the build in the dashboard, or carry on to
the next feature.

It's built with **[Consort](https://github.com/databricks-solutions/consort)**, a spec-first,
test-driven agent framework for apps on **Lakebase** (Databricks serverless Postgres). Consort
walks a feature through two lanes: a *design* lane (plan → spec → UX → architecture → tests) and
a *build* lane (TDD: RED → GREEN → REFACTOR). This snapshot carries F2 all the way through both.

**The purpose of this repo is to hand off F2 fully built** – every story designed, every test
authored and GREEN against a real Lakebase branch – so you can stand it up as your own project and
run it, inspect the TDD build in the dashboard, or start the next feature, without redoing any of
F2's design or build work.

## Where we are

F1 and F2 are both built.

- **Feature F1 – "Record and view stock by SKU and location":** built and merged to `staging`
  (the React SPA + JSON API that files, retrieves, and lists a SKU's stock by location).
- **Feature F2 – "Adjust the stock level of a SKU at a location":** **build complete** on
  `feature-f2-stock-adjustment`. Its feature-spec, UX design-guide, architecture, db-design, and
  ordered test-list are authored and gated (in `.consort/`), and all three stories are built with
  their tests GREEN against F2's Lakebase branch. F2 is the write path that corrects the count when
  the shelf disagrees with the system, so the inventory stays trustworthy.
  - `S1-adjust-to-value` – built (set a SKU/location's count to an absolute value)
  - `S2-adjust-by-delta` – built (adjust a count up or down by a delta)
  - `S3-reject-negative-stock` – built (reject an adjustment that would drive stock negative)

The full design corpus, the per-story TDD cycles, and the dashboard replay records (the event log,
per-turn transcripts, and per-test table snapshots) are committed on `feature-f2-stock-adjustment`,
so the whole F2 build replays end-to-end in the Consort dashboard.

## How to use it

**Prerequisite:** Consort is installed, your environment is prepped, and access to a Lakebase
profile is ready to go. If you haven't set that up yet, run:

```bash
bash <(curl -sL https://tinyurl.com/consort-bootstrap)
```

If you need Lakebase, you can try it on [Free Edition](https://login.databricks.com/signup?intent=SIGN_UP&provider=DB_FREE_TIER).

### 1. Clone it down

```bash
git clone https://github.com/kevin-hartman/stockflow-example-f2-build-complete.git
cd stockflow-example-f2-build-complete
git checkout feature-f2-stock-adjustment
(cd client && npm install)
```

`feature-f2-stock-adjustment` is the branch carrying F2 fully built (F1 is built on its trunk);
the last line installs the UI client dependencies.

### 2. Stand it up as *your* project

Run the setup script, replacing `my-stockflow` with your own project name:

```bash
./setup.sh my-stockflow
```

If you encounter problems, read the [runbook](RUNBOOK-rehydrate-as-new-project.md) and share it with a Claude session to resolve.

### 3. Run it, replay it, or extend it

In your Claude session, start the workflow:

```
/consort:start
```

With F2 already built, `/consort:start` picks up past F2's build – so you can run the app against
your Lakebase branch, open the dashboard to replay F2's design + TDD build (RED → GREEN per story,
with the per-test table snapshots), or kick off the next feature's design lane.
