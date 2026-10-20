#!/usr/bin/env bash
#
# setup.sh – stand up a git-pulled Consort project as a *new*
# Lakebase + git project (new Lakebase project on a workspace you choose, dir renamed,
# git repo detached and re-attached to a new repo, CI runner registered, .env regen'd).
#
# This is the executable form of RUNBOOK-rehydrate-as-new-project.md. Each phase maps to a
# runbook Step; the hard-won gotchas are enforced as guards here instead of described in prose:
#   - no_expiry is sent inside a {"spec": {...}} wrapper (Gotcha 1)
#   - the whole branch ancestry (main + staging + feature) is pushed, not just the feature (Step 6)
#   - git trunk is `main`, never a git branch named `production` (Step 6)
#   - a self-hosted CI runner is registered against the new repo (Step 6b)
#   - CI auth secrets are provisioned on the new repo so promotion CI isn't DOA (Step 7g)
#   - DATABRICKS_CONFIG_PROFILE is pinned in .env – it overrides DATABRICKS_HOST (Gotcha 0)
#   - LAKEBASE_HOST is re-read region-specifically after sync-env (Gotcha 4)
#
# Prerequisite: run the Consort bootstrap first – it installs + authenticates the tools
#   (Node, Python, JDK, gh, Databricks CLI). Do NOT pin it to a tag/release; use main:
#   bash <(curl -sL https://tinyurl.com/consort-bootstrap)
#
# Usage:
#   ./setup.sh <project-name> [options]
#
# Required:
#   <project-name>           REQUIRED. The project name as the first bare argument
#                            (or via --project-name <name>). kebab-case, 1-63 chars,
#                            lowercase, starts with a letter. Becomes Lakebase project
#                            id == dir name == GitHub repo name.
#   --profile <name>         Databricks CLI profile for the TARGET workspace.
#                            If omitted, you are shown the profile list and asked to pick
#                            (never auto-selected).
#
# Optional:
#   --host <url>             Workspace host. Default: derived from the chosen profile.
#   --gh-owner <owner>       GitHub owner for the new repo. Default: `gh` default / current login.
#   --parent-dir <path>      Parent dir the project lives in. Default: the project's parent.
#   --feature-branch <name>  Live feature branch. Default: current branch.
#   --tiers <1|2|3>          Lakebase tier count. Default: derived from lakebase-scm-state, else 2.
#   --no-github              Skip the GitHub repo create + push + runner (local/Lakebase only).
#   --skip-runner            Do the GitHub repo but skip the self-hosted CI runner (Step 6b).
#   --no-rename              Don't rename the directory (Step 4).
#   --runner-version <v>     actions-runner version. Default: 2.333.1.
#   --yes, -y                Non-interactive: assume yes at every confirmation.
#   --dry-run                Print what would run; make no changes.
#   --help, -h               This help.
#
# Idempotent: re-running skips a Lakebase project/branch that already exists, a remote already
# wired, branches already pushed, and a runner already online. Safe to resume after a failure.

set -euo pipefail

# ---------------------------------------------------------------------------- helpers
RUNNER_VERSION_DEFAULT="2.333.1"
C_BLUE=$'\033[34m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
step() { printf '\n%s=== %s ===%s\n' "$C_BLUE" "$*" "$C_OFF"; }
log()  { printf '%s•%s %s\n' "$C_DIM" "$C_OFF" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
die()  { printf '%s✗ %s%s\n' "$C_RED" "$*" "$C_OFF" >&2; exit 1; }

DRY_RUN=0
# run: execute a command, or just print it under --dry-run. Use for state-changing calls.
run() {
  if [ "$DRY_RUN" = 1 ]; then printf '%s[dry-run]%s %s\n' "$C_DIM" "$C_OFF" "$*"; return 0; fi
  "$@"
}
# run_sh: same, for a shell snippet (pipes/redirs). Pass a single string.
run_sh() {
  if [ "$DRY_RUN" = 1 ]; then printf '%s[dry-run]%s %s\n' "$C_DIM" "$C_OFF" "$1"; return 0; fi
  bash -c "$1"
}
ASSUME_YES=0
confirm() { # confirm "<prompt>"  -> returns 0 on yes; defaults to YES (Enter = yes)
  [ "$ASSUME_YES" = 1 ] && return 0
  local reply; printf '%s? %s [Y/n] %s' "$C_YELLOW" "$1" "$C_OFF"
  read -r reply </dev/tty || return 1
  [[ ! "$reply" =~ ^[Nn]$ ]]   # anything but an explicit n/N (incl. empty) is yes
}
# portable in-place sed (BSD/macOS needs the empty-arg; GNU doesn't)
sed_inplace() { # sed_inplace <expr> <file>
  if sed --version >/dev/null 2>&1; then run sed -i -E "$1" "$2"; else run sed -i '' -E "$1" "$2"; fi
}
need() { command -v "$1" >/dev/null 2>&1 || die "required tool not found on PATH: $1"; }

# ---------------------------------------------------------------------------- args
NEW_NAME="" PROFILE="" HOST="" GH_OWNER="" PARENT_DIR="" FEATURE_BRANCH="" TIERS=""
NO_GITHUB=0 SKIP_RUNNER=0 NO_RENAME=0 RENAMED=0 RUNNER_VERSION="$RUNNER_VERSION_DEFAULT"
while [ $# -gt 0 ]; do
  case "$1" in
    --project-name) NEW_NAME="$2"; shift 2;;
    --profile) PROFILE="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --gh-owner) GH_OWNER="$2"; shift 2;;
    --parent-dir) PARENT_DIR="$2"; shift 2;;
    --feature-branch) FEATURE_BRANCH="$2"; shift 2;;
    --tiers) TIERS="$2"; shift 2;;
    --no-github) NO_GITHUB=1; shift;;
    --skip-runner) SKIP_RUNNER=1; shift;;
    --no-rename) NO_RENAME=1; shift;;
    --runner-version) RUNNER_VERSION="$2"; shift 2;;
    -y|--yes) ASSUME_YES=1; shift;;
    --dry-run) DRY_RUN=1; shift;;
    -h|--help) sed -n '2,55p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    -*) die "unknown option: $1 (see --help)";;
    *)  # first bare argument is the project name (positional default)
        if [ -z "$NEW_NAME" ]; then NEW_NAME="$1"; shift; else die "unexpected argument: $1 (project name already set to '$NEW_NAME')"; fi;;
  esac
