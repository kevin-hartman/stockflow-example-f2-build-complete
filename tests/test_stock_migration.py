"""S1 PI7: stock_records migration round-trip (schema recreation only; isolated branch)."""

from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.database import engine

INI = str(Path(__file__).resolve().parents[1] / "alembic.ini")


def _create_migration_down_revision(cfg):
    for script in ScriptDirectory.from_config(cfg).walk_revisions():
        if "stock_records" in Path(script.path).read_text() and "create_table" in Path(script.path).read_text():
            return script.down_revision or "base"
    pytest.fail("no migration creates stock_records")


@pytest.mark.migration
@pytest.mark.testid("T7")
def test_stock_records_migration_downgrade_upgrade_round_trip():
    cfg = Config(INI)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, _create_migration_down_revision(cfg))
    assert "stock_records" not in sa.inspect(engine).get_table_names()
    command.upgrade(cfg, "head")
    insp = sa.inspect(engine)
    cols = {c["name"]: c for c in insp.get_columns("stock_records")}
    assert {"sku", "location", "quantity", "tracking_code"} <= set(cols)
    assert not cols["sku"]["nullable"] and not cols["location"]["nullable"] and not cols["quantity"]["nullable"]
    assert cols["tracking_code"]["nullable"]
    uniques = [set(u["column_names"]) for u in insp.get_unique_constraints("stock_records")]
    assert {"sku", "location"} in uniques
    checks = " ".join(c["sqltext"] for c in insp.get_check_constraints("stock_records"))
    assert "quantity" in checks and ">= 0" in checks
