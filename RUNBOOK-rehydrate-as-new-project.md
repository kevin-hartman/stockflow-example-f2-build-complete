# Runbook – Rehydrate a git-pulled Consort project as a *new* Lakebase + git project

Use this when you've cloned an existing Consort-scaffolded project (code + `.consort/`
+ `.lakebase/` + `./scripts/lk`) and you want to stand it up as a **fresh** project:
a new Lakebase project on a workspace *you* choose, the directory renamed to match,
and the git repo detached from where it was pulled and re-attached to a new repo of
your chosen name. This is "like a newly scaffolded project, minus the scaffolding" –
you keep all the pulled files, you just give them a new Lakebase + git identity.

It is derived from doing this by hand once; the non-obvious gotchas are called out so
you don't rediscover them.

---

## What a ready-to-go snapshot contains (and how to assemble one)

The rest of this runbook consumes a snapshot. This section is the inverse: what to commit so
a repo *is* a ready-to-go snapshot – one you can clone and stand straight back up, **resume**
the Consort workflow where it left off, and **replay** the run in the dashboard. The commit set is
the kit-owned scaffold surface (item 0) plus three snapshot-specific additions; everything else is
regenerated during rehydration and is left out on purpose.

**0. Kit-owned scaffold surface – think in WHOLE DIRECTORIES, not a file list, on every branch.**
A scaffolded project carries a kit-owned surface that the clone already has from its base scaffold
commit. The kit lays these down as ENTIRE DIRECTORIES, so verify/commit **everything under each
directory** — never a hand-maintained enumeration of individual files (that is exactly how a new
kit file gets silently dropped). The kit-owned directories are:
- `.claude/` — `agents/`, `commands/`, **and `skills/`** (the whole skill tree, all skills).
- `scripts/` — the kit helper scripts (the scm-utils `scripts/lk` shim is project-owned, left as-is).
- `.github/workflows/` — the CI workflows.
- `app/` and `client/` — the scaffolded backend + SPA, **including** their test-capture files
  (`app/consort_capture.py`, `client/consort-vitest-reporter.ts`, `client/playwright.config.ts`,
  `client/tests/setup.ts`, `client/tests/e2e/consort-fixtures.ts`).
- **The project ROOT** — the kit's root-level files: `consort-capture.ts`, `consort-test-reporter.ts`,
  and `playwright.config.ts` (the test-capture + reporter wiring Vitest/Playwright import from
  `../consort-capture` / `../consort-test-reporter`), alongside `.env.example`, `deploy-targets.yaml`,
  `.gitignore`.