done

need git; need databricks
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # setup.sh lives at the project root
cd "$REPO_ROOT"
[ -x "$REPO_ROOT/scripts/lk" ] || die "no ./scripts/lk here – run from a lakebase-create-project root."
[ -d "$REPO_ROOT/.consort" ] || warn ".consort/ not found – is this really a Consort project?"

# ---------------------------------------------------------------------------- Step 1: workspace + auth
step "Step 1 – Choose the workspace and authenticate"
if [ -z "$PROFILE" ]; then
  [ "$ASSUME_YES" = 1 ] && die "--profile is required with --yes (never auto-select a workspace)."
  log "Available profiles (host shown):"
  databricks auth profiles 2>/dev/null | awk 'NR==1||$0!~/^Warn/' || grep -E '^\[|^host' "$HOME/.databrickscfg"
  printf '%s? Profile for the TARGET workspace: %s' "$C_YELLOW" "$C_OFF"; read -r PROFILE </dev/tty
  [ -n "$PROFILE" ] || die "no profile chosen."
fi
# Derive HOST from the profile if not supplied (reads ~/.databrickscfg).
if [ -z "$HOST" ]; then
  HOST="$(awk -v p="[$PROFILE]" '$0==p{f=1;next} f&&/^host/{sub(/^host[ \t]*=[ \t]*/,"");print;exit} /^\[/{f=0}' "$HOME/.databrickscfg" 2>/dev/null || true)"
fi
[ -n "$HOST" ] || die "could not resolve host for profile '$PROFILE' – pass --host explicitly."
case "$HOST" in https://*) ;; *) die "host must start with https:// (got: '$HOST'). Do not paste it into an interactive prompt.";; esac
log "profile=$PROFILE  host=$HOST"
# Verify auth; only (re)login if the token is dead. Always pass --host AND --profile (Gotcha 2 / Step 1).
if databricks current-user me -p "$PROFILE" >/dev/null 2>&1; then
  ok "already authenticated to $PROFILE"
else
  log "token invalid/absent – logging in (non-interactive host via --host)"
  run databricks auth login --host "$HOST" --profile "$PROFILE"
  run databricks current-user me -p "$PROFILE" >/dev/null || die "auth still failing for $PROFILE"
fi

# Resolve remaining params now that we're in the repo.
[ -n "$FEATURE_BRANCH" ] || FEATURE_BRANCH="$(git branch --show-current)"
[ -n "$FEATURE_BRANCH" ] || die "detached HEAD – pass --feature-branch."
[ -n "$PARENT_DIR" ] || PARENT_DIR="$(dirname "$REPO_ROOT")"
[ -n "$NEW_NAME" ] || die "project name is required: ./setup.sh <project-name> (or --project-name <name>)."
[[ "$NEW_NAME" =~ ^[a-z][a-z0-9-]{0,62}$ ]] || die "invalid project name '$NEW_NAME' (lowercase, start with a letter, 1-63 chars)."
if [ "$NO_GITHUB" = 0 ] && [ -z "$GH_OWNER" ]; then
  GH_OWNER="$(gh api user -q .login 2>/dev/null || true)"
  [ -n "$GH_OWNER" ] || warn "could not infer --gh-owner from gh; pass it explicitly if repo create fails."
fi
# Tier count: honor --tiers, else derive from scm-state, else default 2.
if [ -z "$TIERS" ]; then
  TIERS="$(./scripts/lk lakebase-scm-state 2>/dev/null | grep -oiE 'tier[_-]?topology[^0-9]*([0-9])' | grep -oE '[0-9]' | head -1 || true)"
  [ -n "$TIERS" ] || TIERS=2
