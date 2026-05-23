from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
import pytest

from models import Post, ReelsScript
import run_cache


SAMPLE_POST = Post(
    author="Author",
    text_content="LinkedIn wisdom",
    post_url="https://linkedin.com/posts/1",
    scraped_at=datetime.now(timezone.utc),
)

SAMPLE_SCRIPT = ReelsScript(
    hook="Hook line",
    script="Spoken script",
    caption="Caption",
    hashtags=["a"] * 10,
    cta="Follow now",
)


@pytest.fixture(autouse=True)
def _cache_post():
    run_cache.set_run([SAMPLE_POST], "Punchy")
    yield
    run_cache.clear()


async def test_regenerate_calls_content_with_flag():
    with patch(
        "orchestrator.content.run",
        AsyncMock(return_value=SAMPLE_SCRIPT),
    ) as mock_content:
        import orchestrator
        ok = await orchestrator.regenerate(0, tone="Educational")

    assert ok is True
    mock_content.assert_awaited_once_with(
        SAMPLE_POST,
        0,
        tone="Educational",
        regenerate=True,
    )


async def test_regenerate_returns_false_for_missing_index():
    import orchestrator
    ok = await orchestrator.regenerate(99)
    assert ok is False
