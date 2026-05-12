from datetime import datetime, timezone
import pytest
from pydantic import ValidationError


def test_post_valid():
    from models import Post
    post = Post(
        author="Jane Doe",
        text_content="Hello LinkedIn",
        post_url="https://linkedin.com/posts/123",
        scraped_at=datetime.now(timezone.utc),
    )
    assert post.author == "Jane Doe"
    assert post.text_content == "Hello LinkedIn"


def test_post_missing_field_raises():
    from models import Post
    with pytest.raises(ValidationError):
        Post(author="Jane", post_url="url", scraped_at=datetime.now(timezone.utc))


def test_reels_script_valid():
    from models import ReelsScript
    script = ReelsScript(
        hook="Stop scrolling — this changes everything",
        script="Here is what I learned...",
        caption="My journey with AI #tech",
        hashtags=["tech", "ai", "startup", "growth", "python",
                  "coding", "ml", "data", "career", "linkedin"],
        cta="Follow for more insights",
    )
    assert len(script.hashtags) == 10
    assert script.hook == "Stop scrolling — this changes everything"


def test_agent_event_payload_defaults_to_empty_dict():
    from models import AgentEvent
    event = AgentEvent(
        type="test",
        agent="scraper",
        message="testing",
        timestamp=datetime.now(timezone.utc),
    )
    assert event.payload == {}


def test_agent_event_with_payload():
    from models import AgentEvent
    event = AgentEvent(
        type="post_scraped",
        agent="scraper",
        message="scraped post 1",
        payload={"index": 0, "total": 5},
        timestamp=datetime.now(timezone.utc),
    )
    assert event.payload["index"] == 0