fi
log "project-name=$NEW_NAME  feature-branch=$FEATURE_BRANCH  tiers=$TIERS  gh-owner=${GH_OWNER:-<none>}  parent=$PARENT_DIR"
confirm "Proceed with these settings?" || die "aborted."

# ---------------------------------------------------------------------------- Step 2: create Lakebase project
step "Step 2 – Create the Lakebase project '$NEW_NAME'"
# get-project returns exit 0 even for a SOFT-DELETED project – a tombstone carrying a
# delete_time. Treat that as not-existing, else Step 3's create-branch fails with
# "Project not found" against a deleted project.
PROJ_JSON="$(databricks postgres get-project "projects/$NEW_NAME" -p "$PROFILE" -o json 2>/dev/null || true)"
if [ -n "$PROJ_JSON" ] && ! printf '%s' "$PROJ_JSON" | grep -q '"delete_time"'; then
  ok "project '$NEW_NAME' already exists – skipping create"
else
  [ -n "$PROJ_JSON" ] && warn "a soft-deleted '$NEW_NAME' tombstone exists – creating fresh (if the name is still reserved, pick a different --project-name)"
  run databricks postgres create-project "$NEW_NAME" -p "$PROFILE" -o json
  ok "created project '$NEW_NAME' (default branch: production)"
fi

# ---------------------------------------------------------------------------- Step 3: tier + feature branches
step "Step 3 – Recreate tier + feature branches (${TIERS}-tier)"
# Lakebase branch ancestry by tier count: production -> [staging] -> [dev] -> feature-*
LB_BRANCHES=()
case "$TIERS" in
  1) LB_PARENT_OF_FEATURE="production";;
  2) LB_BRANCHES+=("staging:production"); LB_PARENT_OF_FEATURE="staging";;
  3) LB_BRANCHES+=("staging:production" "dev:staging"); LB_PARENT_OF_FEATURE="dev";;
  *) die "unsupported --tiers '$TIERS' (use 1, 2, or 3).";;
esac
LB_BRANCHES+=("$FEATURE_BRANCH:$LB_PARENT_OF_FEATURE")

branch_exists() { databricks postgres get-branch "projects/$NEW_NAME/branches/$1" -p "$PROFILE" >/dev/null 2>&1; }
for pair in "${LB_BRANCHES[@]}"; do
  br="${pair%%:*}"; parent="${pair##*:}"
  if branch_exists "$br"; then
    ok "branch '$br' already exists – skipping"
  else
    log "creating branch '$br' (parent: $parent, no-expiry)"
    # Gotcha 1: no_expiry MUST be inside {"spec": {...}} – top-level is silently dropped.
    run databricks postgres create-branch "projects/$NEW_NAME" "$br" -p "$PROFILE" -o json \
      --json "{\"spec\": {\"source_branch\": \"projects/$NEW_NAME/branches/$parent\", \"no_expiry\": true}}"
  fi
done
log "branches on '$NEW_NAME':"
run databricks postgres list-branches "projects/$NEW_NAME" -p "$PROFILE" -o json

# ---------------------------------------------------------------------------- Step 4: rename the directory
step "Step 4 – Rename the project directory"
if [ "$NO_RENAME" = 1 ]; then
  log "--no-rename: leaving directory as-is ($REPO_ROOT)"
elif [ "$(basename "$REPO_ROOT")" = "$NEW_NAME" ]; then
  ok "directory already named '$NEW_NAME'"
else
  TARGET_DIR="$PARENT_DIR/$NEW_NAME"
  [ -e "$TARGET_DIR" ] && die "target dir already exists: $TARGET_DIR"
  run mv "$REPO_ROOT" "$TARGET_DIR"
  REPO_ROOT="$TARGET_DIR"; RENAMED=1; [ "$DRY_RUN" = 1 ] || cd "$REPO_ROOT"
  ok "renamed; now operating in $REPO_ROOT"
fi

# ---------------------------------------------------------------------------- Step 5: detach old remote
step "Step 5 – Detach from the repo it was pulled from"
# FIRST materialize the full ancestry (main + staging + feature) as LOCAL branches from
# origin/*. A fresh clone only has the clone-default branch and whatever you checked out as
# local branches; the others exist only as origin/* refs – which `git remote remove` below
# deletes. Without this, Step 6 would push only the local branches and the new repo would be
# missing staging (and/or main), leaving the feature branch with no parent there.
for b in main staging "$FEATURE_BRANCH"; do
  if ! git show-ref --verify --quiet "refs/heads/$b" && git show-ref --verify --quiet "refs/remotes/origin/$b"; then
    run git branch "$b" "origin/$b"
    log "materialized local branch '$b' from origin/$b (so Step 6 can push it)"
  fi
done
for r in origin snapshot; do
  if git remote get-url "$r" >/dev/null 2>&1; then
    log "removing remote '$r' ($(git remote get-url "$r"))"; run git remote remove "$r"
  fi
done
ok "remotes now: $(git remote || echo none)"

