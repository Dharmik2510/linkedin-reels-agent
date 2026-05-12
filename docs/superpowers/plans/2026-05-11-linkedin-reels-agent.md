# LinkedIn Reels Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an agentic pipeline that scrapes LinkedIn saved posts, transforms each into an Instagram Reels script via Claude, and streams all activity to a real-time local web dashboard.

**Architecture:** Single-process asyncio app — FastAPI, Playwright, and the Anthropic SDK share one event loop owned by `asyncio.run()`. A global `asyncio.Queue` event bus connects agents to the SSE stream. The orchestrator chains scraper → content agents with `Semaphore(3)` concurrency.

**Tech Stack:** Python 3.11+, `anthropic` SDK (`claude-sonnet-4-6`), `playwright` (async), `fastapi`, `uvicorn`, `sse-starlette`, `pydantic` v2, `python-dotenv`, `pytest`, `pytest-asyncio`

---

## File Map

| File | Responsibility |
|---|---|
| `requirements.txt` | All package dependencies |
| `pytest.ini` | pytest + asyncio_mode=auto |
| `.env.example` | Credential template |
| `README.md` | Setup + usage instructions |
| `models.py` | Pydantic v2: `Post`, `ReelsScript`, `AgentEvent` |
| `config.py` | `.env` loading + startup validation via `_get_required()` |
| `events.py` | `event_bus: asyncio.Queue` singleton + `push(dict)` helper |
| `agents/__init__.py` | Empty package marker |
| `agents/scraper.py` | `ScrapeAgent`: Playwright-based LinkedIn scraper |
| `agents/content.py` | `ContentAgent`: Claude API script generator with prompt caching |
| `orchestrator.py` | Pipeline: scraper → content agents, emits start/complete events |
| `main.py` | FastAPI app, routes (`/`, `/stream`, `/run`), uvicorn startup |
| `dashboard/index.html` | Single-file real-time dashboard (vanilla JS, dark theme) |
| `tests/__init__.py` | Empty test package marker |
| `tests/test_models.py` | Pydantic model validation tests |
| `tests/test_config.py` | Config `_get_required` unit tests |
| `tests/test_events.py` | Event bus push/drain tests |
| `tests/test_content.py` | ContentAgent tests (Anthropic client mocked) |
| `tests/test_scraper.py` | ScrapeAgent logic tests (Playwright mocked) |
| `tests/test_orchestrator.py` | Orchestrator flow tests (agents mocked) |
| `tests/test_main.py` | FastAPI route tests |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `linkedin_reels_agent/requirements.txt`
- Create: `linkedin_reels_agent/pytest.ini`
- Create: `linkedin_reels_agent/.env.example`
- Create: `linkedin_reels_agent/README.md`
- Create: `linkedin_reels_agent/agents/__init__.py`
- Create: `linkedin_reels_agent/tests/__init__.py`
- Create: `linkedin_reels_agent/dashboard/` (directory)

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/dharmiksoni/Documents/linkedin_reels_agent
mkdir -p agents dashboard tests
touch agents/__init__.py tests/__init__.py
```

- [ ] **Step 2: Write `requirements.txt`**

```
anthropic>=0.40.0
playwright>=1.45.0
fastapi>=0.115.0
uvicorn>=0.30.0
python-dotenv>=1.0.0
sse-starlette>=2.1.0
pydantic>=2.0.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
```

- [ ] **Step 3: Write `pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 4: Write `.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-...
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=yourpassword
```

- [ ] **Step 5: Write `README.md`**

```markdown
# LinkedIn → Instagram Reels Agent

Scrapes your LinkedIn saved posts and transforms them into Instagram Reels scripts using Claude.

## Setup

```bash
pip install -r requirements.txt
playwright install chromium
cp .env.example .env  # fill in your credentials
python main.py        # opens dashboard at http://localhost:8000
```

## Usage

1. Open http://localhost:8000 in your browser
2. Enter the number of saved posts to process
3. Click **Run** — watch activity stream in real time
4. Find your Reels scripts in the "Reels Scripts" tab

## Notes
- LinkedIn is scraped in headed mode (browser window opens) to avoid bot detection
- Scraping is for personal use only on your own account
- Scripts are generated with Claude Sonnet via the Anthropic API
```

- [ ] **Step 6: Install dependencies**

