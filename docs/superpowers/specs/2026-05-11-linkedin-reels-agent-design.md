# LinkedIn → Instagram Reels Agent — Design Spec

**Date:** 2026-05-11
**Status:** Approved

---

## Overview

An agentic pipeline that scrapes a user's LinkedIn saved posts, transforms each into an Instagram Reels script via Claude, and streams all activity in real time to a local web dashboard.

---

## Architecture

Single-process, shared `asyncio` event loop. FastAPI and Playwright coexist in the same loop. `uvicorn` is started programmatically via `asyncio.run(main())` so the loop is caller-owned.

```
main.py
  └── asyncio.run(serve())
        ├── starts uvicorn (loop=current)
        └── mounts routes: GET /, GET /stream, POST /run

POST /run → asyncio.create_task(orchestrator.run(num_posts))

orchestrator.py
  ├── ScrapeAgent.run(num_posts) → List[Post]
  └── asyncio.gather with Semaphore(3) → ContentAgent.run(post) × N

events.py
  └── event_bus: asyncio.Queue (global singleton)
      └── push(dict) — called by all agents

dashboard/index.html
  └── EventSource('/stream') → renders activity feed + post/script cards
```

---

## Project Structure

```
linkedin_reels_agent/
├── main.py               # Entry point — FastAPI app + uvicorn startup
├── orchestrator.py       # Chains scraper → content agents
├── agents/
│   ├── scraper.py        # Playwright LinkedIn scraper
│   └── content.py        # Claude API content generator
├── dashboard/
│   └── index.html        # Single-file real-time dashboard
├── events.py             # Global asyncio.Queue event bus
├── models.py             # Pydantic v2: Post, ReelsScript, AgentEvent
├── config.py             # .env loader with startup validation
├── .env.example
├── README.md
└── docs/superpowers/specs/2026-05-11-linkedin-reels-agent-design.md
```

---

## Data Models (`models.py`)

```python
class Post(BaseModel):
    author: str
    text_content: str
    post_url: str
    scraped_at: datetime

class ReelsScript(BaseModel):
    hook: str           # max 15 words, first 3 seconds
    script: str         # 30-60 second spoken content
    caption: str        # max 150 chars with hashtags
    hashtags: list[str] # 10 items, no # prefix
    cta: str            # max 10 words

class AgentEvent(BaseModel):
    type: str
    agent: str          # orchestrator | scraper | content | system
    message: str
    payload: dict = {}
    timestamp: datetime
```

---

## Event Types

| `type` | `agent` | Description |
|---|---|---|
| `orchestrator_start` | orchestrator | Pipeline begins |
| `orchestrator_complete` | orchestrator | All posts processed, includes stats |
| `scraper_login` | scraper | Attempting login |
| `scraper_navigating` | scraper | Navigating to saved posts |
| `scraper_scrolling` | scraper | Scrolling to load more posts |
| `post_scraped` | scraper | One post extracted (includes `index`, `total`, `post`) |
| `scraper_done` | scraper | All posts collected |
| `content_generating` | content | Claude call started (includes `post_index`) |
| `content_ready` | content | Script produced (includes `post_index`, `script`) |
| `content_error` | content | Claude call failed for this post, continuing |
| `error` | any | Fatal error — pipeline stopped |

---

## Components

### `config.py`
- Loads `.env` via `python-dotenv`
- Raises `ValueError` at import time if `ANTHROPIC_API_KEY`, `LINKEDIN_EMAIL`, or `LINKEDIN_PASSWORD` are missing
- Exports: `ANTHROPIC_API_KEY`, `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD`

### `events.py`
- `event_bus: asyncio.Queue` — module-level singleton
- `async def push(event: dict) -> None` — used by all agents
- SSE endpoint drains this queue; keep-alive `: ping` sent every 15s when queue is empty

