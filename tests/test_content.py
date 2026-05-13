from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from models import Post, ReelsScript

SAMPLE_POST = Post(
    author="Jane Doe",
    text_content="AI is transforming how we work and learn every single day.",
    post_url="https://linkedin.com/posts/123",
    scraped_at=datetime.now(timezone.utc),
)

SAMPLE_JSON = (
    '{"hook": "AI changed everything I knew", '
    '"script": "Here is what I discovered about AI...", '
    '"caption": "The future of work is here #AI", '
    '"hashtags": ["ai", "tech", "future", "work", "ml", '
    '"data", "innovation", "career", "growth", "learning"], '
    '"cta": "Follow for daily AI insights"}'
)


def test_parse_script_plain_json():
    from agents.content import _parse_script
    result = _parse_script(SAMPLE_JSON)
    assert result.hook == "AI changed everything I knew"
    assert len(result.hashtags) == 10


def test_parse_script_strips_backtick_fences():
    from agents.content import _parse_script
    fenced = f"```json\n{SAMPLE_JSON}\n```"
    result = _parse_script(fenced)
    assert result.cta == "Follow for daily AI insights"


def test_parse_script_strips_plain_fences():
    from agents.content import _parse_script
    fenced = f"```\n{SAMPLE_JSON}\n```"
    result = _parse_script(fenced)
    assert result.hook == "AI changed everything I knew"


async def test_run_returns_reels_script():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=SAMPLE_JSON)]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("agents.content.get_client", return_value=mock_client):
        from agents import content
        result = await content.run(SAMPLE_POST, 0)

    assert isinstance(result, ReelsScript)
    assert result.hook == "AI changed everything I knew"
    call_args = mock_client.messages.create.call_args
    assert call_args.kwargs["model"] == "claude-sonnet-4-6"
    assert call_args.kwargs["max_tokens"] == 1024
    system = call_args.kwargs["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}


async def test_run_handles_fenced_json_from_api():
    fenced = f"```json\n{SAMPLE_JSON}\n```"
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=fenced)]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("agents.content.get_client", return_value=mock_client):
        from agents import content
        result = await content.run(SAMPLE_POST, 0)

    assert result is not None
    assert result.cta == "Follow for daily AI insights"


async def test_run_returns_none_on_api_error():
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(side_effect=Exception("rate limited"))

    with patch("agents.content.get_client", return_value=mock_client):
        from agents import content
        result = await content.run(SAMPLE_POST, 0)

    assert result is None


async def test_run_emits_generating_event():
    from events import event_bus
    while not event_bus.empty():
        event_bus.get_nowait()

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=SAMPLE_JSON)]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("agents.content.get_client", return_value=mock_client):
        from agents import content
        await content.run(SAMPLE_POST, 2)

    events = []
    while not event_bus.empty():
        events.append(event_bus.get_nowait())

    types = [e["type"] for e in events]
    assert "content_generating" in types
    assert "content_ready" in types


async def test_run_emits_error_event_on_failure():
    from events import event_bus
    while not event_bus.empty():
        event_bus.get_nowait()

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(side_effect=Exception("boom"))

    with patch("agents.content.get_client", return_value=mock_client):
        from agents import content
        await content.run(SAMPLE_POST, 0)

    events = []
    while not event_bus.empty():
        events.append(event_bus.get_nowait())

    assert any(e["type"] == "content_error" for e in events)
    error_event = next(e for e in events if e["type"] == "content_error")
    assert "boom" in error_event["message"]
    assert error_event["payload"]["post_index"] == 0


async def test_run_passes_tone_into_system_prompt():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=SAMPLE_JSON)]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("agents.content.get_client", return_value=mock_client):
        from agents import content
        await content.run(SAMPLE_POST, 0, tone="Story-led")

    call_args = mock_client.messages.create.call_args
    sys_block = call_args.kwargs["system"][0]["text"]
    assert "story-led" in sys_block.lower()


def test_build_system_prompt_unknown_tone_falls_back_to_punchy():
    from agents.content import build_system_prompt, TONE_GUIDE
    prompt = build_system_prompt("Whimsical")  # type: ignore[arg-type]
    assert "Whimsical" not in prompt
    assert "'Punchy' tone" in prompt
    assert TONE_GUIDE["Punchy"] in prompt