# ---------------------------------------------------------------------------- Step 5b: untrack rehydration-only ephemeral files
# The snapshot repo FORCE-TRACKS files the scaffold normally gitignores (.consort/turns/**,
# agent-log.jsonl, ...) so a CLONE transfers them — the dashboard design-journey + the rehydration
# state. But once live here the drive REWRITES those files every turn; left TRACKED they become
# uncommitted drift that blocks prepare-pr / a plain pull and strands acceptance churn (the exact
# footgun that made a shipped branch look stale). `git rm --cached` drops them from the index but
# KEEPS them on disk, so the dashboard still renders the journey (it reads the filesystem, not git)
# while the drive treats them as normal ephemeral (gitignored) churn again. Done on EVERY ancestry
# branch BEFORE the push, so the new repo ships clean and the drift can't recur on whichever branch
# you land on. Generic by construction: untrack EXACTLY the tracked-but-ignored set, whatever it is.
step "Step 5b – Untrack rehydration-only ephemeral runtime files (keep on disk)"
if [ "$DRY_RUN" = 1 ]; then
  log "[dry-run] per ancestry branch: git rm --cached \$(git ls-files --cached --ignored --exclude-standard)"
else
  _ret_branch="$(git branch --show-current)"
  for b in main staging "$FEATURE_BRANCH"; do
    git show-ref --verify --quiet "refs/heads/$b" || continue
    if ! git checkout -q "$b" 2>/dev/null; then warn "5b: could not checkout '$b' (dirty tree?); skipping"; continue; fi
    _eph="$(git ls-files --cached --ignored --exclude-standard)"
    if [ -n "$_eph" ]; then
      printf '%s\n' "$_eph" | tr '\n' '\0' | xargs -0 git rm --cached -q --
      git commit -q -m "chore: untrack rehydration-only ephemeral runtime files (keep on disk)" \
        && ok "5b: $b – untracked $(printf '%s\n' "$_eph" | grep -c .) ephemeral file(s)"
    else
      log "5b: $b – nothing tracked-but-ignored"
    fi
  done
  [ -n "$_ret_branch" ] && git checkout -q "$_ret_branch" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------- Step 6: new repo + full ancestry push
if [ "$NO_GITHUB" = 1 ]; then
  step "Step 6 – Re-attach to a new repo  [SKIPPED: --no-github]"
else
  step "Step 6 – Re-attach to a new repo '$GH_OWNER/$NEW_NAME'"
  need gh
  # Branches to push = the feature's whole git ancestry (Step 6): main + staging + feature.
  # git trunk is `main`, NOT a git branch named `production`.
  PUSH_BRANCHES=()
  for b in main staging "$FEATURE_BRANCH"; do
    git show-ref --verify --quiet "refs/heads/$b" && PUSH_BRANCHES+=("$b")
  done
  # de-dup (feature could equal main/staging in odd setups)
  PUSH_BRANCHES=($(printf '%s\n' "${PUSH_BRANCHES[@]}" | awk '!seen[$0]++'))
  log "will push ancestry: ${PUSH_BRANCHES[*]}"
  if git remote get-url origin >/dev/null 2>&1; then
    ok "origin already set ($(git remote get-url origin))"
  elif gh repo view "$GH_OWNER/$NEW_NAME" >/dev/null 2>&1; then
    log "repo exists – wiring it as origin"
    run git remote add origin "https://github.com/$GH_OWNER/$NEW_NAME.git"
  else
    log "creating private GitHub repo '$GH_OWNER/$NEW_NAME' and wiring origin"
    run gh repo create "$GH_OWNER/$NEW_NAME" --private --source=. --remote=origin
  fi
  run git push -u origin "${PUSH_BRANCHES[@]}"
  log "remote heads now:"; run_sh "git ls-remote --heads origin"
  ok "pushed full ancestry (feature branch has its parent + trunk on the new repo)"
fi

# ---------------------------------------------------------------------------- Step 6b: self-hosted CI runner
if [ "$NO_GITHUB" = 1 ] || [ "$SKIP_RUNNER" = 1 ]; then
  step "Step 6b – Register self-hosted CI runner  [SKIPPED]"
