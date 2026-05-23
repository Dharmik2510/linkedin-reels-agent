from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import pytest

from models import Post, ReelsScript
import run_cache

from tests.fixtures import SAMPLE_BRIEF, SAMPLE_SCRIPT, SAMPLE_UNDERSTANDING

SAMPLE_POST = Post(
    author="Author",
    text_content="LinkedIn wisdom",
    post_url="https://linkedin.com/posts/1",
    scraped_at=datetime.now(timezone.utc),
)

SAMPLE_SCRIPT_FULL = ReelsScript(
    hook="Hook line",
    script="Spoken script",
    caption="Caption",
    hashtags=["a"] * 10,
    cta="Follow now",
    language="en",
)


@pytest.fixture(autouse=True)
def _cache_post():
    run_cache.set_run([SAMPLE_POST], "Punchy", "en")
    run_cache.set_understanding(0, SAMPLE_UNDERSTANDING)
    run_cache.set_brief(0, SAMPLE_BRIEF)
    yield
    run_cache.clear()


async def test_regenerate_calls_writer_with_regenerate_flag():
    with (
        patch("orchestrator.intent.run", AsyncMock(return_value=SAMPLE_UNDERSTANDING)),
        patch("orchestrator.strategist.run", AsyncMock(return_value=SAMPLE_BRIEF)),
        patch(
            "orchestrator.content.run",
            AsyncMock(return_value=SAMPLE_SCRIPT_FULL),
        ) as mock_content,
    ):
        import orchestrator
        ok = await orchestrator.regenerate(0, tone="Educational")

    assert ok is True
    mock_content.assert_awaited_once()
    assert mock_content.call_args.kwargs.get("regenerate") is True


async def test_regenerate_returns_false_for_missing_index():
    import orchestrator
    ok = await orchestrator.regenerate(99)
    assert ok is False