```bash
pip install -r requirements.txt
playwright install chromium
```

Expected: no errors. `playwright install chromium` downloads ~200MB.

- [ ] **Step 7: Commit**

```bash
git init
git add requirements.txt pytest.ini .env.example README.md agents/__init__.py tests/__init__.py
git commit -m "chore: project scaffolding"
```

---

## Task 2: Data Models

**Files:**
- Create: `models.py`
- Create: `tests/test_models.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_models.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_models.py -v
```

Expected: `ModuleNotFoundError: No module named 'models'`

- [ ] **Step 3: Write `models.py`**

```python
from datetime import datetime
from pydantic import BaseModel


class Post(BaseModel):
    author: str
    text_content: str
    post_url: str
    scraped_at: datetime


class ReelsScript(BaseModel):
    hook: str
    script: str
    caption: str
    hashtags: list[str]
    cta: str


class AgentEvent(BaseModel):
    type: str
    agent: str
    message: str
    payload: dict = {}
    timestamp: datetime
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_models.py -v
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add models.py tests/test_models.py
git commit -m "feat: add Pydantic data models"
```

---

## Task 3: Config

**Files:**
- Create: `config.py`
- Create: `tests/test_config.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_config.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_config.py -v
```

Expected: `ModuleNotFoundError: No module named 'config'`

- [ ] **Step 3: Write `config.py`**

```python
import os
from dotenv import load_dotenv

load_dotenv()


def _get_required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise ValueError(f"Missing required environment variable: {key}")
    return val


ANTHROPIC_API_KEY: str = _get_required("ANTHROPIC_API_KEY")
LINKEDIN_EMAIL: str = _get_required("LINKEDIN_EMAIL")
LINKEDIN_PASSWORD: str = _get_required("LINKEDIN_PASSWORD")
```

- [ ] **Step 4: Create `.env` with test values so import succeeds**

```bash
cp .env.example .env
```

Then edit `.env` to fill in real values. The module-level calls to `_get_required` run at import time, so a `.env` file with real (or placeholder) values must exist.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pytest tests/test_config.py -v
```

Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add config.py tests/test_config.py
git commit -m "feat: add config loader with startup validation"
```

---

## Task 4: Event Bus

**Files:**
- Create: `events.py`
- Create: `tests/test_events.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_events.py`:

```python
import asyncio
import pytest


@pytest.fixture(autouse=True)
def clear_bus():
    from events import event_bus
    while not event_bus.empty():
        event_bus.get_nowait()
    yield
    while not event_bus.empty():
        event_bus.get_nowait()


async def test_push_adds_event_to_queue():
    from events import event_bus, push
    event = {"type": "test", "message": "hello"}
    await push(event)
    assert not event_bus.empty()
    item = event_bus.get_nowait()
    assert item == event


async def test_push_multiple_events_preserves_order():
    from events import event_bus, push
    for i in range(3):
        await push({"type": "test", "index": i})
    assert event_bus.qsize() == 3
    for i in range(3):
        item = event_bus.get_nowait()
        assert item["index"] == i


async def test_push_accepts_arbitrary_dict():
    from events import push, event_bus
    payload = {"type": "x", "nested": {"a": 1}, "list": [1, 2, 3]}
    await push(payload)
    assert event_bus.get_nowait() == payload
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_events.py -v
```

Expected: `ModuleNotFoundError: No module named 'events'`

- [ ] **Step 3: Write `events.py`**

```python
import asyncio

event_bus: asyncio.Queue = asyncio.Queue()


async def push(event: dict) -> None:
    await event_bus.put(event)
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_events.py -v
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add events.py tests/test_events.py
git commit -m "feat: add asyncio event bus"
```

---

## Task 5: Content Agent

**Files:**
- Create: `agents/content.py`
- Create: `tests/test_content.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_content.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_content.py -v
```

Expected: `ModuleNotFoundError: No module named 'agents.content'`

- [ ] **Step 3: Write `agents/content.py`**

