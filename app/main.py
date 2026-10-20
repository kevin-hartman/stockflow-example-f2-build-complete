"""FastAPI application entry point."""

import os

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routes import locations, skus, stock
from app.routes.errors import validation_error_handler

app = FastAPI(title="stockflow-example", version="0.1.0")
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.include_router(stock.router)
app.include_router(locations.router)
app.include_router(skus.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Consort dashboard table-snapshot (dev/test/CI only) ─────────────────────
# A READ-ONLY peek at the current rows of each public table, for the Consort
# dashboard's per-test table view. E2E (Playwright) specs mutate the DB THROUGH
# the app, so the app is the one process already connected to the branch — the
# E2E reporter calls this after each spec to record the DB state that spec left.
# Guarded by the PRESENCE of a `.consort/` dir at the project root: present in a
# dev/test/CI checkout but NOT in a packaged production app, so the route is
# simply absent in a real deploy — no env flag, no per-server wiring. Read-only,
# row-capped, identifier-validated.
_PROJECT_ROOT = os.path.join(os.path.dirname(__file__), os.pardir)
if os.path.isdir(os.path.join(_PROJECT_ROOT, ".consort")):
    import re as _re

    from sqlalchemy import text as _sql_text

    from app.database import engine as _snap_engine

    _SNAP_IDENT = _re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
    _SNAP_CAP = 50

    @app.get("/api/_consort/table-snapshot")
    def _consort_table_snapshot():
        """Current rows of every public app table (except alembic_version), capped. Read-only."""
        out: dict[str, dict] = {}
        with _snap_engine.connect() as conn:
            names = [
                r[0]
                for r in conn.execute(
                    _sql_text(
                        "select tablename from pg_tables where schemaname='public' "
                        "and tablename <> 'alembic_version' order by 1"
                    )
                )
            ]
            for name in names:
                if not _SNAP_IDENT.fullmatch(name):
                    continue
                rows = conn.execute(_sql_text(f'SELECT * FROM "{name}" ORDER BY 1 DESC LIMIT {_SNAP_CAP}')).mappings().all()
                total = conn.execute(_sql_text(f'SELECT count(*) FROM "{name}"')).scalar()
                out[name] = {"rows": [dict(r) for r in rows], "row_count": total}
        return out

    # Per-test RETRIEVED/STORED row capture: records the rows each test's `/api` requests read/wrote
    # (keyed by the X-Consort-Test-Id header) to `.consort/test-interactions.jsonl`, for the
    # dashboard's per-test table view. Middleware + SQLAlchemy ORM `load`/DML events; same dev/test/CI
    # guard as the snapshot route above. See app/consort_capture.py.
    from app import consort_capture as _consort_capture
    from app.database import Base as _consort_base

    _consort_capture.install(app, _snap_engine, _consort_base)


# ── Register API routes ABOVE this line ─────────────────────────────────────
# Everything below serves the built React SPA (client/dist) in production, so a
# single-process deploy (e.g. a Databricks App) serves both the API and the UI.
# It is a no-op in development (Vite serves the client and proxies /api +
# /health here, so client/dist does not exist) and a no-op for a server-rendered
# or API-only backend that has no client/. The catch-all matches every remaining
# GET path (client-side routing needs index.html on deep-link refresh), so it
# MUST stay last: register API routers above it.
_CLIENT_DIST = os.path.join(os.path.dirname(__file__), os.pardir, "client", "dist")
if os.path.isdir(_CLIENT_DIST):
    _assets = os.path.join(_CLIENT_DIST, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # Unmatched API paths 404 as JSON instead of returning the app shell.
        if full_path.startswith("api/") or full_path == "health":
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(os.path.join(_CLIENT_DIST, "index.html"))