### `agents/scraper.py` — ScrapeAgent
- `async def run(num_posts: int) -> list[Post]`
- Playwright launched with `headless=False`, `slow_mo=50`, realistic Chrome user-agent
- **Login:** fill email/password → click submit → wait for navigation → detect failure by checking if URL contains `/login` or `/checkpoint`
- **Navigate:** go to `https://www.linkedin.com/my-items/saved-posts/`
- **Scroll loop:** `page.evaluate("window.scrollBy(0, 800)")` + `asyncio.sleep(1.5)` until N post elements visible
- **Extract per post:** CSS selectors for author name, post text, post URL
- Emits: `scraper_login`, `scraper_navigating`, `scraper_scrolling`, `post_scraped` (index/total/post), `scraper_done`
- On login failure: emits `error` event and raises `RuntimeError` to halt pipeline

### `agents/content.py` — ContentAgent
- `async def run(post: Post, post_index: int) -> ReelsScript | None`
- Model: `claude-sonnet-4-6`
- Uses `client.messages.create()` (non-streaming for simpler JSON parsing)
- Strips markdown code fences before JSON parsing
- Validates output against `ReelsScript`
- On failure: emits `content_error`, returns `None` (pipeline continues)

### `orchestrator.py`
- `async def run(num_posts: int) -> None`
- Emits `orchestrator_start`
- Calls `ScrapeAgent.run(num_posts)`
- Runs `ContentAgent.run()` for all posts with `asyncio.Semaphore(3)` for max 3 concurrent Claude calls
- Emits `orchestrator_complete` with `{ posts_scraped, scripts_generated, errors }`

### `main.py`
- `GET /` → serves `dashboard/index.html`
- `GET /stream` → SSE `EventSourceResponse` draining `event_bus`
- `POST /run` → `{ "num_posts": int }` body → `asyncio.create_task(orchestrator.run(num_posts))`
- Starts uvicorn on port 8000 programmatically
- Prints `"Dashboard running at http://localhost:8000"` on startup

### `dashboard/index.html`
- Single self-contained file, vanilla HTML/CSS/JS, no external deps
- **Top bar:** num_posts input (default 5), Run button, status chip (idle/running/done), dual progress bars
- **Left panel (40%):** Activity feed — scrolling log, colored badges per agent, fade-in animation, auto-scroll
- **Right panel (60%):** Two tabs
  - *Scraped Posts:* cards with author, 100-char preview, post URL link
  - *Reels Scripts:* cards with hook (large bold), script preview, caption, hashtag pills, CTA
- `EventSource('/stream')` drives all updates; `POST /run` kicks off the pipeline

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing env vars | `ValueError` at import — fast fail before server starts |
| LinkedIn login failure | Emit `error` event, raise `RuntimeError`, pipeline halts |
| LinkedIn CAPTCHA / checkpoint | Detected via URL check, emits descriptive error |
| Claude API failure (per post) | Emit `content_error`, return `None`, remaining posts continue |
| JSON parse failure from Claude | Strip fences, retry parse; on failure emit `content_error` |
| SSE client disconnects | Queue continues accumulating; reconnect replays nothing (live-only) |

---

## Claude Prompt (Content Agent)

**System:**
```
You are an expert Instagram Reels scriptwriter. Transform the LinkedIn post content into a punchy,
engaging Instagram Reels script. Output valid JSON with these fields:
- hook: string (first 3 seconds, attention-grabbing opener, max 15 words)
- script: string (30-60 second spoken script, conversational tone, broken into lines)
- caption: string (Instagram caption with relevant hashtags, max 150 chars)
- hashtags: array of 10 strings (no # prefix)
- cta: string (call to action, max 10 words)
Output ONLY the JSON object. No markdown, no explanation.
```

**User:** `<post text content>`

---

## Setup

```bash
pip install anthropic playwright fastapi uvicorn python-dotenv sse-starlette pydantic
playwright install chromium
cp .env.example .env  # fill in credentials
python main.py        # dashboard at http://localhost:8000
```

---

## Constraints & Decisions

- All I/O is async — no `time.sleep`, no blocking calls
- Playwright runs headed (`headless=False`) to reduce LinkedIn bot detection
- `slow_mo=50` simulates human-like interaction timing
- SSE stream stays alive indefinitely; `: ping` every 15s prevents browser timeout
- `asyncio.Semaphore(3)` caps Claude API parallelism
- LinkedIn scraping is for personal use only on the user's own account
