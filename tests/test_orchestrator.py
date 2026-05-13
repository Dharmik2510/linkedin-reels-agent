import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import pytest

from models import Post, ReelsScript

SAMPLE_POSTS = [
    Post(
        author=f"Author {i}",
        text_content=f"Content {i}",
        post_url=f"https://linkedin.com/posts/{i}",
        scraped_at=datetime.now(timezone.utc),
    )
    for i in range(3)
]

SAMPLE_SCRIPT = ReelsScript(
    hook="Test hook here now",
    script="Test spoken script content",
    caption="Test caption #test",
    hashtags=["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    cta="Follow me right now",
)


async def test_run_emits_start_event():
    emitted: list[dict] = []

    async def capture(event: dict) -> None:
        emitted.append(event)

    with (
        patch("orchestrator.push", capture),
        patch("orchestrator.scraper.run", AsyncMock(return_value=SAMPLE_POSTS)),
        patch("orchestrator.content.run", AsyncMock(return_value=SAMPLE_SCRIPT)),
    ):
        import orchestrator
        await orchestrator.run(3)

    types = [e["type"] for e in emitted]
    assert "orchestrator_start" in types


async def test_run_emits_complete_event_with_stats():
    emitted: list[dict] = []

    async def capture(event: dict) -> None:
        emitted.append(event)

    with (
        patch("orchestrator.push", capture),
        patch("orchestrator.scraper.run", AsyncMock(return_value=SAMPLE_POSTS)),
        patch("orchestrator.content.run", AsyncMock(return_value=SAMPLE_SCRIPT)),
    ):
        import orchestrator
        await orchestrator.run(3)

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
        patch("orchestrator.content.run", AsyncMock(return_value=None)),
    ):
        import orchestrator
        await orchestrator.run(3)

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
        patch("orchestrator.content.run", sometimes_fail),
    ):
        import orchestrator
        await orchestrator.run(3)

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
        await orchestrator.run(3)  # must not raise

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
        patch("orchestrator.content.run", AsyncMock(side_effect=RuntimeError("unexpected"))),
    ):
        import orchestrator
        await orchestrator.run(3)

    complete = next(e for e in emitted if e["type"] == "orchestrator_complete")
    assert complete["payload"]["errors"] == 3
    assert complete["payload"]["scripts_generated"] == 0


@pytest.mark.asyncio
async def test_run_emits_stage_changed_events(monkeypatch):
    from datetime import datetime, timezone  # noqa: F401
    from agents import content, scraper
    import orchestrator, events as events_mod

    fake_post = type("P", (), {
        "model_dump": lambda self, **k: {"author": "A", "text_content": "x", "post_url": "", "scraped_at": "t"},
        "text_content": "x",
        "author": "A",
    })()

    async def fake_scrape(n):
        return [fake_post for _ in range(n)]

    async def fake_content(post, idx, tone="Punchy"):
        return None

    monkeypatch.setattr(scraper, "run", fake_scrape)
    monkeypatch.setattr(content, "run", fake_content)

    seen_stages: list[str] = []
    async with events_mod.hub.subscribe() as q:
        await orchestrator.run(2, tone="Punchy")
        # Drain any events emitted during the run
        while not q.empty():
            ev = q.get_nowait()
            if ev.get("type") == "stage_changed":
                seen_stages.append(ev["payload"]["stage"])

    assert seen_stages == ["scraping", "generating", "done"]