> **Gotcha — a snapshot captured from an OLDER scaffold silently lacks newer kit files.** The
> root test-capture files (`consort-capture.ts`, `consort-test-reporter.ts`, root `playwright.config.ts`)
> were added in scm-utils **0.3.4**; a snapshot captured before that is missing them even though the
> `.claude/agents/` surface looks current. On a rehydrated clone the build's test run then cannot start
> (`Vitest + Playwright cannot start locally`) and the driver halts the lane on a **`scaffold-defect`**
> smell — *not* a driver authoring bug, so it is NOT the driver's to fix. Because the surface is
> directory-scoped, do not trust a file checklist: diff each kit-owned directory (`.claude/`, `scripts/`,
> `.github/workflows/`, and the project root's kit files) against the pinned kit —
> `templates/project/common/` (root files + `scripts/` + `.github/workflows/`) and `skills/` — and
> restore any file the directory is missing (a `consort-upgrade` should refresh the full surface). Verify
> the kit surface is complete BEFORE relying on the snapshot for a run.

**1. Project tooling – on every branch.** `setup.sh`, `README.md`, and this
`RUNBOOK-rehydrate-as-new-project.md`. They describe and boot the project independent of which
branch you check out, so they belong on **all** branches. Add them once on the trunk and
forward-merge through the whole ancestry (`main → staging → feature-*`) – no rebase, no
force-push – so every branch carries identical copies and the add-commit is a shared ancestor
of each:

```bash
git switch main
git add setup.sh README.md RUNBOOK-rehydrate-as-new-project.md
git commit -m "add project setup.sh, README, and rehydrate runbook"
git switch staging            && git merge --no-ff main
git switch feature-<slug>     && git merge --no-ff staging
git push origin main staging feature-<slug>
```

**2. Resume state – the Consort design corpus, on the feature branch.** Under `.consort/`,
the per-feature workflow output the lane resumes from instead of re-deriving:
`features/<F>/pipeline.json` (**the durable ledger** – never gitignore it), `feature-spec.*`,
`architecture.*`, `db-design.*`, `test-list.json`, `reconcile-verdict.json`, `stories/**` (ACs,
story, reflect verdicts, analyst-ordered), and `smells.json`. These are tracked normally.
Commit them on the **feature** branch – this is in-flight feature work, so the trunk tiers
(`main`/`staging`) do not carry it:

```bash
git switch feature-<slug>
git add .consort/features/<F> .consort/smells.json
```

**3. Dashboard replay records – force-added on the feature branch.** Two things drive the
dashboard's run view, and **both are gitignored by default**, so both must be force-added:
- `.consort/agent-log.jsonl` – the append-only **event stream** the dashboard reconstructs the
  turn / phase / gate timeline from. This is the one that is easy to miss: without it the
  dashboard shows **no turn history at all**, even when the turn directories are present.
- `.consort/turns/**` – each turn's `turn.json` + `transcript.md`, the per-turn drill-down the
  timeline links to.

Force-add both, then commit the corpus + replay records together:

```bash
git add -f .consort/agent-log.jsonl .consort/turns
git commit -m "capture <F> run: design corpus for resume + event log and turns for dashboard replay"
git push
```

> Run **logs** (`.consort/drive-live.log` and other `*.log`) stay ignored – they are narration
> only. `agent-log.jsonl` is NOT a narration log: it is the structured event stream the
> dashboard replays, so it IS required (and gitignored, hence the force-add above).

**Deliberately NOT committed** (regenerated or repointed during rehydration below):
- `.env` – Step 7 mints a fresh `DATABASE_URL` against the new workspace (`.env.example` is the
  committed template).
- `.lakebase/workflow-state.json` and `.lakebase/kit-ref.local` – workspace-specific runtime
  state, repointed in Steps 3 and 7.

**4. Rename the snapshot durably for re-use (the last step).** Once the surgery above is
committed and pushed, rename the repo to a durable, self-describing name so it becomes a
reusable baseline rather than a live working repo. Encode the captured state in the name –
pattern `<project>-<feature>-design-complete`:

```bash
DURABLE="<project>-<feature>-design-complete"              # e.g. stockflow-example-f2-design-complete
gh repo rename "$DURABLE" -R "$GH_OWNER/<current-repo>"     # rename on GitHub (old URL redirects)
git remote set-url origin "git@github.com:$GH_OWNER/$DURABLE.git"
cd .. && mv <current-dir> "$DURABLE" && cd "$DURABLE"       # match the local dir to the repo
```

Then substitute the new name in the one self-referential spot the shipped docs carry, so a
future clone's parameters line up:
- **This runbook, the Parameters block below:** set `OLD_DIR="$DURABLE"` – `OLD_DIR` is "the
  directory you cloned into," i.e. this snapshot's own name. Commit this change on all branches
  before (or with) the rename.
- **`setup.sh`: nothing to change.** The project name is a runtime argument
  (`./setup.sh <project-name>` → `$NEW_NAME`), so the snapshot's own name is never baked in. The
  only repo reference in `setup.sh` is the Consort bootstrap URL (`databricks-solutions/consort`),
  which points at the kit, not this snapshot – leave it. (Any `feature-f2-…` text in `setup.sh`
  comments is an illustrative example of the branch→feature-id derivation, not config.)

> The durable snapshot is dormant – nobody develops on it. To start a new project from it, clone
> it and run this runbook (or `./setup.sh <new-name>`), which gives the clone a fresh Lakebase +
> git identity. That is why the three-identities rule (dir = Lakebase project = repo name) does
> not bind the snapshot itself: it is re-identified on rehydration.

**Variant – keep the working project (do NOT rename it into the snapshot).** Step 4 above renames
the working repo so the project *becomes* the frozen snapshot. When you instead want the project to
KEEP developing under its own name and only PUBLISH a frozen copy, do not `mv` the directory, do not
rename the project's GitHub repo, and do not move its repo aside. Instead push a COPY of the assembled
snapshot branches to a fresh `<project>-<feature>-design-complete` repo, then leave the working repo
on its own origin:

```bash
DURABLE="<project>-<feature>-design-complete"              # the frozen-snapshot repo name
gh repo create "$GH_OWNER/$DURABLE" --private              # create it empty (replace: delete/rename an existing one aside first)
# push the whole ancestry to the snapshot repo WITHOUT disturbing the project's own origin:
git push "https://github.com/$GH_OWNER/$DURABLE.git" main staging "$(git branch --show-current)"
# origin is untouched – confirm the project still points at its own repo:
git remote -v        # expect origin = the working project's repo, NOT $DURABLE
```

The project's directory name, Lakebase identity, and `origin` are all unchanged; only a copy is
published. If the push temporarily repointed `origin` (e.g. you pushed via `origin`), set it back:
`git remote set-url origin https://github.com/$GH_OWNER/<project>.git`. The snapshot's `OLD_DIR`
substitution still applies (set it to `$DURABLE` in the copy you push), and `setup.sh` still needs no
change. Use this when the live project must survive the snapshot (the snapshot is a point-in-time
fork, not a hand-off of the working repo).

**Updating the snapshot on a kit version bump — DO EVERY STEP (per snapshot repo).** Bumping
`.lakebase/kit-ref` alone is NOT enough. When the kit's scaffold surface changed between versions, a
bare pin bump leaves the committed surface frozen at the old kit, so a rehydrate runs new kit CODE
against an OLD surface and halts the lane on a `scaffold-defect` (the item-0 gotcha above). The
correct update runs the real `consort-upgrade` — which refreshes the FULL surface and dual-pins the
kit — but it auto-commits ONLY the kit-owned surface, so you MUST also commit the E2E-enablement
artifacts it leaves in the working tree and drop its transient rollback record. Run every step below
against a FRESH clone of each snapshot; push to the snapshot repo only, never the working project's.

Index: 1 clone → 2 cache → 3 consort-upgrade → 4 commit E2E artifacts → 5 drop transients →
6 verify surface complete → 7 forward-merge → 8 push.

```bash
# 1. Fresh-clone the snapshot (never a stale local clone), on the trunk.
git clone https://github.com/<owner>/<project>-<feature>-design-complete.git && cd <that-dir>
git checkout main

# 2. Resolve the target kit into the shared cache (the consumer path).
LAKEBASE_KIT_REF=vX.Y.Z ./scripts/lk --refresh

# 3. Run the REAL upgrade. It dual-pins kit-ref(.local) + refreshes the full surface
#    (agents/commands/scripts/workflows/skills/root files) + re-wires the Playwright E2E block,
#    and AUTO-COMMITS ONLY the kit-owned surface ("chore(kit): refresh scaffolded surface to vX.Y.Z").
LAKEBASE_KIT_REF=vX.Y.Z ./scripts/lk consort-upgrade

# 4. Commit the E2E-enablement files consort-upgrade does NOT auto-commit (stage by EXACT path,
#    never `git add -A`): the pytest-playwright dev-dep (pyproject.toml) + the E2E conftest
#    (tests/e2e/conftest.py), plus any other NON-transient file the upgrade left behind.
git add pyproject.toml tests/e2e/conftest.py
git commit -m "chore(kit): E2E enablement artifacts for vX.Y.Z"

# 5. Drop the transient rollback record — it must NEVER ship in a snapshot.
rm -f .lakebase/kit-ref.prev          # (.lakebase/kit-ref.local is gitignored; leave it.)

# 6. Verify the surface is COMPLETE (item-0 scaffold-defect gotcha): BOTH must print nothing.
git diff --name-only
git ls-files --others --exclude-standard

# 7. Forward-merge the ancestry (project-level, on all branches). No rebase, no force.
git switch staging        && git merge --no-ff main
git switch feature-<slug> && git merge --no-ff staging

# 8. Push all branches to the snapshot repo ONLY.
git push origin main staging feature-<slug>
```

> Repeat 1–8 for EACH snapshot repo. `consort-upgrade` is the same tool a live project upgrades with;
> on a dormant snapshot it runs at a clean stop (no drive), so the quiesce gate passes with a
> liveness-unverified note. Do NOT re-capture run-state, logs, or any gitignored runtime.

---

## Parameters (fill these in once)

```bash
OLD_DIR="stockflow-example-f2-design-complete"      # the directory you cloned into
NEW_NAME="stockflow-3"                       # chosen project name (kebab-case, 1-63 chars,
                                             #   lowercase, start with a letter) = Lakebase id
                                             #   + dir name + git repo name
PROFILE="fevm-stockflow"                     # chosen workspace profile (see Step 1)
HOST="https://fevm-stockflow.cloud.databricks.com"   # that profile's host
GH_OWNER="kevin-hartman"                      # GitHub owner for the new repo
PARENT_DIR="$HOME/code"                       # where the project dir lives
```

> The project name becomes **three** identities at once: the Lakebase project id, the
> local directory name, and the new GitHub repo name. Keep them identical – the kit and
> `deploy-targets.yaml` assume `dir name == lakebase project == app name`.

---

## Step 0 – Hydrate the pulled project (prerequisites)

These are the clone-time steps (you've likely already done them):

```bash
git clone git@github.com:<owner>/<pulled-repo>.git
cd <pulled-repo>
git checkout feature-f2-stock-adjustment      # or whichever feature branch you want live
(cd client && npm install)                     # UI projects only
```

Do **not** regenerate `.env` yet – that happens in Step 7, after the new Lakebase project
exists. The `.env` you pulled points at the *old* workspace; it's stale until then.

---

## Step 1 – Choose the workspace and authenticate

List candidate profiles, then let the user pick one. **Never auto-select.**

```bash
grep -E '^\[|^host' ~/.databrickscfg        # show profiles + hosts
```

Once chosen, authenticate that **named profile**. Always pass `--host` *and* `--profile`
explicitly – do **not** run a bare `databricks auth login` and paste the URL into the
`Databricks profile name [DEFAULT]:` prompt (that prompt wants a short *name*, not a host,
and a trailing `# comment` on the line leaks a stray `#` into the host, producing
`Error: host must start with 'https://': #`). Passing `--host` skips the interactive host
prompt entirely. (Host-only login does *not* refresh a named profile's token – see Gotchas.)

```bash
databricks auth login --host "$HOST" --profile "$PROFILE"
databricks current-user me -p "$PROFILE"     # verify: expect "active": true
```

---

## Step 2 – Create the Lakebase project on the chosen workspace

Creating a project also creates its **default `production` branch** automatically.
It's a long-running op; it waits by default.

```bash
databricks postgres create-project "$NEW_NAME" -p "$PROFILE" -o json
```

Confirm the result shows `"default_branch": "projects/<NEW_NAME>/branches/production"`.

---

## Step 3 – Recreate the tier + feature branches

Match the pulled project's topology. Inspect it first:

```bash
./scripts/lk lakebase-scm-state      # shows tier_topology, branch, parent_branch, feature_id
```

A 2-tier project is `production` → `staging` → `feature-*`. Create the missing branches,
each forked from its parent, as **long-running** (`no_expiry`).

> **Critical gotcha:** the expiry fields go **inside a `spec` wrapper**, and the whole
> body must be `{"spec": {...}}`. A top-level `{"no_expiry": true}` is silently dropped
> and the server rejects the create. (The `databricks` CLI's own request model also
> strips `no_expiry`, so pass it through `spec`.)

**Default – raw CLI** (this is the path verified end-to-end; note the `spec` wrapper and
`-p "$PROFILE"`):

```bash
databricks postgres create-branch projects/"$NEW_NAME" staging -p "$PROFILE" -o json \
  --json '{"spec": {"source_branch": "projects/'"$NEW_NAME"'/branches/production", "no_expiry": true}}'

databricks postgres create-branch projects/"$NEW_NAME" feature-f2-stock-adjustment -p "$PROFILE" -o json \
  --json '{"spec": {"source_branch": "projects/'"$NEW_NAME"'/branches/staging", "no_expiry": true}}'
```

**Alternative – the kit CLI** (resolves auth by `--host`; cleaner, but not yet verified
end-to-end on this flow – the kit's paired/sync-env calls can hit the `DEFAULT`-profile
auth issue in Gotcha 3):

```bash
./scripts/lk lakebase-branch create \
  --instance "$NEW_NAME" --branch staging \
  --parent production --no-expiry --host "$HOST"

./scripts/lk lakebase-branch create \
  --instance "$NEW_NAME" --branch feature-f2-stock-adjustment \
  --parent staging --no-expiry --host "$HOST"
```

Verify all three are `READY`:

```bash
databricks postgres list-branches projects/"$NEW_NAME" -p "$PROFILE" -o json
```

---

## Step 4 – Rename the project directory

```bash
cd "$PARENT_DIR"
mv "$OLD_DIR" "$NEW_NAME"
cd "$NEW_NAME"
```

---

## Step 5 – Detach from the repo it was pulled from

```bash
git remote -v                 # note what's there (often origin + a 'snapshot' remote)
git remote remove origin
git remote remove snapshot 2>/dev/null || true    # drop any extra pull-time remotes
git remote -v                 # expect: no remotes
```

The local git **history** is kept – you're only cutting the link to the old origin.

---

## Step 6 – Re-attach to a new repo of your chosen name

Create a fresh GitHub repo named `$NEW_NAME`, wire it as `origin`, and push **every git
branch in the feature's ancestry** – not just the feature branch. The feature branch is
forked from `staging`, which is forked from the trunk `main`; if you push only the feature
branch, the new repo is **missing `staging` (and `main`)** and the feature branch has no
parent there. (Symptom: "there's no staging branch the feature is branched from.")

> **Git branch names ≠ Lakebase tier names.** On the **Lakebase** side the tiers are
> `production → staging → feature-*` (Step 3). On the **git** side the trunk is **`main`**
> (it maps to the Lakebase `production` tier); the git branches are `main`, `staging`, and
> `feature-*`. There is **no git branch named `production`** – push `main`, not `production`.

```bash
gh repo create "$GH_OWNER/$NEW_NAME" --private --source=. --remote=origin
# push the whole ancestry so the feature branch has its parent (staging) and trunk (main):
git push -u origin main staging "$(git branch --show-current)"
# verify the new repo has all three:  git ls-remote --heads origin
```

> If you'd rather attach to an **existing** empty repo instead of creating one:
> `git remote add origin git@github.com:$GH_OWNER/$NEW_NAME.git && git push -u origin HEAD`

---

## Step 6b – Register a self-hosted CI runner for the new repo

Every workflow in `.github/workflows/` is `runs-on: self-hosted`, so until a runner is
registered against the **new** repo its CI never starts – PR checks sit queued forever.
`lakebase-create-project` provisions one automatically on a fresh create; a rehydrated
project needs it done by hand (do **not** re-run `lakebase-create-project` just for the
runner – it would try to stand up a whole new project). This mirrors exactly what the
create flow does internally.

Kit conventions (match them so `lk`/doctor recognize the runner):
- **Install dir:** `~/.lakebase/runners/$NEW_NAME`
- **Runner name:** `lakebase-$NEW_NAME`
- **Label:** `self-hosted` (what the workflows require)
- **Runner version:** `2.333.1`, archive shared-cached under `~/.cache/github-actions-runner`

```bash
RUNNER_VERSION=2.333.1
RUNNER_OS=$([ "$(uname -s)" = "Darwin" ] && echo osx || echo linux)
RUNNER_ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo x64)
ARCHIVE="actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
RUNNER_DIR="$HOME/.lakebase/runners/$NEW_NAME"
RUNNER_NAME="lakebase-$NEW_NAME"

# 1. Download the runner once into the shared cache, then extract into the project's runner dir.
mkdir -p "$HOME/.cache/github-actions-runner" "$RUNNER_DIR"
[ -f "$HOME/.cache/github-actions-runner/$ARCHIVE" ] || \
  curl -fsSL -o "$HOME/.cache/github-actions-runner/$ARCHIVE" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}"
tar -xzf "$HOME/.cache/github-actions-runner/$ARCHIVE" -C "$RUNNER_DIR"

# 2. Mint a short-lived registration token for the NEW repo (needs gh auth as the repo owner).
REG_TOKEN=$(gh api -X POST "repos/$GH_OWNER/$NEW_NAME/actions/runners/registration-token" -q .token)

# 3. Register (unattended, replacing any stale registration of the same name) and start it detached.
( cd "$RUNNER_DIR" && ./config.sh \
    --url "https://github.com/$GH_OWNER/$NEW_NAME" \
    --token "$REG_TOKEN" \
    --name "$RUNNER_NAME" \
    --labels self-hosted \
    --unattended --replace )
( cd "$RUNNER_DIR" && nohup ./run.sh >/dev/null 2>&1 & echo $! > "$RUNNER_DIR/.pid" )
```

Verify it registered and is **online**:

```bash
gh api "repos/$GH_OWNER/$NEW_NAME/actions/runners" \
  -q '.runners[] | "\(.name)  \(.status)  \(.labels | map(.name) | join(","))"'
# expect: lakebase-$NEW_NAME  online  self-hosted,<os>,<arch>
```

> **Gotchas.**
> - The registration token is short-lived (~1 h) and single-use – mint it immediately before
>   `config.sh`, don't reuse an old one.
> - A `404` from the token call means the signed-in `gh` user can't see the repo (usually a
>   private repo owned by another account). Sign in as the repo owner, or set `GITHUB_TOKEN`
>   to a token with access, and retry.
> - The runner needs **Java** for some actions; if `run.sh` complains, set `JAVA_HOME`
>   (`export JAVA_HOME=$(/usr/libexec/java_home)` on macOS) before starting it.
> - To stop/replace later: `kill "$(cat "$RUNNER_DIR/.pid")"`, then re-run step 3.

---

## Step 7 – Repoint config + regenerate `.env`

Update the **load-bearing** name/host references, then let the kit mint a fresh
`DATABASE_URL` against the new workspace.

**7a. Host, profile, and name in `.env`:**

```bash
sed -i '' -E "s#^DATABRICKS_HOST=.*#DATABRICKS_HOST=$HOST#" .env
sed -i '' -E "s#^DATABRICKS_CONFIG_PROFILE=.*#DATABRICKS_CONFIG_PROFILE=$PROFILE#" .env
sed -i '' -E "s#^LAKEBASE_PROJECT_ID=.*#LAKEBASE_PROJECT_ID=$NEW_NAME#" .env
```

> **Do not skip `DATABRICKS_CONFIG_PROFILE`.** This is the single most important line and
> the easiest to miss. The kit and CLI resolve auth from the **pinned profile**, which
> *overrides* `DATABRICKS_HOST`. If it still points at the old workspace's profile, every
> tool (`lakebase-doctor`, branch list, sync-env) silently authenticates to the **old**
> workspace and shows the **old** project's branches – the project "can't see" the new
> branches even though `DATABRICKS_HOST` looks correct. (This exact miss is what caused the
> "`.env` doesn't see the Lakebase branches" symptom.)

**7b. Other load-bearing config** (edit these so dir == lakebase project == app name):
- `.lakebase/workflow-state.json` → `"project_id"` **and** `"lakebase_branch_uid"`
  (set the uid to the *new* feature branch's uid from the Step 3 `list-branches` output –
  the pulled value points at the old workspace's branch)
- `deploy-targets.yaml` → `lakebase_project`, `app_name`, `workspace_path`

Cosmetic-only references (safe to update for tidiness, not required to run):
`pyproject.toml`, `client/package.json`, `client/index.html`, `app/main.py`,
`client/src/**` display strings.

**7c. Regenerate the Lakebase `DATABASE_URL` through the kit** (writes `.env` for the
current feature branch, minting a token against the new workspace):

```bash
./scripts/lk lakebase-branch sync-env \
  --instance "$NEW_NAME" --branch "$(git branch --show-current)" --host "$HOST"
```

> **Gotcha – stale endpoint host.** `LAKEBASE_HOST` is region-specific and *will differ*
> on the new workspace. If `sync-env` leaves the old endpoint, read the real one and set it:
> ```bash
> databricks api get \
>   "/api/2.0/postgres/projects/$NEW_NAME/branches/$(git branch --show-current)/endpoints" \
>   -p "$PROFILE"        # use status.hosts.host, e.g. ep-xxxx.database.<region>.cloud.databricks.com
> ```
> then `sed -i '' -E "s#^LAKEBASE_HOST=.*#LAKEBASE_HOST=<that host>#" .env`.

---

## Step 7g – Provision CI auth secrets for the new repo

`lakebase-create-project` sets the repo's CI secrets at create time, but a rehydrated project
re-attached to a **brand new** repo (Steps 5–6) starts with an empty Actions secret store. If
left empty, the next promotion CI run fails the whole feature on an empty `DATABRICKS_TOKEN`
(no `DATABASE_URL` → the test step aborts). Mint a fresh CI PAT and set the three secrets, then
verify they landed:

```bash
./scripts/lk lakebase-sync-ci-secrets   # resolves host + project-id from .env, repo from origin
```

This sets `DATABRICKS_HOST`, `LAKEBASE_PROJECT_ID`, and `DATABRICKS_TOKEN` as repo Actions
secrets and exits non-zero (naming the gaps) if any is still missing. It is idempotent — safe to
re-run any time CI fails on missing/empty auth (e.g. when the 24h PAT later expires). Skip under
`--no-github` (no repo to set secrets on).

---

## Step 8 – Verify

```bash
git remote -v                                         # origin = new repo, no old remotes
grep -E '^(DATABRICKS_HOST|DATABRICKS_CONFIG_PROFILE|LAKEBASE_PROJECT_ID|LAKEBASE_HOST|LAKEBASE_BRANCH_ID)' .env
./scripts/lk lakebase-doctor | grep -iE 'databricks-auth|config-profile|lakebase-project'
./scripts/lk lakebase-branch list --instance "$NEW_NAME"   # uids must match the NEW workspace
./scripts/lk lakebase-scm-state                       # project_id/branch/uid match the new project
# UI projects: (cd client && npm run build) or ./scripts/run-dev.sh to smoke-test the app
```

**The decisive check:** `lakebase-doctor` must report `Authenticated to <new HOST>` and
`CLI profile pinned: <new PROFILE>`, and `lakebase-branch list` (run with the project's
*own* auth, no `--host`) must return the **new** workspace's branch uids. If it still shows
the old uids, `DATABRICKS_CONFIG_PROFILE` in `.env` is still the old profile (Step 7a).
Also confirm the regenerated `DATABASE_URL`'s token issuer is the new workspace host.

> **Opening the project in the IDE.** Do this *after* the `.env` edits above (as this
> runbook is ordered) and the Lakebase SCM extension activates against the final `.env` –
> no extra step needed. **You only need to reload** if the project was *already open* in
> the IDE while you edited `.env` (the extension caches `DATABRICKS_HOST` /
> `DATABRICKS_CONFIG_PROFILE` / project UID at activation): run `Cmd+Shift+P` →
> **Developer: Reload Window**, then Refresh the SCM view. Symptom of a stale cache:
> empty branch tree, or *"Cannot build console URL. Check DATABRICKS_HOST and
> LAKEBASE_PROJECT_ID in .env"* (the extension failed to resolve the project UID against
> the old cached workspace, not an actual `.env` problem).

---

## Gotchas (hard-won)

0. **`DATABRICKS_CONFIG_PROFILE` in `.env` overrides `DATABRICKS_HOST` for auth.** If you
   repoint the host but leave the old pinned profile, every tool authenticates to the **old**
   workspace and the project "can't see" the new Lakebase branches (it lists the old ones).
   Update it in Step 7a and confirm with `lakebase-doctor` (`CLI profile pinned: <new>`).
1. **`no_expiry` must be inside `{"spec": {...}}`.** Top-level is silently dropped and the
   create fails with "Expiration must be specified." The CLI's request model also strips it,
   so always nest under `spec` (or use the kit's `--no-expiry` flag, which does this for you).
2. **Host-only `databricks auth login` doesn't refresh a named profile.** If a profile's
   refresh token is invalid, log in with `--profile <name>` explicitly.
3. **The Consort MCP *write* tools (`lakebase_branch_create_paired`, `..._sync_env`) fall
   back to the `DEFAULT` profile** and fail if `DEFAULT` is expired. For **branch creation**,
   use the raw `databricks postgres create-branch … -p <profile>` CLI (Step 3 default) – it's
   the verified path. For **`.env` regen** (Step 7c), `./scripts/lk lakebase-branch sync-env
   --host <host>` worked when we did this. The read tools (`lakebase_branch_list/show`) accept
   a `host` override and are fine.
4. **`LAKEBASE_HOST` is region-specific** – it changes per workspace; don't assume the pulled
   value carries over (Step 7c).
5. **The old project still exists** on the workspace it was pulled from. If you're fully
   migrated, tear it down separately:
   `databricks postgres delete-project projects/<old-id> -p <old-profile>`.
6. **Keep the three identities equal** (dir name = Lakebase project id = GitHub repo name);
   `deploy-targets.yaml` and the kit assume it.
7. **A GUI-launched editor can't find `databricks` → empty SCM branch tree (silent).** The
   Lakebase SCM extension shells out to the `databricks` CLI; the branch-list error is
   swallowed, so a failure shows as *no branches*, not an error. If the editor was launched
   from the Dock/Finder, its `PATH` is the macOS default (`/usr/bin:/bin:/usr/sbin:/sbin`)
   and does **not** include `/opt/homebrew/bin` (Apple Silicon Homebrew) where `databricks`
   lives – so every CLI call fails. A window reload does **not** fix it (same `PATH`).
   - **Confirm:** `View → Output` → the **"Lakebase SCM"** channel shows a
     `databricks: command not found` / `ENOENT` error. Check the parent process with
     `ps -o ppid= -p "$(pgrep -f 'Cursor.app/Contents/MacOS/Cursor' | head -1)"` – a parent
     of `1` (`launchd`) means GUI-launched.
   - **Fix:** fully quit the editor (`Cmd+Q`), then relaunch it **from a terminal** (which
     has `/opt/homebrew/bin` on `PATH`): `cursor <project-dir>` (or `code <project-dir>`).
     The extension host then inherits the full `PATH` and resolves `databricks`.
   - **Alternative (fixes all GUI apps):** put Homebrew on the GUI `PATH` once –
     `sudo launchctl config user path /opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`
     then reboot.
