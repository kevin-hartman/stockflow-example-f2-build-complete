# StockFlow – F2 design-complete snapshot

## What this is

A **ready-to-build snapshot** of StockFlow, a warehouse-management app for a mid-market
operation that has outgrown spreadsheets. **V1** lets the team see and adjust stock at one
warehouse. Its first feature – view stock by SKU and location – is already **built**; this
snapshot carries the next feature, **F2 – "Adjust the stock level of a SKU at a location"** –
with its entire design lane authored and frozen, so you can stand it up and jump straight to
building F2.

It's built with **[Consort](https://github.com/databricks-solutions/consort)**, a spec-first,
test-driven agent framework for apps on **Lakebase** (Databricks serverless Postgres). Consort
normally walks a feature through two lanes: a *design* lane (plan → spec → UX → architecture →
tests) and a *build* lane (TDD: RED → GREEN → REFACTOR).

**The purpose of this repo is to skip the design lane and go straight to build – for F2.** F1
is already built and merged to `staging`; F2's design lane is authored and frozen at its gates –
so you can stand this up as your own project and start F2's TDD build loop immediately, without
redoing any of the up-front design work.

## Where we are

F1 is built; F2's design is complete; no F2 build code has been written yet.

- **Feature F1 – "Record and view stock by SKU and location":** **built** and merged to `staging`
  (the React SPA + JSON API that files, retrieves, and lists a SKU's stock by location).
- **Feature F2 – "Adjust the stock level of a SKU at a location":** design complete – feature-spec,
  UX design-guide, architecture, db-design, and the ordered test-list are all authored and gated
  (in `.consort/`). F2 is the write path that corrects the count when the shelf disagrees with the
  system, so the inventory stays trustworthy.
  - `S1-adjust-to-value` – ready to build (set a SKU/location's count to an absolute value)
  - `S2-adjust-by-delta` – ready to build (adjust a count up or down by a delta)
  - `S3-reject-negative-stock` – ready to build (reject an adjustment that would drive stock negative)

## How to use it – jump straight to build

**Prerequisite:** Consort is installed, your environment is prepped, and access to a Lakebase
profile is ready to go. If you haven't set that up yet, run:

```bash
bash <(curl -sL https://tinyurl.com/consort-bootstrap)
```

If you need Lakebase, you can try it on [Free Edition](https://login.databricks.com/signup?intent=SIGN_UP&provider=DB_FREE_TIER).

### 1. Clone it down

```bash
git clone https://github.com/kevin-hartman/stockflow-example-f2-design-complete.git
cd stockflow-example-f2-design-complete
git checkout feature-f2-stock-adjustment
(cd client && npm install)
```

`feature-f2-stock-adjustment` is the branch carrying the F2 design state (F1 is already built on
its trunk); the last line installs the UI client dependencies.

### 2. Stand it up as *your* project

Run the setup script, replacing `my-stockflow` with your own project name:

```bash
./setup.sh my-stockflow
```

If you encounter problems, read the [runbook](RUNBOOK-rehydrate-as-new-project.md) and share it with a Claude session to resolve.

### 3. Build the feature

In your Claude session, start the workflow:

```
/consort:start
```

`/consort:start` picks up at the build lane and prompts you to build F2. It runs the
Driver/Navigator TDD loop (RED → GREEN → REFACTOR) against F2's Lakebase branch.