else
  step "Step 6b – Register a self-hosted CI runner for '$GH_OWNER/$NEW_NAME'"
  need gh; need curl; need tar
  RUNNER_OS=$([ "$(uname -s)" = "Darwin" ] && echo osx || echo linux)
  RUNNER_ARCH=$([ "$(uname -m)" = "arm64" ] && echo arm64 || echo x64)
  ARCHIVE="actions-runner-${RUNNER_OS}-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
  RUNNER_CACHE="$HOME/.cache/github-actions-runner"
  RUNNER_DIR="$HOME/.lakebase/runners/$NEW_NAME"           # kit convention
  RUNNER_NAME="lakebase-$NEW_NAME"                          # kit convention
  if gh api "repos/$GH_OWNER/$NEW_NAME/actions/runners" -q '.runners[].name' 2>/dev/null | grep -qx "$RUNNER_NAME" \
     && gh api "repos/$GH_OWNER/$NEW_NAME/actions/runners" -q ".runners[] | select(.name==\"$RUNNER_NAME\") | .status" 2>/dev/null | grep -qx online; then
    ok "runner '$RUNNER_NAME' already online – skipping"
  else
    run mkdir -p "$RUNNER_CACHE" "$RUNNER_DIR"
    if [ ! -f "$RUNNER_CACHE/$ARCHIVE" ]; then
      log "downloading actions-runner $RUNNER_VERSION ($RUNNER_OS-$RUNNER_ARCH)"
      run curl -fsSL -o "$RUNNER_CACHE/$ARCHIVE" \
        "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}"
    else log "runner archive already cached"; fi
    [ -f "$RUNNER_DIR/config.sh" ] || run tar -xzf "$RUNNER_CACHE/$ARCHIVE" -C "$RUNNER_DIR"
    # macOS SIGKILLs ("Killed: 9") runner binaries carrying com.apple.quarantine (e.g. if the
    # archive was ever downloaded via a browser). Strip it so Runner.Listener isn't killed.
    [ "$RUNNER_OS" = osx ] && run_sh "xattr -dr com.apple.quarantine '$RUNNER_DIR' 2>/dev/null || true"
    log "minting a registration token (short-lived, single-use) for the new repo"
    if [ "$DRY_RUN" = 1 ]; then
      log "[dry-run] gh api -X POST repos/$GH_OWNER/$NEW_NAME/actions/runners/registration-token"
    else
      REG_TOKEN="$(gh api -X POST "repos/$GH_OWNER/$NEW_NAME/actions/runners/registration-token" -q .token)" \
        || die "could not mint runner token. A 404 means the gh user can't see the repo – sign in as the owner or set GITHUB_TOKEN."
      # `--replace` below only replaces the SERVER-side registration; it does NOT clear a
      # pre-existing LOCAL config. A re-run on an already-configured runner dir (a prior setup
      # attempt, a leftover from a failed run) makes config.sh HARD-STOP ("Cannot configure ...
      # already configured ... run config.sh remove first"), which aborts rehydration BEFORE Step 7
      # (the .env / DATABASE_URL attach) — so the project ends up with no Lakebase. Clear any
      # existing local config first so re-registration is idempotent; `--replace` then cleans up the
      # now-dangling same-name registration on the GitHub side.
      [ -f "$RUNNER_DIR/.runner" ] && ( cd "$RUNNER_DIR" && ./config.sh remove --local >/dev/null 2>&1 || true )
      ( cd "$RUNNER_DIR" && ./config.sh --url "https://github.com/$GH_OWNER/$NEW_NAME" \
          --token "$REG_TOKEN" --name "$RUNNER_NAME" --labels self-hosted --unattended --replace )
      # Java is needed by some actions; set JAVA_HOME on macOS if present.
      if [ "$RUNNER_OS" = osx ] && [ -z "${JAVA_HOME:-}" ] && /usr/libexec/java_home >/dev/null 2>&1; then
        export JAVA_HOME="$(/usr/libexec/java_home)"
      fi
      ( cd "$RUNNER_DIR" && nohup ./run.sh >/dev/null 2>&1 & echo $! > "$RUNNER_DIR/.pid" )
      log "waiting for runner to come online..."
      online=0
      for _ in $(seq 1 12); do
        sleep 3
        if gh api "repos/$GH_OWNER/$NEW_NAME/actions/runners" -q ".runners[] | select(.name==\"$RUNNER_NAME\") | .status" 2>/dev/null | grep -qx online; then online=1; break; fi
      done
      [ "$online" = 1 ] && ok "runner '$RUNNER_NAME' online" || warn "runner not yet online – check: gh api repos/$GH_OWNER/$NEW_NAME/actions/runners"
    fi
  fi
fi

# ---------------------------------------------------------------------------- Step 7: repoint config + regen .env
step "Step 7 – Repoint config + regenerate .env"
# 7a – .env host/profile/project (Gotcha 0: DATABRICKS_CONFIG_PROFILE overrides DATABRICKS_HOST).
# Seed .env from .env.example when absent (as the manual run did: `cp .env.example .env`)
# so the three pins – above all DATABRICKS_CONFIG_PROFILE – land BEFORE sync-env (7c).
# Skipping the pin until "after sync-env writes .env" never sets DATABRICKS_CONFIG_PROFILE
# (.env.example has no such line, and sync-env writes only connection metadata) -> Gotcha 0.
if [ ! -f .env ] && [ -f .env.example ]; then
  log "7a: no .env yet – seeding from .env.example (so the profile pin precedes sync-env)"
  run cp .env.example .env
