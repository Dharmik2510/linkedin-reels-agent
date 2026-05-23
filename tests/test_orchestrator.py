from contextlib import ExitStack
from unittest.mock import AsyncMock, patch
import pytest

from tests.fixtures import SAMPLE_BRIEF, SAMPLE_POSTS, SAMPLE_SCRIPT, SAMPLE_UNDERSTANDING


def _apply_orchestrator_patches(stack: ExitStack):
    stack.enter_context(patch("orchestrator.scraper.run", AsyncMock(return_value=SAMPLE_POSTS)))
    stack.enter_context(patch("orchestrator.intent.run", AsyncMock(return_value=SAMPLE_UNDERSTANDING)))
    stack.enter_context(patch("orchestrator.strategist.run", AsyncMock(return_value=SAMPLE_BRIEF)))
    stack.enter_context(patch("orchestrator.content.run", AsyncMock(return_value=SAMPLE_SCRIPT)))


async def test_run_emits_start_event():
    emitted: list[dict] = []

    async def capture(event: dict) -> None:
        emitted.append(event)

    with ExitStack() as stack:
        stack.enter_context(patch("orchestrator.push", capture))
        _apply_orchestrator_patches(stack)
        import orchestrator
        await orchestrator.run(3, run_id="test-run-1")

    types = [e["type"] for e in emitted]
    assert "orchestrator_start" in types


async def test_run_emits_complete_event_with_stats():
    emitted: list[dict] = []

    async def capture(event: dict) -> None:
        emitted.append(event)

    with ExitStack() as stack:
        stack.enter_context(patch("orchestrator.push", capture))
        _apply_orchestrator_patches(stack)
        import orchestrator
        await orchestrator.run(3, run_id="test-run-2")

    complete = next(e for e in emitted if e["type"] == "orchestrator_complete")
    assert complete["payload"]["posts_scraped"] == 3
    assert complete["payload"]["scripts_generated"] == 3
    assert complete["payload"]["errors"] == 0


async def test_run_counts_none_returns_as_errors():
    emitted: list[dict] = []

    async def capture(event: dict) -> None:
        emitted.append(event)

    with (
        patch("orchestrator.push", capture),
        patch("orchestrator.scraper.run", AsyncMock(return_value=SAMPLE_POSTS)),
        patch("orchestrator.intent.run", AsyncMock(return_value=SAMPLE_UNDERSTANDING)),
        patch("orchestrator.strategist.run", AsyncMock(return_value=SAMPLE_BRIEF)),
        patch("orchestrator.content.run", AsyncMock(return_value=None)),
    ):
        import orchestrator
        await orchestrator.run(3, run_id="test-run-3")

    complete = next(e for e in emitted if e["type"] == "orchestrator_complete")
    assert complete["payload"]["errors"] == 3
    assert complete["payload"]["scripts_generated"] == 0


async def test_run_continues_after_partial_failure():
    emitted: list[dict] = []
    call_count = 0

    async def capture(event: dict) -> None:
        emitted.append(event)

    async def sometimes_fail(post, index, **kwargs):
        nonlocal call_count
        call_count += 1
        return None if index == 1 else SAMPLE_SCRIPT

    with (
        patch("orchestrator.push", capture),
        patch("orchestrator.scraper.run", AsyncMock(return_value=SAMPLE_POSTS)),
        patch("orchestrator.intent.run", AsyncMock(return_value=SAMPLE_UNDERSTANDING)),
        patch("orchestrator.strategist.run", AsyncMock(return_value=SAMPLE_BRIEF)),
        patch("orchestrator.content.run", sometimes_fail),
    ):
        import orchestrator
        await orchestrator.run(3, run_id="test-run-4")

    assert call_count == 3
    complete = next(e for e in emitted if e["type"] == "orchestrator_complete")
    assert complete["payload"]["scripts_generated"] == 2
    assert complete["payload"]["errors"] == 1


async def test_run_emits_error_event_when_scraper_fails():
    emitted: list[dict] = []

    async def capture(event: dict) -> None:
        emitted.append(event)

    async def fail(*_):
        raise RuntimeError("LinkedIn login failed")

    with (
        patch("orchestrator.push", capture),
        patch("orchestrator.scraper.run", fail),
    ):
        import orchestrator
        await orchestrator.run(3, run_id="test-run-5")

    types = [e["type"] for e in emitted]
    assert "orchestrator_start" in types
    assert "error" in types
    assert "orchestrator_complete" not in types


async def test_run_counts_raised_exceptions_as_errors():
    emitted: list[dict] = []

    async def capture(event: dict) -> None:
        emitted.append(event)

    with (
        patch("orchestrator.push", capture),
        patch("orchestrator.scraper.run", AsyncMock(return_value=SAMPLE_POSTS)),
        patch("orchestrator.intent.run", AsyncMock(return_value=SAMPLE_UNDERSTANDING)),
        patch("orchestrator.strategist.run", AsyncMock(return_value=SAMPLE_BRIEF)),
        patch("orchestrator.content.run", AsyncMock(side_effect=RuntimeError("unexpected"))),
    ):
        import orchestrator
        await orchestrator.run(3, run_id="test-run-6")

    complete = next(e for e in emitted if e["type"] == "orchestrator_complete")
    assert complete["payload"]["errors"] == 3
    assert complete["payload"]["scripts_generated"] == 0


@pytest.mark.asyncio
async def test_run_emits_stage_changed_events(monkeypatch):
    from agents import content, scraper
    import orchestrator
    import events as events_mod
    from tests.fixtures import SAMPLE_POST

    async def fake_scrape(n):
        return [SAMPLE_POST for _ in range(n)]

    async def fake_intent(post, idx, **kwargs):
        return SAMPLE_UNDERSTANDING

    async def fake_strategist(post, u, idx, **kwargs):
        return SAMPLE_BRIEF

    async def fake_content(post, idx, **kwargs):
        return None

    monkeypatch.setattr(scraper, "run", fake_scrape)
    monkeypatch.setattr(orchestrator.intent, "run", fake_intent)
    monkeypatch.setattr(orchestrator.strategist, "run", fake_strategist)
    monkeypatch.setattr(content, "run", fake_content)

    seen_stages: list[str] = []
    async with events_mod.hub.subscribe() as q:
        await orchestrator.run(2, tone="Punchy", run_id="test-run-7")
        while not q.empty():
            ev = q.get_nowait()
            if ev.get("type") == "stage_changed":
                seen_stages.append(ev["payload"]["stage"])

    assert seen_stages == ["scraping", "analyzing", "generating", "done"]
