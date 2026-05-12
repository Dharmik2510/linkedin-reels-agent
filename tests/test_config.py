import pytest


def test_get_required_raises_when_missing(monkeypatch):
    monkeypatch.delenv("_TEST_MISSING_VAR", raising=False)
    from config import _get_required
    with pytest.raises(ValueError, match="_TEST_MISSING_VAR"):
        _get_required("_TEST_MISSING_VAR")


def test_get_required_returns_value(monkeypatch):
    monkeypatch.setenv("_TEST_PRESENT_VAR", "hello")
    from config import _get_required
    assert _get_required("_TEST_PRESENT_VAR") == "hello"


def test_get_required_raises_on_empty_string(monkeypatch):
    monkeypatch.setenv("_TEST_EMPTY_VAR", "")
    from config import _get_required
    with pytest.raises(ValueError, match="_TEST_EMPTY_VAR"):
        _get_required("_TEST_EMPTY_VAR")