```python
import json
from datetime import datetime, timezone

import anthropic

import config
from events import push
from models import Post, ReelsScript

SYSTEM_PROMPT = (
    "You are an expert Instagram Reels scriptwriter. Transform the LinkedIn post content "
    "into a punchy, engaging Instagram Reels script. Output valid JSON with these fields:\n"
    "- hook: string (first 3 seconds, attention-grabbing opener, max 15 words)\n"
    "- script: string (30-60 second spoken script, conversational tone, broken into lines)\n"
    "- caption: string (Instagram caption with relevant hashtags, max 150 chars)\n"
    "- hashtags: array of 10 strings (no # prefix)\n"
    "- cta: string (call to action, max 10 words)\n"
    "Output ONLY the JSON object. No markdown, no explanation."
)

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


def _parse_script(raw: str) -> ReelsScript:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop opening fence line and closing fence line
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner)
    return ReelsScript(**json.loads(text))


async def run(post: Post, post_index: int) -> ReelsScript | None:
    now = datetime.now(timezone.utc).isoformat()
    await push({
        "type": "content_generating",
        "agent": "content",
        "message": f"Generating Reels script for post {post_index + 1}",
        "payload": {"post_index": post_index},
        "timestamp": now,
    })
    try:
        client = get_client()
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[{
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": post.text_content}],
        )
        script = _parse_script(response.content[0].text)
        await push({
            "type": "content_ready",
            "agent": "content",
            "message": f"Script ready for post {post_index + 1}",
            "payload": {"post_index": post_index, "script": script.model_dump()},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return script
    except Exception as exc:
        await push({
            "type": "content_error",
            "agent": "content",
            "message": f"Failed to generate script for post {post_index + 1}: {exc}",
            "payload": {"post_index": post_index},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return None
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_content.py -v
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add agents/content.py tests/test_content.py
git commit -m "feat: add Claude content agent with prompt caching"
```

---

## Task 6: Scraper Agent

**Files:**
- Create: `agents/scraper.py`
- Create: `tests/test_scraper.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_scraper.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


async def test_login_raises_on_checkpoint_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login failed"):
        await _login(mock_page)


async def test_login_raises_on_login_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/login?fromSignIn=true"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login failed"):
        await _login(mock_page)


async def test_login_succeeds_on_feed_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    await _login(mock_page)  # should not raise


async def test_extract_post_returns_post():
    from datetime import datetime, timezone
    mock_author_el = AsyncMock()
    mock_author_el.inner_text = AsyncMock(return_value="  Jane Doe  ")

    mock_text_el = AsyncMock()
    mock_text_el.inner_text = AsyncMock(return_value="  Some post content  ")

    mock_link_el = AsyncMock()
    mock_link_el.get_attribute = AsyncMock(return_value="https://linkedin.com/posts/abc")

    mock_element = AsyncMock()
    mock_element.query_selector = AsyncMock(side_effect=lambda sel: {
        ".entity-result__title-text": mock_author_el,
        ".entity-result__summary": mock_text_el,
        "a.app-aware-link": mock_link_el,
    }.get(sel))

    mock_page = AsyncMock()

    from agents.scraper import _extract_post
    post = await _extract_post(mock_page, mock_element)

    assert post is not None
    assert post.author == "Jane Doe"
    assert post.text_content == "Some post content"
    assert post.post_url == "https://linkedin.com/posts/abc"


async def test_extract_post_prepends_domain_for_relative_url():
    mock_author_el = AsyncMock()
    mock_author_el.inner_text = AsyncMock(return_value="Jane Doe")

    mock_text_el = AsyncMock()
    mock_text_el.inner_text = AsyncMock(return_value="content")

    mock_link_el = AsyncMock()
    mock_link_el.get_attribute = AsyncMock(return_value="/posts/abc123")

    mock_element = AsyncMock()
    mock_element.query_selector = AsyncMock(side_effect=lambda sel: {
        ".entity-result__title-text": mock_author_el,
        ".entity-result__summary": mock_text_el,
        "a.app-aware-link": mock_link_el,
    }.get(sel))

    from agents.scraper import _extract_post
    post = await _extract_post(AsyncMock(), mock_element)

    assert post.post_url == "https://www.linkedin.com/posts/abc123"


async def test_extract_post_returns_none_on_exception():
    mock_element = AsyncMock()
    mock_element.query_selector = AsyncMock(side_effect=Exception("DOM error"))

    from agents.scraper import _extract_post
    result = await _extract_post(AsyncMock(), mock_element)
    assert result is None
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_scraper.py -v
```

Expected: `ModuleNotFoundError: No module named 'agents.scraper'`

- [ ] **Step 3: Write `agents/scraper.py`**