fi
if [ -f .env ]; then
  grep -q '^DATABRICKS_HOST=' .env            && sed_inplace "s#^DATABRICKS_HOST=.*#DATABRICKS_HOST=$HOST#" .env           || run_sh "echo 'DATABRICKS_HOST=$HOST' >> .env"
  grep -q '^DATABRICKS_CONFIG_PROFILE=' .env  && sed_inplace "s#^DATABRICKS_CONFIG_PROFILE=.*#DATABRICKS_CONFIG_PROFILE=$PROFILE#" .env || run_sh "echo 'DATABRICKS_CONFIG_PROFILE=$PROFILE' >> .env"
  grep -q '^LAKEBASE_PROJECT_ID=' .env        && sed_inplace "s#^LAKEBASE_PROJECT_ID=.*#LAKEBASE_PROJECT_ID=$NEW_NAME#" .env || run_sh "echo 'LAKEBASE_PROJECT_ID=$NEW_NAME' >> .env"
  ok "7a: .env host/profile/project pinned"
else
  warn "7a: no .env and no .env.example – DATABRICKS_CONFIG_PROFILE will not be pinned (Gotcha 0 risk)"
fi

# 7b – load-bearing config files (edit only if present).
if [ -f deploy-targets.yaml ]; then
  sed_inplace "s#^( *lakebase_project:).*#\\1 $NEW_NAME#" deploy-targets.yaml
  sed_inplace "s#^( *app_name:).*#\\1 $NEW_NAME#" deploy-targets.yaml
  sed_inplace "s#(workspace_path:.*/)[^/]+\$#\\1$NEW_NAME#" deploy-targets.yaml
  # Pin the workspace profile too (the manual run set this from the `your-profile-name`
  # template placeholder); only when it's still the placeholder, so a real value is kept.
  sed_inplace "s#^( *workspace_profile:) *your-profile-name *\$#\\1 $PROFILE#" deploy-targets.yaml
  ok "7b: deploy-targets.yaml -> lakebase_project/app_name/workspace_path/workspace_profile"
fi
for wf in .lakebase/workflow-state.json .consort/workflow-state.json; do
  [ -f "$wf" ] || continue
  if [ "$DRY_RUN" = 1 ]; then log "[dry-run] set project_id=$NEW_NAME in $wf"; else
    python3 -I - "$wf" "$NEW_NAME" <<'PY'
import json,sys
f,name=sys.argv[1],sys.argv[2]
try: d=json.load(open(f))
except Exception: sys.exit(0)
if isinstance(d,dict) and "project_id" in d:
    d["project_id"]=name; json.dump(d,open(f,"w"),indent=2); print("  set project_id in",f)
PY
  fi
done
warn "7b: set lakebase_branch_uid in workflow-state.json to the NEW feature branch's uid"
warn "    (from the Step 3 list-branches output) if the kit doesn't reconcile it in 7c/verify."

# 7c – regenerate DATABASE_URL through the kit (mints a token against the new workspace).
log "7c: regenerating .env via kit sync-env for '$FEATURE_BRANCH'"
run ./scripts/lk lakebase-branch sync-env --instance "$NEW_NAME" --branch "$FEATURE_BRANCH" --host "$HOST"
# Gotcha 4: LAKEBASE_HOST is region-specific; re-read the real endpoint and set it.
if [ "$DRY_RUN" != 1 ] && [ -f .env ]; then
  EP="$(databricks api get "/api/2.0/postgres/projects/$NEW_NAME/branches/$FEATURE_BRANCH/endpoints" -p "$PROFILE" 2>/dev/null \
        | python3 -I -c 'import sys,json
try:
    d=json.load(sys.stdin); h=(d.get("status") or {}).get("hosts") or {}
    print(h.get("host","") if isinstance(h,dict) else "")
except Exception: print("")' || true)"
  if [ -n "$EP" ]; then
    grep -q '^LAKEBASE_HOST=' .env && sed_inplace "s#^LAKEBASE_HOST=.*#LAKEBASE_HOST=$EP#" .env || run_sh "echo 'LAKEBASE_HOST=$EP' >> .env"
    ok "7c: LAKEBASE_HOST set to region endpoint $EP"
  else
    warn "7c: could not auto-read the region endpoint; verify LAKEBASE_HOST manually (Gotcha 4)."
  fi
fi

# 7d – seed the SCM workflow state machine so the build lane can run. lakebase-create-project
# normally writes .lakebase/workflow-state.json; a rehydrated project lacks it, so /build
# refuses ("can't claim a paired git+Lakebase branch"). lakebase-scm-adopt-state constructs it
# from the current git branch + the Lakebase tier inventory. --force makes re-runs idempotent.
#
# It only recognizes a long-running TIER branch (main/staging) or a feature/<slug> branch – NOT
# a feature-<id> branch like feature-f2-stock-adjustment (else: "unrecognized-branch"). So seed
# from a tier branch, then return to the working branch; the build lane claims the feature
# branch afterwards.
# First commit the config edits (deploy-targets.yaml from 7b) so the tier hop below checks out
# over a CLEAN working tree. Carrying an uncommitted tracked edit across `git checkout` is
# fragile — it only succeeds while the file is identical across tiers; a divergence would make
# the checkout refuse ("local changes would be overwritten"). Commit first and that's a non-issue.
if [ "$DRY_RUN" != 1 ] && ! git diff --quiet; then
  git add -u
  git commit -q -m "chore: point project config at $NEW_NAME ($PROFILE)" && ok "committed config edits (clean tree for the tier hop)"
