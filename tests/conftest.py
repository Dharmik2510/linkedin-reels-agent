import pytest

from db import store


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("REELIFY_DB_PATH", str(tmp_path / "reelify_test.db"))
    store.init_db()