```python
import asyncio
from datetime import datetime, timezone

from playwright.async_api import Page, async_playwright

import config
from events import push
from models import Post

LOGIN_URL = "https://www.linkedin.com/login"
SAVED_POSTS_URL = "https://www.linkedin.com/my-items/saved-posts/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
POST_SELECTOR = ".scaffold-finite-scroll__content .entity-result"


async def _login(page: Page) -> None:
    await push({
        "type": "scraper_login",
        "agent": "scraper",
        "message": "Logging in to LinkedIn...",
        "payload": {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await page.goto(LOGIN_URL)
    await page.fill("#username", config.LINKEDIN_EMAIL)
    await page.fill("#password", config.LINKEDIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.wait_for_load_state("networkidle")

    url = page.url
    if "/login" in url or "/checkpoint" in url or "/challenge" in url:
        await push({
            "type": "error",
            "agent": "scraper",
            "message": "LinkedIn login failed — check credentials or complete CAPTCHA manually",
            "payload": {"url": url},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        raise RuntimeError("LinkedIn login failed")


async def _scroll_until_n_posts(page: Page, num_posts: int) -> None:
    while True:
        posts = await page.query_selector_all(POST_SELECTOR)
        if len(posts) >= num_posts:
            break
        await push({
            "type": "scraper_scrolling",
            "agent": "scraper",
            "message": f"Loaded {len(posts)}/{num_posts} posts, scrolling...",
            "payload": {"loaded": len(posts), "target": num_posts},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await page.evaluate("window.scrollBy(0, 800)")
        await asyncio.sleep(1.5)


async def _extract_post(page: Page, element) -> Post | None:
    try:
        author_el = await element.query_selector(".entity-result__title-text")
        author = (await author_el.inner_text()).strip() if author_el else "Unknown"

        text_el = await element.query_selector(".entity-result__summary")
        text_content = (await text_el.inner_text()).strip() if text_el else ""

        link_el = await element.query_selector("a.app-aware-link")
        post_url = (await link_el.get_attribute("href")) if link_el else ""
        if post_url and not post_url.startswith("http"):
            post_url = f"https://www.linkedin.com{post_url}"

        return Post(
            author=author,
            text_content=text_content,
            post_url=post_url or "",
            scraped_at=datetime.now(timezone.utc),
        )
    except Exception:
        return None


async def run(num_posts: int) -> list[Post]:
    posts: list[Post] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, slow_mo=50)
        context = await browser.new_context(user_agent=USER_AGENT)
        page = await context.new_page()

        try:
            await _login(page)

            await push({
                "type": "scraper_navigating",
                "agent": "scraper",
                "message": "Navigating to saved posts...",
                "payload": {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await page.goto(SAVED_POSTS_URL)
            await page.wait_for_load_state("networkidle")

            await _scroll_until_n_posts(page, num_posts)

            elements = await page.query_selector_all(POST_SELECTOR)
            elements = elements[:num_posts]

            for i, element in enumerate(elements):
                post = await _extract_post(page, element)
                if post:
                    posts.append(post)
                    await push({
                        "type": "post_scraped",
                        "agent": "scraper",
                        "message": f"Scraped post {i + 1}/{len(elements)}: {post.author}",
                        "payload": {
                            "index": i,
                            "total": len(elements),
                            "post": post.model_dump(mode="json"),
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
        finally:
            await browser.close()

    await push({
        "type": "scraper_done",
        "agent": "scraper",
        "message": f"Scraping complete — {len(posts)} posts collected",
        "payload": {"count": len(posts)},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return posts
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_scraper.py -v
```

Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add agents/scraper.py tests/test_scraper.py
git commit -m "feat: add Playwright LinkedIn scraper agent"
```

---

## Task 7: Orchestrator

**Files:**
- Create: `orchestrator.py`
- Create: `tests/test_orchestrator.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_orchestrator.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_orchestrator.py -v
```

Expected: `ModuleNotFoundError: No module named 'orchestrator'`

- [ ] **Step 3: Write `orchestrator.py`**

```python
import asyncio
from datetime import datetime, timezone

from agents import content, scraper
from events import push