fi

log "7d: seeding SCM workflow state (lakebase-scm-adopt-state, from a tier branch)"
if [ "$DRY_RUN" = 1 ]; then
  log "[dry-run] (checkout tier) ./scripts/lk lakebase-scm-adopt-state --instance $NEW_NAME --force"
else
  SEED_TIER=staging; git show-ref --verify --quiet refs/heads/staging || SEED_TIER=main
  CUR_BRANCH="$(git branch --show-current)"
  git checkout -q "$SEED_TIER"
  ./scripts/lk lakebase-scm-adopt-state --instance "$NEW_NAME" --force \
    || warn "7d: scm-adopt-state failed; /build may refuse until SCM state is seeded"
  git checkout -q "$CUR_BRANCH"
fi

# 7e – claim the feature branch: advances workflow-state scaffold-complete -> feature-claimed,
# cuts the paired Lakebase branch, and syncs .env. Without this, /build refuses (feature_id is
# empty, so it would write onto the tier parent). The feature-id is the .consort/features/<id>
# that matches the current feature-<slug> branch (recovering the dir's exact casing, e.g.
# feature-f2-stock-adjustment -> F2-stock-adjustment).
case "$FEATURE_BRANCH" in
  feature-*|feature/*)
    FEATURE_ID="${FEATURE_BRANCH#feature-}"; FEATURE_ID="${FEATURE_ID#feature/}"
    for d in .consort/features/*/; do
      bn="$(basename "$d")"
      [ "$(printf '%s' "$bn" | tr '[:upper:]' '[:lower:]')" = "$(printf '%s' "$FEATURE_ID" | tr '[:upper:]' '[:lower:]')" ] && { FEATURE_ID="$bn"; break; }
    done
    log "7e: claiming feature '$FEATURE_ID' (lakebase-scm-claim-feature-branch)"
    run ./scripts/lk lakebase-scm-claim-feature-branch "$FEATURE_ID" \
      || warn "7e: claim failed; run ./scripts/lk lakebase-scm-claim-feature-branch <feature-id> before /build"
    ;;
  *) log "7e: branch '$FEATURE_BRANCH' is not a feature-* branch – skipping claim" ;;
esac

# 7f – commit any remaining tracked edits from the SCM steps (e.g. .lakebase/workflow-state.json
# advanced to feature-claimed by 7d/7e). deploy-targets.yaml was already committed before the
# tier hop. The build lane's experiment fork REFUSES to run over a dirty working tree, so land
# these before /build. `git add -u` stages only tracked modifications (never .env, gitignored).
if [ "$DRY_RUN" != 1 ] && ! git diff --quiet; then
  git add -u
  git commit -q -m "chore: record SCM feature-claimed state for $NEW_NAME" && ok "7f: committed SCM-state edits (clean tree for the build lane)"
fi

# 7g – provision CI auth secrets. lakebase-create-project sets these at create time, but a
# rehydrated project (Steps 5-6 detach+re-attach to a BRAND NEW repo) starts with an empty
# Actions secret store — so a promotion CI run later fails the whole feature on an empty
# DATABRICKS_TOKEN → no DATABASE_URL → the test step aborts (observed: secrets simply MISSING,
# not expired). Mint a fresh CI PAT and set DATABRICKS_HOST / LAKEBASE_PROJECT_ID /
# DATABRICKS_TOKEN now, then verify all three landed. The CLI resolves host + project-id from
# the .env pinned in Step 7 and the target repo from the origin set in Step 6 — no flags needed.
# Needs the GitHub repo, so skip under --no-github.
if [ "$NO_GITHUB" = 1 ]; then
  step "Step 7g – Provision CI auth secrets  [SKIPPED: --no-github]"
else
  step "Step 7g – Provision CI auth secrets for '$GH_OWNER/$NEW_NAME'"
  if [ "$DRY_RUN" = 1 ]; then
    log "[dry-run] ./scripts/lk lakebase-sync-ci-secrets"
  elif ./scripts/lk lakebase-sync-ci-secrets; then
    ok "7g: CI secrets (DATABRICKS_HOST / LAKEBASE_PROJECT_ID / DATABRICKS_TOKEN) set + verified"
  else
    warn "7g: CI secrets NOT fully provisioned — the next promotion CI run will fail on empty"
    warn "    DATABRICKS_TOKEN. Repair with: ./scripts/lk lakebase-sync-ci-secrets"
  fi
fi

# 7h – seed .consort/next.json so the dashboard + /consort:start preflight show the resumable
# state IMMEDIATELY on a fresh clone, before any drive run writes it. next.json is the drive's
# runtime stop-state (gitignored), so a rehydrated project never carries one; without it the
# /consort:start preflight resolves feature=null and dead-ends on a scope-less consort-next.
# Regenerate it from the READ-ONLY consort-next snapshot for the claimed feature (no model, no
# writes beyond this file). Leaves it gitignored/untracked — the next drive stop refreshes it.
if [ "$DRY_RUN" = 1 ]; then
  log "[dry-run] (if feature) ./scripts/lk consort-next --feature <F> --json > .consort/next.json"
