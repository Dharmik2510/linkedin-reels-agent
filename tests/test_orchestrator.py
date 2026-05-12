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

    async def sometimes_fail(post, index):
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