async def run(num_posts: int) -> None:
    await push({
        "type": "orchestrator_start",
        "agent": "orchestrator",
        "message": f"Starting pipeline for {num_posts} posts",
        "payload": {"num_posts": num_posts},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    posts = await scraper.run(num_posts)

    semaphore = asyncio.Semaphore(3)

    async def generate_with_limit(post, index):
        async with semaphore:
            return await content.run(post, index)

    results = await asyncio.gather(
        *[generate_with_limit(post, i) for i, post in enumerate(posts)],
        return_exceptions=True,
    )

    scripts_generated = sum(
        1 for r in results if r is not None and not isinstance(r, Exception)
    )
    errors = len(results) - scripts_generated

    await push({
        "type": "orchestrator_complete",
        "agent": "orchestrator",
        "message": (
            f"Pipeline complete — {scripts_generated} scripts generated, {errors} errors"
        ),
        "payload": {
            "posts_scraped": len(posts),
            "scripts_generated": scripts_generated,
            "errors": errors,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_orchestrator.py -v
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add orchestrator.py tests/test_orchestrator.py
git commit -m "feat: add orchestrator with Semaphore(3) concurrency"
```

---

## Task 8: FastAPI App + SSE

**Files:**
- Create: `main.py`
- Create: `tests/test_main.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_main.py`:

```python
import os
# Set env vars before importing main so config.py doesn't raise
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-placeholder")
os.environ.setdefault("LINKEDIN_EMAIL", "test@example.com")
os.environ.setdefault("LINKEDIN_PASSWORD", "testpassword")

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


def test_index_returns_html():
    from main import app
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()


def test_run_returns_started_status():
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new_callable=AsyncMock):
        response = client.post("/run", json={"num_posts": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "started"
    assert data["num_posts"] == 3


def test_run_default_num_posts():
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new_callable=AsyncMock):
        response = client.post("/run", json={})
    assert response.status_code == 200
    assert response.json()["num_posts"] == 5


def test_run_rejects_invalid_body():
    from main import app
    client = TestClient(app)
    response = client.post("/run", json={"num_posts": "not-a-number"})
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_main.py -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Create `dashboard/index.html` placeholder** (full dashboard in Task 9)

```bash
mkdir -p dashboard
echo '<html><body>placeholder</body></html>' > dashboard/index.html
```

- [ ] **Step 4: Write `main.py`**

```python
import asyncio
import json
from pathlib import Path

import uvicorn
from fastapi import BackgroundTasks
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import config  # noqa: F401 — validates env vars at import time
from events import event_bus
import orchestrator

app = FastAPI(title="LinkedIn Reels Agent")

DASHBOARD = Path(__file__).parent / "dashboard" / "index.html"


@app.get("/")
async def index() -> HTMLResponse:
    return HTMLResponse(DASHBOARD.read_text())


@app.get("/stream")
async def stream() -> EventSourceResponse:
    async def generator():
        while True:
            try:
                event = await asyncio.wait_for(event_bus.get(), timeout=15.0)
                yield {"data": json.dumps(event)}
            except asyncio.TimeoutError:
                yield {"comment": "ping"}

    return EventSourceResponse(generator())


class RunRequest(BaseModel):
    num_posts: int = 5


@app.post("/run")
async def run_pipeline(
    request: RunRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    background_tasks.add_task(orchestrator.run, request.num_posts)
    return JSONResponse({"status": "started", "num_posts": request.num_posts})


async def serve() -> None:
    cfg = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="warning")
    server = uvicorn.Server(cfg)
    print("Dashboard running at http://localhost:8000")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(serve())
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pytest tests/test_main.py -v
```

Expected: `4 passed`

- [ ] **Step 6: Run full test suite**

```bash
pytest -v
```

Expected: all tests pass (no failures)

- [ ] **Step 7: Commit**

```bash
git add main.py tests/test_main.py dashboard/index.html
git commit -m "feat: add FastAPI app with SSE stream endpoint"
```

---

## Task 9: Dashboard

**Files:**
- Modify: `dashboard/index.html` (replace placeholder with full implementation)

No unit tests — this is a visual component. Verification is done by running the server and observing the browser.

- [ ] **Step 1: Replace `dashboard/index.html` with full implementation**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LinkedIn Reels Agent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f0f0f; color: #e0e0e0;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh; display: flex; flex-direction: column; overflow: hidden;
    }
    /* ── Top bar ── */
    .topbar {
      background: #1a1a1a; padding: 10px 16px;
      display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
    }
    .topbar h1 { font-size: 0.95rem; font-weight: 700; color: #fff; flex: 1; }
    label { font-size: 0.75rem; color: #888; }
    input[type=number] {
      background: #0f0f0f; border: 1px solid #333; color: #e0e0e0;
      padding: 5px 8px; border-radius: 6px; width: 68px; font-size: 0.85rem;
    }
    .run-btn {
      background: #6c47ff; color: #fff; border: none;
      padding: 6px 16px; border-radius: 6px; cursor: pointer;
      font-weight: 600; font-size: 0.85rem;
    }
    .run-btn:hover { background: #7c57ff; }
    .run-btn:disabled { background: #2a2a2a; color: #555; cursor: not-allowed; }
    .status-chip {
      padding: 3px 10px; border-radius: 10px;
      font-size: 0.7rem; font-weight: 700; white-space: nowrap;
    }
    .status-chip.idle    { background: #222; color: #666; }
    .status-chip.running { background: #0d2b0d; color: #4ade80; }
    .status-chip.done    { background: #1a1033; color: #a78bfa; }
    /* Progress */
    .progress-group { display: flex; gap: 14px; }
    .prog {
      display: flex; flex-direction: column; gap: 3px; min-width: 110px;
    }
    .prog-label { font-size: 0.65rem; color: #666; }
    .prog-track { background: #222; border-radius: 3px; height: 3px; }
    .prog-fill {
      height: 3px; border-radius: 3px; width: 0%; transition: width 0.4s ease;
    }
    .prog-fill.scrape { background: #4ade80; }
    .prog-fill.script { background: #a78bfa; }
    /* ── Main layout ── */
    .main { display: flex; flex: 1; overflow: hidden; }
    /* ── Left: feed ── */
    .feed-panel {
      width: 40%; background: #0f0f0f;
      border-right: 1px solid #1e1e1e;
      display: flex; flex-direction: column;
    }
    .panel-hdr {
      padding: 10px 14px; font-size: 0.72rem; font-weight: 600;
      color: #555; letter-spacing: 0.05em; text-transform: uppercase;
      border-bottom: 1px solid #1e1e1e; flex-shrink: 0;
    }
    .feed { flex: 1; overflow-y: auto; padding: 8px 8px 16px; }
    .feed-item {
      display: flex; gap: 8px; padding: 7px 8px;
      border-radius: 6px; margin-bottom: 3px;
      animation: fadeUp 0.25s ease;
    }
    .feed-item:hover { background: #161616; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .badge {
      padding: 2px 7px; border-radius: 4px; font-size: 0.6rem;
      font-weight: 700; white-space: nowrap; align-self: flex-start; margin-top: 1px;
    }
    .badge.orchestrator { background: #20103a; color: #c084fc; }
    .badge.scraper      { background: #0a2010; color: #4ade80; }
    .badge.content      { background: #0a1a30; color: #60a5fa; }
    .badge.system       { background: #1a1a1a; color: #888; }
    .badge.error        { background: #2a0a0a; color: #f87171; }
    .feed-body { min-width: 0; }
    .feed-msg { font-size: 0.78rem; color: #ccc; line-height: 1.4; word-break: break-word; }
    .feed-time { font-size: 0.62rem; color: #444; margin-top: 2px; }
    /* ── Right: tabs ── */
    .content-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .tabs {
      display: flex; border-bottom: 1px solid #1e1e1e;
      background: #141414; flex-shrink: 0;
    }
    .tab {
      padding: 9px 18px; cursor: pointer; font-size: 0.82rem;
      color: #666; border-bottom: 2px solid transparent;
      transition: color 0.2s;
    }
    .tab:hover { color: #aaa; }
    .tab.active { color: #fff; border-bottom-color: #6c47ff; }
    .tab-pane { flex: 1; overflow-y: auto; padding: 14px; display: none; }
    .tab-pane.active { display: block; }
    .empty {
      color: #333; font-size: 0.82rem; text-align: center;
      padding: 48px 24px; line-height: 1.8;
    }
    /* ── Cards ── */
    .card {
      background: #1a1a1a; border: 1px solid #242424; border-radius: 8px;
      padding: 14px 16px; margin-bottom: 10px;
      animation: fadeUp 0.3s ease;
    }
    .card-meta { font-size: 0.7rem; color: #555; margin-bottom: 6px; }
    .card-author { font-size: 0.78rem; color: #888; margin-bottom: 5px; font-weight: 600; }
    .card-text { font-size: 0.82rem; color: #bbb; line-height: 1.5; margin-bottom: 8px; }
    .card-link { font-size: 0.72rem; color: #6c47ff; text-decoration: none; }
    .card-link:hover { text-decoration: underline; }
    /* Reels script */
    .reel-hook { font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 10px; }
    .reel-script {
      font-size: 0.8rem; color: #999; line-height: 1.7; margin-bottom: 10px;
      border-left: 2px solid #2a2a2a; padding-left: 10px;
      white-space: pre-wrap;
    }
    .reel-caption { font-size: 0.75rem; color: #777; margin-bottom: 10px; }
    .pills { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
    .pill {
      background: #0d1f35; color: #60a5fa; padding: 3px 9px;
      border-radius: 10px; font-size: 0.68rem;
    }
    .cta-tag {
      display: inline-block; background: #1c1030; color: #c084fc;
      border: 1px solid #2d1a4a; padding: 5px 12px;
      border-radius: 6px; font-size: 0.75rem;
    }
  </style>
</head>
<body>

<div class="topbar">
  <h1>LinkedIn → Reels Agent</h1>
  <label for="nPosts">Posts</label>
  <input type="number" id="nPosts" value="5" min="1" max="50">
  <button class="run-btn" id="runBtn" onclick="startRun()">▶ Run</button>
  <span class="status-chip idle" id="chip">Idle</span>
  <div class="progress-group">
    <div class="prog">
      <div class="prog-label" id="scrapeLabel">Scraped 0/–</div>
      <div class="prog-track"><div class="prog-fill scrape" id="scrapeBar"></div></div>
    </div>
    <div class="prog">
      <div class="prog-label" id="scriptLabel">Scripts 0/–</div>
      <div class="prog-track"><div class="prog-fill script" id="scriptBar"></div></div>
    </div>
  </div>
</div>

<div class="main">
  <div class="feed-panel">
    <div class="panel-hdr">Agent Activity</div>
    <div class="feed" id="feed">
      <div class="empty">Waiting for pipeline to start…</div>
    </div>
  </div>
  <div class="content-panel">
    <div class="tabs">
      <div class="tab active" onclick="showTab('posts', this)">Scraped Posts</div>
      <div class="tab" onclick="showTab('scripts', this)">Reels Scripts</div>
    </div>
    <div class="tab-pane active" id="pane-posts">
      <div class="empty">Posts will appear here as they are scraped.</div>
    </div>
    <div class="tab-pane" id="pane-scripts">
      <div class="empty">Reels scripts will appear here as they are generated.</div>
    </div>
  </div>
</div>

<script>
  let es = null;
  let total = 0, scraped = 0, scripts = 0;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showTab(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('pane-' + name).classList.add('active');
  }

  function setStatus(s) {
    const chip = document.getElementById('chip');
    chip.className = 'status-chip ' + s;
    chip.textContent = { idle: 'Idle', running: 'Running', done: 'Done' }[s] || s;
  }

  function updateBars() {
    const pct = n => total ? Math.round((n / total) * 100) + '%' : '0%';
    document.getElementById('scrapeLabel').textContent = `Scraped ${scraped}/${total || '–'}`;
    document.getElementById('scrapeBar').style.width = pct(scraped);
    document.getElementById('scriptLabel').textContent = `Scripts ${scripts}/${total || '–'}`;
    document.getElementById('scriptBar').style.width = pct(scripts);
  }

  function addFeed(type, agent, msg) {
    const feed = document.getElementById('feed');
    const empties = feed.querySelectorAll('.empty');
    empties.forEach(e => e.remove());

    const badgeCls = type === 'error' ? 'error' : (agent || 'system');
    const time = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `
      <span class="badge ${esc(badgeCls)}">${esc(agent)}</span>
      <div class="feed-body">
        <div class="feed-msg">${esc(msg)}</div>
        <div class="feed-time">${time}</div>
      </div>`;
    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
  }

  function addPostCard(post) {
    const pane = document.getElementById('pane-posts');
    pane.querySelectorAll('.empty').forEach(e => e.remove());
    const preview = (post.text_content || '').slice(0, 100)
      + ((post.text_content || '').length > 100 ? '…' : '');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-author">${esc(post.author)}</div>
      <div class="card-text">${esc(preview)}</div>
      ${post.post_url
        ? `<a class="card-link" href="${esc(post.post_url)}" target="_blank" rel="noreferrer">
             View on LinkedIn →</a>`
        : ''}`;
    pane.appendChild(card);
  }

  function addScriptCard(s) {
    const pane = document.getElementById('pane-scripts');
    pane.querySelectorAll('.empty').forEach(e => e.remove());
    const pills = (s.hashtags || [])
      .map(h => `<span class="pill">#${esc(h)}</span>`).join('');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="reel-hook">${esc(s.hook)}</div>
      <div class="reel-script">${esc(s.script)}</div>
      <div class="reel-caption">${esc(s.caption)}</div>
      <div class="pills">${pills}</div>
      <span class="cta-tag">${esc(s.cta)}</span>`;
    pane.appendChild(card);
  }

  function handleEvent(e) {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    const { type, agent, message, payload } = data;

    addFeed(type, agent, message);

    if (type === 'orchestrator_start') {
      total = payload.num_posts; scraped = 0; scripts = 0;
      updateBars(); setStatus('running');
    }
    if (type === 'post_scraped') {
      scraped++; updateBars();
      if (payload.post) addPostCard(payload.post);
    }
    if (type === 'content_ready') {
      scripts++; updateBars();
      if (payload.script) addScriptCard(payload.script);
    }
    if (type === 'orchestrator_complete') {
      setStatus('done');
      document.getElementById('runBtn').disabled = false;
    }
    if (type === 'error') {
      setStatus('idle');
      document.getElementById('runBtn').disabled = false;
    }
  }

  function connectSSE() {
    if (es) { es.close(); }
    es = new EventSource('/stream');
    es.onmessage = handleEvent;
    es.onerror = () => addFeed('error', 'system', 'SSE connection lost — retrying…');
  }

  function startRun() {
    const n = parseInt(document.getElementById('nPosts').value, 10) || 5;
    document.getElementById('runBtn').disabled = true;
    connectSSE();
    fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ num_posts: n }),
    }).catch(err => addFeed('error', 'system', 'Failed to start: ' + err.message));
  }

  // Connect SSE on page load to receive events immediately
  connectSSE();
</script>
</body>
</html>
```

- [ ] **Step 2: Run full test suite to confirm nothing regressed**

```bash
pytest -v
```

Expected: all tests pass

- [ ] **Step 3: Smoke test — start the server**

```bash
python main.py
```

Expected output:
```
Dashboard running at http://localhost:8000
```

Open http://localhost:8000 in a browser. Verify:
- Dark UI loads with top bar, left feed panel, right tab panel
- "Run" button is visible with posts input defaulting to 5
- Status chip shows "Idle"
- Both progress bars show 0

- [ ] **Step 4: End-to-end test — click Run**

In the browser, set Posts = 2, click **▶ Run**. Verify:
- Status chip changes to "Running"
- A Chromium browser window opens and navigates to LinkedIn
- Activity feed populates with `scraper_login`, `scraper_navigating` events
- As posts are scraped, cards appear in "Scraped Posts" tab
- As scripts are generated, cards appear in "Reels Scripts" tab with hook, script, hashtag pills, CTA
- Status chip changes to "Done" when complete

- [ ] **Step 5: Commit**

```bash
git add dashboard/index.html
git commit -m "feat: add real-time dashboard with SSE-driven activity feed and script cards"
```

---

## Final Verification

- [ ] **Run full test suite one last time**

```bash
pytest -v --tb=short
```

Expected: all tests pass, 0 failures

- [ ] **Verify project structure matches spec**

```bash
find . -type f | grep -v __pycache__ | grep -v .git | grep -v .env | sort
```

Expected output:
```
./README.md
./agents/__init__.py
./agents/content.py
./agents/scraper.py
./.env.example
./dashboard/index.html
./docs/superpowers/plans/2026-05-11-linkedin-reels-agent.md
./docs/superpowers/specs/2026-05-11-linkedin-reels-agent-design.md
./events.py
./main.py
./models.py
./orchestrator.py
./pytest.ini
./requirements.txt
./tests/__init__.py
./tests/test_content.py
./tests/test_main.py
./tests/test_models.py
./tests/test_orchestrator.py
./tests/test_scraper.py
```