elif [ -n "${FEATURE_ID:-}" ]; then
  step "Step 7h – Seed .consort/next.json (resumable state for the dashboard / start)"
  if ./scripts/lk consort-next --feature "$FEATURE_ID" --json > .consort/next.json 2>/dev/null \
       && [ -s .consort/next.json ]; then
    ok "7h: wrote .consort/next.json for $FEATURE_ID"
  else
    rm -f .consort/next.json
    warn "7h: could not generate next.json (non-fatal; /consort:start resolves the feature from .consort/features/)"
  fi
fi

# ---------------------------------------------------------------------------- Step 7i: pre-sync env
# Prepare the project so the FIRST build-lane turn runs clean: create the Python
# venv (so `alembic` resolves without a mid-turn `uv sync`) and install client
# deps. The build lane's migrate primitives already fall back to `uv run alembic`
# on a never-synced project, and run-tests.sh self-heals client deps — so this is
# belt-and-suspenders: it spares the driver's first migration + first client test
# the sync cost mid-turn, and lets a bare `alembic`/`vitest` run outside those
# wrappers still find its bin. Non-fatal throughout: a failure here never aborts
# rehydration (the wrappers sync on first use).
if [ "$DRY_RUN" = 1 ]; then
  log "[dry-run] (if pyproject) uv sync --extra dev ; (if client) npm ci --include=dev"
else
  step "Step 7i – Pre-sync project environment (venv + client deps)"
  if [ -f pyproject.toml ] && command -v uv >/dev/null 2>&1; then
    if uv sync --extra dev >/dev/null 2>&1; then
      ok "7i: python venv synced (.venv with dev extras)"
    else
      warn "7i: 'uv sync --extra dev' failed (non-fatal; 'uv run' / run-tests.sh sync on first use)"
    fi
  fi
  if [ -f client/package.json ]; then
    if [ -f scripts/scrub-npm-lock.sh ]; then
      # shellcheck source=/dev/null
      . scripts/scrub-npm-lock.sh 2>/dev/null || true
      if command -v scrub_npm_proxy_lock >/dev/null 2>&1; then
        scrub_npm_proxy_lock client/package-lock.json 2>/dev/null || true
      fi
    fi
    if ( cd client && if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev; fi ) >/dev/null 2>&1; then
      ok "7i: client deps installed"
    else
      warn "7i: client dep install failed (non-fatal; run-tests.sh installs them on first use)"
    fi
  fi
fi

# ---------------------------------------------------------------------------- Step 8: verify
step "Step 8 – Verify"
run_sh "git remote -v || true"
[ -f .env ] && run_sh "grep -E '^(DATABRICKS_HOST|DATABRICKS_CONFIG_PROFILE|LAKEBASE_PROJECT_ID|LAKEBASE_HOST|LAKEBASE_BRANCH_ID)' .env || true"
run_sh "./scripts/lk lakebase-doctor 2>/dev/null | grep -iE 'databricks-auth|config-profile|lakebase-project' || true"
run_sh "./scripts/lk lakebase-branch list --instance '$NEW_NAME' 2>/dev/null || true"
run_sh "./scripts/lk lakebase-scm-state 2>/dev/null || true"

# Leave the repo on the feature branch – that's where the build lane runs – no matter
# what branch was current when the script was launched.
if [ "$DRY_RUN" != 1 ] && [ "$(git branch --show-current)" != "$FEATURE_BRANCH" ]; then
  git checkout "$FEATURE_BRANCH"
fi
ok "on branch $(git branch --show-current 2>/dev/null || echo "$FEATURE_BRANCH")"

cat <<EOF

$C_GREEN Setup complete.$C_OFF  Project '$NEW_NAME' on $HOST. On branch $FEATURE_BRANCH, in $REPO_ROOT.

Checks (verify above):
  • lakebase-doctor: Authenticated to $HOST, CLI profile pinned: $PROFILE
  • lakebase-branch list: production / staging / $FEATURE_BRANCH all READY

${C_BLUE}Next:${C_OFF}
  claude
  then /consort:start           picks up at the build lane and prompts you to build F1
EOF

# The directory was renamed out from under your shell, so your shell's working dir is now
# stale (old name). A script can't change its parent shell's directory – so when we're on a
# terminal, re-exec a fresh login shell IN the new directory, which lands you there
# automatically (type 'exit' to return to your original shell). Otherwise, print the cd.
if [ "$DRY_RUN" != 1 ] && [ "$RENAMED" = 1 ]; then
  if [ -t 0 ] && [ -t 1 ]; then
    printf '\n%s•%s refreshing your shell in %s …\n' "$C_DIM" "$C_OFF" "$REPO_ROOT"
    cd "$REPO_ROOT"
    exec "$SHELL" -l
  else
    printf '\n%s!%s your shell is still in the old directory name – run: cd "%s"\n' "$C_YELLOW" "$C_OFF" "$REPO_ROOT" >&2
  fi
fi
