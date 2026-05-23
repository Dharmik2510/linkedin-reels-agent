"""Async-local context for the active pipeline run."""

from contextvars import ContextVar

from budgets import RunBudget

_run_id: ContextVar[str | None] = ContextVar("run_id", default=None)
_budget: ContextVar[RunBudget | None] = ContextVar("budget", default=None)


def set_run(run_id: str, budget: RunBudget) -> None:
    _run_id.set(run_id)
    _budget.set(budget)


def clear_run() -> None:
    _run_id.set(None)
    _budget.set(None)


def get_run_id() -> str | None:
    return _run_id.get()


def get_budget() -> RunBudget | None:
    return _budget.get()
