# Reelify Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current minimal dashboard with the high-fidelity Reelify design from `design-reference/README.md`, driven by real backend events (LinkedIn Playwright scrape + Claude script generation).

**Architecture:** Introduce a new `frontend/` directory containing a React 18 + TypeScript + Vite app. FastAPI keeps serving `/run`, `/stream` and adds `/stop`; in production it also serves the built static assets from `frontend/dist/`. Backend gains tone-aware script generation, cooperative cancellation via `asyncio.Task.cancel()`, and explicit `stage:*` and `log:*` events alongside existing typed events so the new UI's event contract is met. The legacy `dashboard/index.html` is removed once the React app is wired in.

**Tech Stack:**
- Backend: Python 3, FastAPI, uvicorn, sse-starlette, Playwright, anthropic SDK, pytest
- Frontend: React 18, TypeScript 5, Vite 5, CSS Modules + a global token stylesheet, native `EventSource` and `fetch`
- No state library — `useReducer` + Context is enough for one screen

---

## File Map

### Backend changes (modify)
- `models.py` — add `Tone` literal type
- `main.py` — add `tone` to `RunRequest`, add `/stop` endpoint, mount static assets, register current task for cancellation
- `orchestrator.py` — accept `tone`; emit `stage:changed` events at boundaries; honour cancellation
- `agents/content.py` — accept `tone`; weave into the system prompt
- `agents/scraper.py` — wrap existing log messages so they also emit `log:line` events
- `events.py` — no shape change, but document new event types here as docstrings

### Frontend (new)
- `frontend/package.json` — Vite + React + TS deps
- `frontend/vite.config.ts` — React plugin + dev proxy
- `frontend/tsconfig.json` + `tsconfig.node.json`
- `frontend/index.html` — root document, fonts preconnect
- `frontend/src/main.tsx` — Vite entry
- `frontend/src/App.tsx` — top-level component, layout grid
- `frontend/src/state/store.tsx` — reducer + Context provider for run state
- `frontend/src/types.ts` — typed event union matching backend contract
- `frontend/src/api.ts` — `startRun`, `stopRun`, `subscribe` helpers
- `frontend/src/hooks/useCounter.ts` — animated counter
- `frontend/src/hooks/useReducedMotion.ts`
- `frontend/src/styles/tokens.css` — design tokens + global resets
- `frontend/src/icons.tsx` — inline SVGs (bookmark, play, chev, spark, bell, gear)
- `frontend/src/components/Header.tsx` + `Header.module.css`
- `frontend/src/components/ConfigurePanel.tsx` + `ConfigurePanel.module.css`
- `frontend/src/components/Dropdown.tsx` + `Dropdown.module.css`
- `frontend/src/components/PipelinePanel.tsx` + `PipelinePanel.module.css`
- `frontend/src/components/Core.tsx` + `Core.module.css` (rings, particles, bulb, connectors)
- `frontend/src/components/ScriptsPanel.tsx` + `ScriptsPanel.module.css`
- `frontend/src/components/Terminal.tsx` + `Terminal.module.css`

### Backend tests (modify/add)
- `tests/test_main.py` — extend with tone, /stop, static-mount cases
- `tests/test_orchestrator.py` — stage events, cancellation
- `tests/test_content.py` — tone in prompt

### Files removed
- `dashboard/index.html` — replaced
- `dashboard/.gitkeep` — keep, repurpose `dashboard/` as build-output target or delete; plan deletes it
- `dashboard/` — directory removed

---

## Self-Review Checklist (read at end of plan)
- Tone wired end-to-end: request → orchestrator → content → prompt
- Stop wired end-to-end: button → POST /stop → task.cancel() → state reset event
- All 5 design stages render correctly
- All animations match spec (durations, easings, staggers)
- `prefers-reduced-motion` respected
- Backend pytest green, frontend builds clean
- README updated with new dev workflow

---

### Task 1: Add Tone type and request validation

**Files:**
- Modify: `models.py`
- Modify: `main.py:24-26` (`RunRequest` definition)
- Test: `tests/test_main.py`

- [ ] **Step 1: Write the failing test**

Add at the bottom of `tests/test_main.py`:

```python
def test_run_accepts_valid_tone():
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new_callable=AsyncMock):
        response = client.post("/run", json={"num_posts": 3, "tone": "Punchy"})
    assert response.status_code == 200
    assert response.json()["tone"] == "Punchy"


def test_run_rejects_invalid_tone():
    from main import app
    client = TestClient(app)
    response = client.post("/run", json={"num_posts": 3, "tone": "Whimsical"})
    assert response.status_code == 422


def test_run_defaults_tone_to_punchy():
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new_callable=AsyncMock):
        response = client.post("/run", json={"num_posts": 3})
    assert response.json()["tone"] == "Punchy"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_main.py -k "tone" -v`
Expected: 3 FAILs (`tone` not in response / accepted).

- [ ] **Step 3: Add Tone literal to `models.py`**

Append to `models.py`:

```python
from typing import Literal

Tone = Literal["Punchy", "Story-led", "Analytical", "Educational"]
```

- [ ] **Step 4: Update `RunRequest` in `main.py`**

Modify the `RunRequest` class in `main.py`:

```python
from models import Tone

class RunRequest(BaseModel):
    num_posts: int = Field(default=5, ge=1, le=100)
    tone: Tone = Field(default="Punchy")
```

Also update the `/run` handler's success response to echo tone, and pass tone to orchestrator (signature update happens in Task 4, for now pass it positionally — but to keep tests green, just include tone in the JSON response):

```python
@app.post("/run")
async def run_pipeline(
    request: RunRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    global _pipeline_running
    if _pipeline_running:
        return JSONResponse({"status": "already_running"}, status_code=409)
    _pipeline_running = True

    async def run_and_reset():
        try:
            await orchestrator.run(request.num_posts, request.tone)
        finally:
            global _pipeline_running
            _pipeline_running = False

    background_tasks.add_task(run_and_reset)
    return JSONResponse({
        "status": "started",
        "num_posts": request.num_posts,
        "tone": request.tone,
    })
```

- [ ] **Step 5: Update orchestrator.run signature to accept tone (no-op pass-through for now)**

Modify `orchestrator.py` line 6 signature:

```python
async def run(num_posts: int, tone: str = "Punchy") -> None:
```

Add `tone` to the start-event payload:

```python
await push({
    "type": "orchestrator_start",
    "agent": "orchestrator",
    "message": f"Starting pipeline for {num_posts} posts ({tone})",
    "payload": {"num_posts": num_posts, "tone": tone},
    "timestamp": datetime.now(timezone.utc).isoformat(),
})
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/test_main.py -v`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add models.py main.py orchestrator.py tests/test_main.py
git commit -m "feat(api): add tone parameter to /run endpoint"
```

---

### Task 2: Wire tone into content agent

**Files:**
- Modify: `agents/content.py`
- Modify: `orchestrator.py` (pass tone to content.run)
- Test: `tests/test_content.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_content.py`:

```python
@pytest.mark.asyncio
async def test_run_passes_tone_into_system_prompt(monkeypatch):
    from agents import content
    from models import Post
    from datetime import datetime, timezone

    captured: dict = {}

    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        class messages:
            @staticmethod
            async def create(**kwargs):
                captured["system"] = kwargs["system"]
                class Resp:
                    content = [type("X", (), {"text": '{"hook":"h","script":"s","caption":"c","hashtags":[],"cta":"go"}'})()]
                return Resp()

    monkeypatch.setattr(content, "_client", FakeClient)
    monkeypatch.setattr(content, "get_client", lambda: FakeClient)
    post = Post(author="A", text_content="body", post_url="", scraped_at=datetime.now(timezone.utc))
    await content.run(post, 0, tone="Story-led")
    sys_block = captured["system"][0]["text"]
    assert "story-led" in sys_block.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_content.py::test_run_passes_tone_into_system_prompt -v`
Expected: FAIL (`content.run` doesn't accept `tone`).

- [ ] **Step 3: Update `content.run` signature and prompt**

In `agents/content.py`, change `SYSTEM_PROMPT` from a string constant to a function returning a tone-flavoured prompt:

```python
TONE_GUIDE = {
    "Punchy":      "Short, snappy sentences. Hard hooks. Emphasise the surprising number, claim, or twist.",
    "Story-led":   "Open with a scene or character. Carry a single narrative arc across the script.",
    "Analytical":  "Lead with the data point or insight. Cite the mechanism or evidence in each scene.",
    "Educational": "Frame as a step-by-step breakdown. The viewer should leave knowing how to do something.",
}


def build_system_prompt(tone: str) -> str:
    guidance = TONE_GUIDE.get(tone, TONE_GUIDE["Punchy"])
    return (
        "You are an expert Instagram Reels scriptwriter. Transform the LinkedIn post content "
        f"into an Instagram Reels script in the '{tone}' tone. {guidance}\n\n"
        "Output valid JSON with these fields:\n"
        "- hook: string (first 3 seconds, attention-grabbing opener, max 15 words)\n"
        "- script: string (30-60 second spoken script, conversational tone, broken into lines)\n"
        "- caption: string (Instagram caption with relevant hashtags, max 150 chars)\n"
        "- hashtags: array of 10 strings (no # prefix)\n"
        "- cta: string (call to action, max 10 words)\n"
        "Output ONLY the JSON object. No markdown, no explanation."
    )
```

Then update `run`:

```python
async def run(post: Post, post_index: int, tone: str = "Punchy") -> ReelsScript | None:
    now = datetime.now(timezone.utc).isoformat()
    await push({
        "type": "content_generating",
        "agent": "content",
        "message": f"Generating Reels script for post {post_index + 1} (tone={tone})",
        "payload": {"post_index": post_index, "tone": tone},
        "timestamp": now,
    })
    try:
        client = get_client()
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[{
                "type": "text",
                "text": build_system_prompt(tone),
                "cache_control": {"type": "ephemeral"},
            }],
            messages=[{"role": "user", "content": post.text_content}],
        )
        ...
```

Delete the old `SYSTEM_PROMPT` constant.

- [ ] **Step 4: Update `orchestrator.py` to pass tone**

Replace the existing `generate_with_limit` block:

```python
semaphore = asyncio.Semaphore(3)

async def generate_with_limit(post, index):
    async with semaphore:
        return await content.run(post, index, tone=tone)
```

- [ ] **Step 5: Run tests to verify**

Run: `pytest tests/test_content.py -v`
Expected: all pass (including the new tone test).

- [ ] **Step 6: Commit**

```bash
git add agents/content.py orchestrator.py tests/test_content.py
git commit -m "feat(content): generate scripts in the selected tone"
```

---

### Task 3: Add /stop endpoint with cooperative cancellation

**Files:**
- Modify: `main.py`
- Test: `tests/test_main.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_main.py`:

```python
def test_stop_when_idle_returns_no_op():
    from main import app
    client = TestClient(app)
    response = client.post("/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "idle"


def test_stop_cancels_running_pipeline():
    import asyncio
    import main as main_module

    async def slow_run(num_posts, tone="Punchy"):
        try:
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            main_module._cancelled_marker = True
            raise

    main_module._cancelled_marker = False
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new=slow_run):
        started = client.post("/run", json={"num_posts": 3})
        assert started.json()["status"] == "started"
        # poll until the background task has registered
        import time
        for _ in range(20):
            if main_module._current_task is not None:
                break
            time.sleep(0.05)
        stopped = client.post("/stop")
    assert stopped.status_code == 200
    assert stopped.json()["status"] == "stopped"
    # wait briefly for cancellation to propagate
    for _ in range(20):
        if main_module._cancelled_marker:
            break
        time.sleep(0.05)
    assert main_module._cancelled_marker is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_main.py -k "stop" -v`
Expected: 2 FAILs (no `/stop` endpoint).

- [ ] **Step 3: Refactor `main.py` to track the running asyncio task**

Replace the `_pipeline_running` global and the `/run` handler. Full updated section:

```python
_current_task: asyncio.Task | None = None


@app.post("/run")
async def run_pipeline(request: RunRequest) -> JSONResponse:
    global _current_task
    if _current_task is not None and not _current_task.done():
        return JSONResponse({"status": "already_running"}, status_code=409)

    async def run_and_reset():
        try:
            await orchestrator.run(request.num_posts, request.tone)
        except asyncio.CancelledError:
            await event_bus.put({
                "type": "stage_changed",
                "agent": "orchestrator",
                "message": "Pipeline stopped by user",
                "payload": {"stage": "idle"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            raise
        finally:
            global _current_task
            _current_task = None

    _current_task = asyncio.create_task(run_and_reset())
    return JSONResponse({
        "status": "started",
        "num_posts": request.num_posts,
        "tone": request.tone,
    })


@app.post("/stop")
async def stop_pipeline() -> JSONResponse:
    global _current_task
    if _current_task is None or _current_task.done():
        return JSONResponse({"status": "idle"})
    _current_task.cancel()
    return JSONResponse({"status": "stopped"})
```

Add imports at top of `main.py`:

```python
from datetime import datetime, timezone
```

Remove the `BackgroundTasks` import — `/run` no longer needs it.

Delete the old `_pipeline_running` global and any references.

- [ ] **Step 4: Update existing tests that rely on `_pipeline_running`**

In `tests/test_main.py` update `test_run_returns_409_when_already_running` to use the new task pattern:

```python
def test_run_returns_409_when_already_running():
    import asyncio
    import main as main_module

    async def slow_run(num_posts, tone="Punchy"):
        await asyncio.sleep(10)

    from main import app
    client = TestClient(app)
    main_module._current_task = None
    with patch("main.orchestrator.run", new=slow_run):
        first = client.post("/run", json={"num_posts": 3})
        assert first.status_code == 200
        # second request while task is still alive
        second = client.post("/run", json={"num_posts": 3})
        assert second.status_code == 409
        client.post("/stop")  # cleanup
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_main.py -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_main.py
git commit -m "feat(api): add /stop endpoint with cooperative task cancellation"
```

---

### Task 4: Emit explicit stage:changed events

**Files:**
- Modify: `orchestrator.py`
- Test: `tests/test_orchestrator.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_orchestrator.py`:

```python
@pytest.mark.asyncio
async def test_run_emits_stage_changed_events(monkeypatch):
    from datetime import datetime, timezone
    from agents import content, scraper
    import orchestrator, events as events_mod

    events_mod.event_bus = asyncio.Queue()

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

    await orchestrator.run(2, tone="Punchy")

    seen_stages = []
    while not events_mod.event_bus.empty():
        ev = events_mod.event_bus.get_nowait()
        if ev.get("type") == "stage_changed":
            seen_stages.append(ev["payload"]["stage"])

    assert seen_stages == ["scraping", "generating", "done"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_orchestrator.py::test_run_emits_stage_changed_events -v`
Expected: FAIL (no stage_changed events emitted).

- [ ] **Step 3: Refactor `orchestrator.run` to emit stage events**

Replace the body of `orchestrator.run`:

```python
async def run(num_posts: int, tone: str = "Punchy") -> None:
    now = lambda: datetime.now(timezone.utc).isoformat()

    async def stage(name: str) -> None:
        await push({
            "type": "stage_changed",
            "agent": "orchestrator",
            "message": f"stage: {name}",
            "payload": {"stage": name},
            "timestamp": now(),
        })

    await push({
        "type": "orchestrator_start",
        "agent": "orchestrator",
        "message": f"Starting pipeline for {num_posts} posts ({tone})",
        "payload": {"num_posts": num_posts, "tone": tone},
        "timestamp": now(),
    })
    await stage("scraping")

    try:
        posts = await scraper.run(num_posts)
    except Exception as exc:
        await push({
            "type": "error",
            "agent": "orchestrator",
            "message": f"Scraper failed: {exc}",
            "payload": {},
            "timestamp": now(),
        })
        await stage("idle")
        return

    await stage("generating")

    semaphore = asyncio.Semaphore(3)

    async def generate_with_limit(post, index):
        async with semaphore:
            return await content.run(post, index, tone=tone)

    results = await asyncio.gather(
        *[generate_with_limit(post, i) for i, post in enumerate(posts)],
        return_exceptions=True,
    )

    scripts_generated = sum(
        1 for r in results if r is not None and not isinstance(r, Exception)
    )
    errors = len(results) - scripts_generated

    await stage("done")

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
        "timestamp": now(),
    })
```

Note: design has a `parsing` stage too. We don't have a discrete parse step server-side — the scraper produces parsed Post objects directly. We collapse to scraping → generating → done. The frontend can briefly show `parsing` while waiting for the first script, but the canonical stages emitted by the backend are these three.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_orchestrator.py -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add orchestrator.py tests/test_orchestrator.py
git commit -m "feat(orchestrator): emit explicit stage_changed events"
```

---

### Task 5: Scaffold the React + Vite + TS frontend

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/vite-env.d.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "reelify-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/run": "http://localhost:8000",
      "/stop": "http://localhost:8000",
      "/stream": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
```

- [ ] **Step 3: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Reelify — Saved → Reels</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 7: Create placeholder `frontend/src/App.tsx`**

```tsx
export default function App() {
  return <div className="app">reelify boot ok</div>;
}
```

- [ ] **Step 8: Create placeholder `frontend/src/styles/tokens.css`**

Just enough to verify the build — actual tokens land in Task 7.

```css
:root { color-scheme: dark; }
body { margin: 0; background: #0f0e0d; color: #f5f3ee; font-family: system-ui, sans-serif; }
```

- [ ] **Step 9: Create `frontend/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 10: Add Node ignores to `.gitignore`**

Append to `.gitignore`:

```
# frontend
frontend/node_modules
frontend/dist
```

- [ ] **Step 11: Install deps and verify build**

```bash
cd frontend && npm install
npm run build
```

Expected: `dist/index.html` and `dist/assets/...` produced, no TS errors.

- [ ] **Step 12: Commit**

```bash
git add frontend/ .gitignore
git commit -m "feat(frontend): scaffold React + Vite + TypeScript app"
```

---

### Task 6: Serve the Vite build from FastAPI

**Files:**
- Modify: `main.py`
- Modify: `tests/test_main.py`
- Modify: `README.md`

- [ ] **Step 1: Update `tests/test_main.py` index test**

Replace `test_index_returns_html` with a version that does not require `dashboard/index.html`:

```python
def test_index_returns_html(tmp_path, monkeypatch):
    # Point the app at a stub dist dir so the test does not require an actual frontend build
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html><body>reelify</body></html>")
    monkeypatch.setenv("REELIFY_FRONTEND_DIST", str(dist))
    # Reload module to pick up env
    import importlib, main
    importlib.reload(main)
    client = TestClient(main.app)
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "reelify" in response.text.lower()
```

- [ ] **Step 2: Modify `main.py` to serve the build**

Replace the top of `main.py` (path resolution + index handler) with:

```python
import os
from fastapi.staticfiles import StaticFiles

_DEFAULT_DIST = Path(__file__).parent / "frontend" / "dist"
_FRONTEND_DIST = Path(os.getenv("REELIFY_FRONTEND_DIST", _DEFAULT_DIST))


@app.get("/")
async def index() -> HTMLResponse:
    index_path = _FRONTEND_DIST / "index.html"
    if not index_path.exists():
        return HTMLResponse(
            "<h1>Frontend not built</h1><p>Run <code>cd frontend && npm install && npm run build</code>.</p>",
            status_code=503,
        )
    return HTMLResponse(index_path.read_text())


if (_FRONTEND_DIST / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=_FRONTEND_DIST / "assets"),
        name="assets",
    )
```

Delete the old `_DASHBOARD_PATH` / `DASHBOARD_HTML` lines.

- [ ] **Step 3: Run tests to verify they pass**

Run: `pytest tests/test_main.py -v`
Expected: all pass. The index test uses an env-pointed stub dist.

- [ ] **Step 4: Update root `README.md`**

Replace the **Setup** block in `README.md` with:

```markdown
## Setup

```bash
pip install -r requirements.txt
playwright install chromium
cp .env.example .env  # fill in your credentials

# Build the frontend once
cd frontend && npm install && npm run build && cd ..

python main.py        # serves the built dashboard at http://localhost:8000
```

For frontend development with hot reload, run `cd frontend && npm run dev` in a second terminal and open http://localhost:5173 — Vite will proxy /run, /stop and /stream to the FastAPI server on :8000.
```

- [ ] **Step 5: Build and smoke-test end-to-end**

```bash
cd frontend && npm run build && cd ..
python -c "import main; import asyncio; print('import ok')"
```

Expected: no errors. Visit http://localhost:8000 manually (separate terminal: `python main.py`) — page renders "reelify boot ok".

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_main.py README.md
git commit -m "feat: serve Vite build from FastAPI; update setup docs"
```

---

### Task 7: Design tokens, layout grid, and Inter/Geist Mono integration

**Files:**
- Modify: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/app.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace `frontend/src/styles/tokens.css` with the full token sheet**

```css
:root {
  color-scheme: dark;

  --bg: oklch(0.16 0.008 70);
  --bg-2: oklch(0.20 0.010 70);
  --bg-3: oklch(0.24 0.012 70);
  --line: oklch(0.30 0.012 70);
  --line-2: oklch(0.38 0.012 70);
  --fg: oklch(0.96 0.012 80);
  --fg-2: oklch(0.78 0.010 80);
  --fg-3: oklch(0.55 0.010 80);
  --accent: oklch(0.88 0.19 128);
  --accent-deep: oklch(0.55 0.16 130);
  --warn: oklch(0.82 0.15 70);
  --danger: oklch(0.70 0.18 25);
  --info: oklch(0.75 0.10 230);

  --radius-panel: 14px;
  --radius-card: 10px;
  --radius-chip: 4px;
  --radius-pill: 999px;
}

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

body {
  background:
    radial-gradient(1200px 700px at 70% -10%, oklch(0.24 0.04 130 / 0.18), transparent 60%),
    radial-gradient(900px 600px at -10% 110%, oklch(0.22 0.02 60 / 0.5), transparent 60%),
    var(--bg);
  color: var(--fg);
  font-family: "Inter", system-ui, sans-serif;
  font-feature-settings: "cv11", "ss01";
  overflow-x: hidden;
}

.mono {
  font-family: "Geist Mono", ui-monospace, monospace;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 2: Create `frontend/src/styles/app.module.css`**

```css
.app {
  max-width: 1440px;
  margin: 0 auto;
  padding: 22px 28px 28px;
}

.grid {
  margin-top: 22px;
  display: grid;
  grid-template-columns: 320px 1fr 380px;
  gap: 18px;
  align-items: stretch;
}

@media (max-width: 1180px) {
  .grid { grid-template-columns: 1fr; }
}

.rightColumn {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.panel {
  background: linear-gradient(180deg, var(--bg-2), oklch(0.18 0.008 70));
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  padding: 18px;
  position: relative;
}

.panelFlush {
  composes: panel;
  padding: 0;
  overflow: hidden;
}
```

- [ ] **Step 3: Update `frontend/src/App.tsx` to lay out the grid**

```tsx
import styles from "./styles/app.module.css";

export default function App() {
  return (
    <div className={styles.app}>
      <header style={{ height: 60, borderBottom: "1px solid var(--line)" }}>
        header placeholder
      </header>
      <div className={styles.grid}>
        <section className={styles.panel}>configure</section>
        <section className={styles.panelFlush}>pipeline</section>
        <div className={styles.rightColumn}>
          <section className={styles.panel}>scripts</section>
          <section className={styles.panelFlush}>terminal</section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build to verify**

```bash
cd frontend && npm run build
```

Expected: clean build. Open in browser via `python main.py`; verify the three-column grid and warm background gradients render.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): add design tokens and three-column layout shell"
```

---

### Task 8: Event types and SSE store (reducer + Context)

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/state/store.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/types.ts`**

```ts
export type Tone = "Punchy" | "Story-led" | "Analytical" | "Educational";

export type Stage = "idle" | "scraping" | "parsing" | "generating" | "done";

export interface Post {
  id: string;
  author: string;
  role: string;
  body: string;
  h: number;
}

export interface Script {
  id: string;
  title: string;
  hook: string;
  dur: number;
  sceneCount: number;
  tags: string[];
  body: string;
}

export interface LogLine {
  t: string;
  tag: string;
  level: "info" | "ok" | "warn";
  msg: string;
}

// Raw backend event shape (current contract).
export interface RawEvent {
  type: string;
  agent: string;
  message: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
```

- [ ] **Step 2: Create `frontend/src/api.ts`**

```ts
import type { Tone } from "./types";

export async function startRun(num_posts: number, tone: Tone): Promise<void> {
  const res = await fetch("/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ num_posts, tone }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Run failed: ${res.status}`);
  }
}

export async function stopRun(): Promise<void> {
  await fetch("/stop", { method: "POST" });
}

export function subscribe(onEvent: (e: MessageEvent) => void): EventSource {
  const es = new EventSource("/stream");
  es.onmessage = onEvent;
  return es;
}
```

- [ ] **Step 3: Create `frontend/src/state/store.tsx`**

This is the central reducer — translates raw events into the state shape the design needs.

```tsx
import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef,
  type ReactNode,
} from "react";
import { subscribe } from "../api";
import type {
  LogLine, Post, RawEvent, Script, Stage, Tone,
} from "../types";

interface RunState {
  count: number;
  tone: Tone;
  stage: Stage;
  posts: Post[];           // most-recent 12 (rolling buffer)
  flying: string;          // id of currently flying-out post
  scripts: Script[];
  logLines: LogLine[];
  scrapedCount: number;
  totalPosts: number;
}

type Action =
  | { type: "SET_COUNT"; n: number }
  | { type: "SET_TONE"; tone: Tone }
  | { type: "RESET" }
  | { type: "EVENT"; ev: RawEvent };

const initial: RunState = {
  count: 10,
  tone: "Punchy",
  stage: "idle",
  posts: [],
  flying: "",
  scripts: [],
  logLines: [],
  scrapedCount: 0,
  totalPosts: 0,
};

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function timeStamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const cs = String(Math.floor(d.getMilliseconds() / 10)).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${cs}`;
}

function deriveScript(raw: RawEvent): Script | null {
  const s = raw.payload?.script as Record<string, unknown> | undefined;
  if (!s) return null;
  const idx = (raw.payload?.post_index as number | undefined) ?? 0;
  const body = String(s.script ?? "");
  const hook = String(s.hook ?? "");
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const dur = Math.max(15, Math.min(60, Math.round(wordCount / 2.5)));
  const sceneCount = Math.max(3, Math.min(6, body.split(/\n/).filter(Boolean).length || 4));
  const hashtags = (s.hashtags as string[] | undefined) ?? [];
  return {
    id: `script-${idx}`,
    title: hook.length > 60 ? hook.slice(0, 58) + "…" : hook,
    hook: `"${hook}"`,
    dur,
    sceneCount,
    tags: hashtags.slice(0, 4).map((t) => `#${t.replace(/^#/, "")}`),
    body,
  };
}

function derivePost(raw: RawEvent): Post | null {
  const p = raw.payload?.post as Record<string, unknown> | undefined;
  if (!p) return null;
  const author = String(p.author ?? "Unknown");
  const text = String(p.text_content ?? "");
  const idx = raw.payload?.index ?? raw.timestamp;
  return {
    id: `post-${idx}`,
    author,
    role: "saved post",
    body: text.length > 82 ? text.slice(0, 80) + "…" : text,
    h: hashHue(author),
  };
}

function logFromEvent(raw: RawEvent): LogLine | null {
  const t = timeStamp(raw.timestamp);
  switch (raw.type) {
    case "orchestrator_start":
      return { t, tag: "boot", level: "info", msg: raw.message };
    case "scraper_login":
      return { t, tag: "auth", level: "info", msg: raw.message };
    case "scraper_verification":
      return { t, tag: "auth", level: "warn", msg: raw.message };
    case "scraper_navigating":
      return { t, tag: "nav", level: "info", msg: raw.message };
    case "scraper_scrolling":
      return { t, tag: "scroll", level: "info", msg: raw.message };
    case "scraper_done":
      return { t, tag: "parse", level: "ok", msg: raw.message };
    case "post_scraped":
      return { t, tag: "post", level: "info", msg: raw.message };
    case "content_generating":
      return { t, tag: "gen", level: "info", msg: raw.message };
    case "content_ready":
      return { t, tag: "write", level: "ok", msg: raw.message };
    case "content_error":
      return { t, tag: "gen", level: "warn", msg: raw.message };
    case "orchestrator_complete":
      return { t, tag: "done", level: "ok", msg: raw.message };
    case "error":
      return { t, tag: "err", level: "warn", msg: raw.message };
    case "stage_changed":
      return null; // stage changes drive UI directly, not the log
    default:
      return { t, tag: raw.agent.slice(0, 6), level: "info", msg: raw.message };
  }
}

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "SET_COUNT":
      return { ...state, count: action.n };
    case "SET_TONE":
      return { ...state, tone: action.tone };
    case "RESET":
      return {
        ...state,
        stage: "idle",
        posts: [],
        flying: "",
        scripts: [],
        logLines: [],
        scrapedCount: 0,
        totalPosts: 0,
      };
    case "EVENT": {
      const { ev } = action;
      const next: RunState = { ...state };
      const log = logFromEvent(ev);
      if (log) next.logLines = [...state.logLines, log].slice(-200);

      switch (ev.type) {
        case "orchestrator_start": {
          const total = Number(ev.payload?.num_posts ?? state.count);
          return {
            ...next,
            stage: "scraping",
            scrapedCount: 0,
            totalPosts: total,
            posts: [],
            scripts: [],
            flying: "",
          };
        }
        case "stage_changed": {
          const stage = String(ev.payload?.stage ?? "idle") as Stage;
          return { ...next, stage };
        }
        case "post_scraped": {
          const post = derivePost(ev);
          if (!post) return next;
          const previousFly = state.posts[state.posts.length - 1]?.id ?? "";
          const trimmed = state.posts.length >= 4 ? state.posts.slice(1) : state.posts;
          return {
            ...next,
            scrapedCount: state.scrapedCount + 1,
            posts: [...trimmed, post],
            flying: previousFly,
          };
        }
        case "content_ready": {
          const script = deriveScript(ev);
          if (!script) return next;
          return {
            ...next,
            scripts: [script, ...state.scripts].slice(0, 30),
          };
        }
        case "orchestrator_complete":
          return { ...next, stage: "done" };
        default:
          return next;
      }
    }
    default:
      return state;
  }
}

interface StoreCtx {
  state: RunState;
  dispatch: React.Dispatch<Action>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    sourceRef.current = subscribe((m) => {
      try {
        const ev = JSON.parse(m.data) as RawEvent;
        dispatch({ type: "EVENT", ev });
      } catch {
        /* keep-alive comment frame */
      }
    });
    return () => sourceRef.current?.close();
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
```

- [ ] **Step 4: Wrap `App` in `StoreProvider`**

Update `frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./state/store";
import "./styles/tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);
```

- [ ] **Step 5: Build and verify**

```bash
cd frontend && npm run build
```

Expected: build passes; no TS errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): typed event reducer + SSE store"
```

---

### Task 9: Icons module

**Files:**
- Create: `frontend/src/icons.tsx`

- [ ] **Step 1: Create the inline-SVG icon set**

```tsx
import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const Bookmark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3h12v18l-6-4-6 4z" /></svg>
);

export const Play = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M8 5v14l11-7z" /></svg>
);

export const Chev = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
);

export const Spark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" /></svg>
);

export const Bell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
);

export const Gear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4.9a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-.9-2 3.5L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.5 2.4-.9a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4.9 2-3.5-2-1.5c.1-.3.1-.7.1-1z" /></svg>
);
```

- [ ] **Step 2: Build**

```bash
cd frontend && npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/icons.tsx
git commit -m "feat(ui): add inline SVG icon set"
```

---

### Task 10: Header component (brand + status pill + icon buttons)

**Files:**
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/Header.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/components/Header.module.css`**

```css
.top {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brandMark {
  width: 34px;
  height: 34px;
  position: relative;
  border-radius: 8px;
  background: linear-gradient(140deg, var(--accent), var(--accent-deep));
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 1px oklch(0.92 0.18 130 / 0.4), 0 6px 24px oklch(0.88 0.19 128 / 0.25);
}

.brandMark::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(90deg, transparent 0 3px, oklch(0 0 0 / 0.1) 3px 4px);
  mix-blend-mode: overlay;
  opacity: 0.6;
}

.brandMark svg {
  width: 18px;
  height: 18px;
  color: oklch(0.18 0.02 130);
  position: relative;
  z-index: 1;
}

.brandName {
  font-weight: 700;
  letter-spacing: -0.01em;
  font-size: 18px;
}

.brandSub {
  color: var(--fg-3);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: "Geist Mono", monospace;
}

.spacer { flex: 1; }

.statusPill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-2);
  background: var(--bg-2);
  font-family: "Geist Mono", monospace;
  font-size: 12px;
  color: var(--fg-2);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fg-3);
}

.dot.live {
  background: var(--accent);
  color: var(--accent);
  animation: ping 1.6s ease-out infinite;
}

@keyframes ping {
  0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  80%  { box-shadow: 0 0 0 8px transparent; opacity: 0.6; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}

.iconBtn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--line-2);
  background: var(--bg-2);
  display: grid;
  place-items: center;
  color: var(--fg-2);
  cursor: pointer;
}

.iconBtn:hover {
  color: var(--fg);
  border-color: var(--accent);
}
```

- [ ] **Step 2: Create `frontend/src/components/Header.tsx`**

```tsx
import { useStore } from "../state/store";
import { Bell, Gear, Play } from "../icons";
import styles from "./Header.module.css";

const STATUS_LABEL: Record<string, string> = {
  idle:       "Idle · agent ready",
  scraping:   "Live · scraping saved posts",
  parsing:    "Live · parsing content",
  generating: "Live · generating scripts",
};

export default function Header() {
  const { state } = useStore();
  const live = state.stage !== "idle" && state.stage !== "done";
  const label =
    state.stage === "done"
      ? `Run complete · ${state.scripts.length} scripts ready`
      : STATUS_LABEL[state.stage] ?? "Idle · agent ready";

  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <Play />
        </div>
        <div>
          <div className={styles.brandName}>Reelify</div>
          <div className={styles.brandSub}>saved · posts → reels</div>
        </div>
      </div>
      <div className={styles.spacer} />
      <div className={styles.statusPill} role="status" aria-live="polite">
        <span className={`${styles.dot} ${live ? styles.live : ""}`} />
        {label}
      </div>
      <button className={styles.iconBtn} aria-label="Notifications">
        <Bell />
      </button>
      <button className={styles.iconBtn} aria-label="Settings">
        <Gear />
      </button>
    </header>
  );
}
```

- [ ] **Step 3: Wire Header into App**

```tsx
import styles from "./styles/app.module.css";
import Header from "./components/Header";

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.grid}>
        <section className={styles.panel}>configure</section>
        <section className={styles.panelFlush}>pipeline</section>
        <div className={styles.rightColumn}>
          <section className={styles.panel}>scripts</section>
          <section className={styles.panelFlush}>terminal</section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build and visually verify**

```bash
cd frontend && npm run build
```

Run `python main.py`, open http://localhost:8000. Confirm: lime brand mark, status pill says "Idle · agent ready", bell + gear icons render with hover.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): Header with brand, status pill, icon buttons"
```

---

### Task 11: Configure panel — source card, dropdown, tone chips, run/stop button, quotas

**Files:**
- Create: `frontend/src/components/ConfigurePanel.tsx`
- Create: `frontend/src/components/ConfigurePanel.module.css`
- Create: `frontend/src/components/Dropdown.tsx`
- Create: `frontend/src/components/Dropdown.module.css`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/api.ts` (already has startRun/stopRun)

- [ ] **Step 1: Create `frontend/src/components/Dropdown.module.css`**

```css
.wrapper { position: relative; }

.trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-card);
  color: var(--fg);
  font-family: "Geist Mono", monospace;
  cursor: pointer;
}

.trigger:disabled { cursor: not-allowed; opacity: 0.6; }

.value {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.value .n {
  font-size: 16px;
  font-weight: 600;
}

.value .meta {
  font-size: 12px;
  color: var(--fg-3);
}

.chev { transition: transform 0.18s ease; }
.chev.open { transform: rotate(180deg); }

.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 10;
  background: oklch(0.22 0.010 70);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-card);
  box-shadow: 0 16px 40px oklch(0 0 0 / 0.5);
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.opt {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  font-family: "Geist Mono", monospace;
  font-size: 12px;
  color: var(--fg-2);
  cursor: pointer;
}

.opt:hover { background: var(--bg-3); color: var(--fg); }
.opt.selected { color: var(--accent); }

.opt .n { font-size: 13px; font-weight: 600; }
.opt .est { color: var(--fg-3); }
```

- [ ] **Step 2: Create `frontend/src/components/Dropdown.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Chev } from "../icons";
import styles from "./Dropdown.module.css";

export interface DropdownOption {
  n: number;
  label: string;
  est: string;
}

interface Props {
  value: number;
  options: DropdownOption[];
  disabled?: boolean;
  onChange: (n: number) => void;
}

export default function Dropdown({ value, options, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.n === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.value}>
          <span className={styles.n}>{current.n}</span>
          <span className={styles.meta}>posts · {current.est}</span>
        </span>
        <Chev className={`${styles.chev} ${open ? styles.open : ""}`} />
      </button>
      {open && (
        <ul className={styles.menu} role="listbox">
          {options.map((o) => (
            <li
              key={o.n}
              role="option"
              aria-selected={o.n === value}
              className={`${styles.opt} ${o.n === value ? styles.selected : ""}`}
              onClick={() => { onChange(o.n); setOpen(false); }}
            >
              <span className={styles.n}>{o.n}</span>
              <span className={styles.est}>{o.est}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ConfigurePanel.module.css`**

```css
.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
  margin-bottom: 14px;
}

.titleBadge {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: grid;
  place-items: center;
  background: var(--bg-3);
  color: var(--fg-2);
  font-size: 10px;
}

.sectionLabel {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-3);
  margin: 14px 0 6px;
}

.source {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-card);
}

.sourceIcon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: oklch(0.30 0.04 130 / 0.35);
  color: var(--accent);
  display: grid;
  place-items: center;
}

.sourceText { flex: 1; min-width: 0; }
.sourceTitle { font-size: 14px; font-weight: 600; }
.sourceMeta {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  color: var(--fg-3);
  margin-top: 2px;
}

.sourceDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent);
  animation: ping 1.6s ease-out infinite;
}

.toneGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.toneChip {
  padding: 8px 10px;
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-card);
  font-family: "Geist Mono", monospace;
  font-size: 12px;
  color: var(--fg-2);
  cursor: pointer;
}

.toneChip:hover:not(:disabled) { color: var(--fg); }

.toneChip.selected {
  background: oklch(0.30 0.04 130 / 0.35);
  border-color: var(--accent);
  color: var(--accent);
}

.toneChip:disabled { cursor: not-allowed; opacity: 0.6; }

.runBtn {
  margin-top: 14px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: var(--radius-card);
  background: var(--accent);
  color: oklch(0.18 0.03 130);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: box-shadow 0.2s ease;
}

.runBtn:hover { box-shadow: 0 0 0 4px oklch(0.88 0.19 128 / 0.18); }
.runBtn:active { transform: translateY(1px); }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.quotas {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--line-2);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.quotaLabel {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
  margin-bottom: 4px;
}

.quotaValue {
  font-family: "Geist Mono", monospace;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.bar {
  height: 4px;
  background: var(--bg-3);
  border-radius: 2px;
  overflow: hidden;
}

.barFill { height: 100%; background: var(--accent); }

@keyframes ping {
  0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  80%  { box-shadow: 0 0 0 8px transparent; opacity: 0.6; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}
```

- [ ] **Step 4: Create `frontend/src/components/ConfigurePanel.tsx`**

```tsx
import { startRun, stopRun } from "../api";
import { useStore } from "../state/store";
import type { Tone } from "../types";
import { Bookmark, Spark } from "../icons";
import Dropdown, { type DropdownOption } from "./Dropdown";
import styles from "./ConfigurePanel.module.css";

const POST_COUNT_OPTIONS: DropdownOption[] = [
  { n: 5,   label: "5",   est: "~45s · 1 min" },
  { n: 10,  label: "10",  est: "~1m 30s · 2 min" },
  { n: 15,  label: "15",  est: "~2m 30s · 3 min" },
  { n: 25,  label: "25",  est: "~4m · 5 min" },
  { n: 50,  label: "50",  est: "~8m · 10 min" },
  { n: 100, label: "100", est: "~16m · 20 min" },
];

const TONES: Tone[] = ["Punchy", "Story-led", "Analytical", "Educational"];

export default function ConfigurePanel() {
  const { state, dispatch } = useStore();
  const running = state.stage !== "idle" && state.stage !== "done";

  const onRun = async () => {
    if (running) {
      await stopRun();
      dispatch({ type: "RESET" });
    } else {
      dispatch({ type: "RESET" });
      await startRun(state.count, state.tone);
    }
  };

  return (
    <section style={{
      background: "linear-gradient(180deg, var(--bg-2), oklch(0.18 0.008 70))",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-panel)",
      padding: 18,
    }}>
      <div className={styles.title}>
        <span className={styles.titleBadge}>A</span>
        <span>Configure run</span>
      </div>

      <div className={styles.sectionLabel}>// source</div>
      <div className={styles.source}>
        <div className={styles.sourceIcon}><Bookmark /></div>
        <div className={styles.sourceText}>
          <div className={styles.sourceTitle}>Saved posts</div>
          <div className={styles.sourceMeta}>@you · session ok</div>
        </div>
        <div className={styles.sourceDot} />
      </div>

      <div className={styles.sectionLabel}>// number of posts</div>
      <Dropdown
        value={state.count}
        options={POST_COUNT_OPTIONS}
        disabled={running}
        onChange={(n) => dispatch({ type: "SET_COUNT", n })}
      />

      <div className={styles.sectionLabel}>// reel tone</div>
      <div className={styles.toneGrid}>
        {TONES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={running}
            className={`${styles.toneChip} ${state.tone === t ? styles.selected : ""}`}
            onClick={() => dispatch({ type: "SET_TONE", tone: t })}
          >
            {t}
          </button>
        ))}
      </div>

      <button type="button" className={styles.runBtn} onClick={onRun}>
        {running
          ? <><span className={styles.spinner} /> Stop run</>
          : <><Spark /> {state.stage === "done" ? "Run again" : "Run pipeline"}</>}
      </button>

      <div className={styles.quotas} aria-hidden="true">
        <div>
          <div className={styles.quotaLabel}>Credits</div>
          <div className={styles.quotaValue}>214</div>
          <div className={styles.bar}><div className={styles.barFill} style={{ width: "62%" }} /></div>
        </div>
        <div>
          <div className={styles.quotaLabel}>Storage</div>
          <div className={styles.quotaValue}>1.4gb</div>
          <div className={styles.bar}><div className={styles.barFill} style={{ width: "28%" }} /></div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire into App**

In `frontend/src/App.tsx`, replace the placeholder configure section:

```tsx
import ConfigurePanel from "./components/ConfigurePanel";
...
<ConfigurePanel />
```

(remove the inline `<section>configure</section>` placeholder).

- [ ] **Step 6: Build and visually verify**

```bash
cd frontend && npm run build
```

Run `python main.py`. Confirm: source card, dropdown opens/closes (outside click), tone chips toggle, Run pipeline button starts a run (status pill goes live).

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): configure panel — source, dropdown, tone, run/stop, quotas"
```

---

### Task 12: Pipeline panel shell — stage track, post cards, stats strip

**Files:**
- Create: `frontend/src/components/PipelinePanel.tsx`
- Create: `frontend/src/components/PipelinePanel.module.css`
- Create: `frontend/src/hooks/useCounter.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/hooks/useCounter.ts`**

```ts
import { useEffect, useRef, useState } from "react";

export function useCounter(target: number, durMs = 600): number {
  const [val, setVal] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(initial + (target - initial) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durMs]);

  return val;
}
```

- [ ] **Step 2: Create `frontend/src/components/PipelinePanel.module.css`**

```css
.panel {
  background: linear-gradient(180deg, var(--bg-2), oklch(0.18 0.008 70));
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}

.headTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.headBadge {
  width: 18px; height: 18px;
  border-radius: 4px;
  display: grid; place-items: center;
  background: var(--bg-3); color: var(--fg-2);
  font-size: 10px;
}

.stageTrack {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  color: var(--fg-3);
}

.stageItem {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stageDot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--line-2);
}

.stageItem.active .stageDot {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.stageItem.active { color: var(--fg); }

.stageItem.done .stageDot { background: var(--accent-deep); }
.stageItem.done { color: var(--fg-2); }

.stageGap {
  width: 14px;
  height: 1px;
  background: var(--line-2);
}

.body {
  position: relative;
  height: 460px;
  display: grid;
  grid-template-columns: 1fr 280px 1fr;
}

.body::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(oklch(0.30 0.012 70) 1px, transparent 1px),
    linear-gradient(90deg, oklch(0.30 0.012 70) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(circle at center, black 30%, transparent 75%);
  opacity: 0.25;
  pointer-events: none;
}

.col {
  position: relative;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}

.col.right { align-items: flex-end; }

.colLabel {
  position: absolute;
  top: 12px;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.col.left .colLabel { left: 18px; }
.col.right .colLabel { right: 18px; }

.postCard {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-card);
  padding: 10px 12px;
  transition: transform 0.6s cubic-bezier(.7,0,.3,1), opacity 0.6s cubic-bezier(.7,0,.3,1);
}

.postCard.flying {
  transform: translateX(80%);
  opacity: 0;
}

.postCard.staged { opacity: 0.35; }

.postAvatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(160deg, oklch(0.55 0.10 var(--h, 100)), oklch(0.40 0.06 var(--h, 100)));
}

.postMeta {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  color: var(--fg-3);
}

.postBody { font-size: 12px; color: var(--fg-2); }

.reelCard {
  display: flex;
  gap: 10px;
  width: 220px;
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: 12px;
  padding: 10px;
  opacity: 0;
  transform: translateX(-30%);
  transition: opacity 0.55s ease, transform 0.55s ease;
}

.reelCard.in { opacity: 1; transform: translateX(0); }

.reelThumb {
  width: 40px; height: 56px;
  border-radius: 6px;
  background: linear-gradient(160deg, oklch(0.60 0.12 var(--h, 100)), oklch(0.32 0.04 var(--h, 100)));
  position: relative;
  display: grid;
  place-items: center;
  color: rgba(255,255,255,0.85);
  overflow: hidden;
}

.reelThumb::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.2) 2px 3px);
  mix-blend-mode: overlay;
}

.reelInfo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.reelTitle {
  font-size: 12px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.reelMeta {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  color: var(--fg-3);
}

.reelMeta .dur { color: var(--accent); font-weight: 600; }

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--line);
}

.stat {
  padding: 14px 18px;
  border-right: 1px solid var(--line);
}

.stat:last-child { border-right: 0; }

.statLabel {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-3);
  margin-bottom: 6px;
}

.statValue {
  font-family: "Geist Mono", monospace;
  font-size: 22px;
  font-weight: 600;
}

.statDelta {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  color: var(--accent);
  margin-left: 6px;
}
```

- [ ] **Step 3: Create `frontend/src/components/PipelinePanel.tsx`**

The Core (rings/particles/bulb/connectors) goes into a separate component in Task 13. For now use a placeholder div with the bulb glyph.

```tsx
import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import { useCounter } from "../hooks/useCounter";
import type { Stage } from "../types";
import Core from "./Core";
import styles from "./PipelinePanel.module.css";

const STAGE_LIST: { id: Stage; label: string }[] = [
  { id: "scraping",   label: "01 · Scrape" },
  { id: "parsing",    label: "02 · Parse" },
  { id: "generating", label: "03 · Generate" },
  { id: "done",       label: "04 · Ready" },
];

function stageStatus(current: Stage, candidate: Stage): "idle" | "active" | "done" {
  const order: Stage[] = ["idle", "scraping", "parsing", "generating", "done"];
  const ci = order.indexOf(current);
  const xi = order.indexOf(candidate);
  if (ci === xi) return "active";
  if (ci > xi)  return "done";
  return "idle";
}

export default function PipelinePanel() {
  const { state } = useStore();

  const scraped = useCounter(state.scrapedCount);
  const queued = useCounter(Math.max(0, state.totalPosts - state.scrapedCount));
  const scriptsN = useCounter(state.scripts.length);
  const avgDur = useCounter(
    state.scripts.length
      ? Math.round(state.scripts.reduce((s, x) => s + x.dur, 0) / state.scripts.length)
      : 0
  );

  // Track which post most recently flew out for animation
  const previousFlyingRef = useRef<string>("");
  useEffect(() => { previousFlyingRef.current = state.flying; }, [state.flying]);

  // Animate reel cards in
  const [visibleReels, setVisibleReels] = useState<Set<string>>(new Set());
  useEffect(() => {
    const top4 = state.scripts.slice(0, 4).map((s) => s.id);
    top4.forEach((id, i) => {
      window.setTimeout(() => {
        setVisibleReels((prev) => new Set(prev).add(id));
      }, i * 50);
    });
  }, [state.scripts]);

  const last4 = state.posts.slice(-4);
  const top4Reels = state.scripts.slice(0, 4);

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className={styles.headBadge}>B</span>
          <span>Transform pipeline</span>
        </div>
        <div className={styles.stageTrack}>
          {STAGE_LIST.map((s, i) => {
            const status = stageStatus(state.stage, s.id);
            return (
              <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span className={`${styles.stageItem} ${styles[status] ?? ""}`}>
                  <span className={styles.stageDot} />
                  {s.label}
                </span>
                {i < STAGE_LIST.length - 1 && <span className={styles.stageGap} />}
              </span>
            );
          })}
        </div>
      </div>

      <div className={styles.body}>
        <div className={`${styles.col} ${styles.left}`}>
          <div className={styles.colLabel}>// scraped posts</div>
          {last4.map((p, i) => {
            const isFlying = p.id === state.flying;
            const isStaged = i < last4.length - 1 && !isFlying;
            return (
              <div
                key={p.id}
                className={`${styles.postCard} ${isFlying ? styles.flying : ""} ${isStaged ? styles.staged : ""}`}
                style={{ ["--h" as never]: p.h } as React.CSSProperties}
              >
                <div className={styles.postAvatar} />
                <div style={{ minWidth: 0 }}>
                  <div className={styles.postMeta}>{p.author}</div>
                  <div className={styles.postBody}>{p.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <Core stage={state.stage} />

        <div className={`${styles.col} ${styles.right}`}>
          <div className={styles.colLabel}>// generated reels</div>
          {top4Reels.map((r) => (
            <div
              key={r.id}
              className={`${styles.reelCard} ${visibleReels.has(r.id) ? styles.in : ""}`}
              style={{ ["--h" as never]: 200 } as React.CSSProperties}
            >
              <div className={styles.reelThumb}>▶</div>
              <div className={styles.reelInfo}>
                <div className={styles.reelTitle}>{r.title}</div>
                <div className={styles.reelMeta}>
                  <span className="dur" style={{ color: "var(--accent)" }}>{r.dur}s</span>
                  {" · "}{r.sceneCount} scenes
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Scraped</div>
          <div className={styles.statValue}>
            {Math.round(scraped)}<span style={{ color: "var(--fg-3)" }}> / {state.totalPosts || "–"}</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>In queue</div>
          <div className={styles.statValue}>{Math.round(queued)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Scripts</div>
          <div className={styles.statValue}>
            {Math.round(scriptsN)}
            {state.stage === "generating" && (
              <span className={styles.statDelta}>+{state.scripts.length - Math.round(scriptsN)}</span>
            )}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg duration</div>
          <div className={styles.statValue}>{Math.round(avgDur)}s</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create a temporary placeholder `frontend/src/components/Core.tsx`**

The full Core ships in Task 13. Stub so the build passes:

```tsx
import type { Stage } from "../types";

const LABELS: Record<Stage, { glyph: string; label: string }> = {
  idle:       { glyph: "—", label: "STANDBY" },
  scraping:   { glyph: "↯", label: "SCRAPING" },
  parsing:    { glyph: "↯", label: "PARSING" },
  generating: { glyph: "↯", label: "REELIFY" },
  done:       { glyph: "✓", label: "READY" },
};

export default function Core({ stage }: { stage: Stage }) {
  const { glyph, label } = LABELS[stage];
  return (
    <div style={{
      position: "relative", display: "grid", placeItems: "center",
    }}>
      <div style={{
        width: 110, height: 110, borderRadius: "50%",
        background: "radial-gradient(circle at 30% 30%, oklch(0.55 0.16 130 / 0.7), oklch(0.22 0.02 130) 60%)",
        boxShadow: "0 0 60px oklch(0.88 0.19 128 / 0.25), inset 0 0 30px oklch(0 0 0 / 0.4)",
        display: "grid", placeItems: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)" }}>{glyph}</div>
          <div style={{
            fontFamily: "Geist Mono, monospace", fontSize: 11,
            letterSpacing: "0.08em", color: "var(--accent)",
            textShadow: "0 0 6px var(--accent)",
          }}>{label}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire PipelinePanel into App**

```tsx
import PipelinePanel from "./components/PipelinePanel";
...
<PipelinePanel />
```

- [ ] **Step 6: Build and visually verify**

```bash
cd frontend && npm run build
```

Run a pipeline. Verify: stage track lights up per stage, posts appear left, reels appear right, stats animate.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): pipeline panel shell — stage track, post/reel cards, stats"
```

---

### Task 13: Animated Core — rings, particles, bulb, connectors

**Files:**
- Modify: `frontend/src/components/Core.tsx`
- Create: `frontend/src/components/Core.module.css`
- Create: `frontend/src/hooks/useReducedMotion.ts`

- [ ] **Step 1: Create `frontend/src/hooks/useReducedMotion.ts`**

```ts
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
```

- [ ] **Step 2: Create `frontend/src/components/Core.module.css`**

```css
.wrap {
  position: relative;
  display: grid;
  place-items: center;
  overflow: visible;
}

.connector {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.connector path {
  fill: none;
  stroke: oklch(0.35 0.02 70);
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
}

.connector path.live {
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-dasharray: 6 8;
  filter: drop-shadow(0 0 4px var(--accent));
  animation: flow 1.4s linear infinite;
}

@keyframes flow {
  to { stroke-dashoffset: -28; }
}

.rings {
  position: absolute;
  width: 240px;
  height: 240px;
}

.ring {
  position: absolute;
  inset: 0;
  border: 1px solid var(--line-2);
  border-radius: 50%;
}

.r1 { inset: 20px; }
.r2 { inset: 50px; border-style: dashed; }
.r3 { inset: 80px; }

.spin1 { animation: spin1 18s linear infinite; }
.spin2 { animation: spin2 14s linear infinite reverse; }
.spin3 { animation: spin3 10s linear infinite; }

@keyframes spin1 { to { transform: rotate(360deg); } }
@keyframes spin2 { to { transform: rotate(-360deg); } }
@keyframes spin3 { to { transform: rotate(360deg); } }

.ringTick {
  position: absolute;
  left: 50%;
  width: 2px;
  height: 8px;
  background: var(--line-2);
  transform-origin: center calc(50% + 0px);
}

.ringTick.accent {
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}

.particles {
  position: absolute;
  width: 240px;
  height: 240px;
  pointer-events: none;
}

.particles circle {
  fill: var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
  transition: opacity 0.3s ease;
}

.bulb {
  position: relative;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, oklch(0.92 0.18 130 / 0.55), transparent 50%),
    radial-gradient(circle at 70% 70%, oklch(0.55 0.16 130 / 0.45), transparent 55%),
    oklch(0.22 0.02 130);
  box-shadow:
    0 0 60px oklch(0.88 0.19 128 / 0.25),
    inset 0 0 30px oklch(0 0 0 / 0.4);
  display: grid;
  place-items: center;
}

.bulb::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--accent);
  animation: pulse 3s ease-out infinite;
}

@keyframes pulse {
  0%   { transform: scale(0.7); opacity: 0.9; }
  100% { transform: scale(1.4); opacity: 0; }
}

.glyph { text-align: center; }
.glyph .big { font-size: 22px; font-weight: 700; color: var(--fg); }
.glyph .lbl {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: 0 0 6px var(--accent);
}
```

- [ ] **Step 3: Rewrite `frontend/src/components/Core.tsx` with the full animation**

```tsx
import { useEffect, useRef } from "react";
import type { Stage } from "../types";
import { useReducedMotion } from "../hooks/useReducedMotion";
import styles from "./Core.module.css";

const LABELS: Record<Stage, { glyph: string; label: string }> = {
  idle:       { glyph: "—", label: "STANDBY" },
  scraping:   { glyph: "↯", label: "SCRAPING" },
  parsing:    { glyph: "↯", label: "PARSING" },
  generating: { glyph: "↯", label: "REELIFY" },
  done:       { glyph: "✓", label: "READY" },
};

interface Particle {
  phase: number;
  radius: number;
  speed: number;
}

const PARTICLES: Particle[] = Array.from({ length: 9 }, (_, i) => ({
  phase: (i * 2 * Math.PI) / 9 + Math.random(),
  radius: 50 + Math.random() * 50,
  speed: 0.4 + Math.random() * 0.6,
}));

const TICK_ANGLES = [0, 90, 180, 270];

function leftPaths(): string[] {
  // 5 bezier paths from (x=-20, varying y) curving toward center
  return [-60, -30, 0, 30, 60].map((y) =>
    `M -20 ${120 + y} C 60 ${120 + y * 0.4}, 100 120, 140 120`
  );
}

function rightPaths(): string[] {
  return [-60, -30, 0, 30, 60].map((y) =>
    `M 140 120 C 180 120, 220 ${120 + y * 0.4}, 300 ${120 + y}`
  );
}

export default function Core({ stage }: { stage: Stage }) {
  const { glyph, label } = LABELS[stage];
  const running = stage !== "idle" && stage !== "done";
  const reduced = useReducedMotion();
  const particleRefs = useRef<Array<SVGCircleElement | null>>([]);
  const rafRef = useRef(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    if (reduced) return;
    const tick = (now: number) => {
      const dt = (now - startRef.current) / 1000;
      const cx = 120, cy = 120;
      const speedMul = running ? 1.2 : 0.25;
      PARTICLES.forEach((p, i) => {
        const a = p.phase + dt * p.speed * speedMul;
        const x = cx + Math.cos(a) * p.radius;
        const y = cy + Math.sin(a) * p.radius * 0.95;
        const el = particleRefs.current[i];
        if (el) {
          el.setAttribute("cx", String(x));
          el.setAttribute("cy", String(y));
          el.setAttribute("opacity", running ? "0.85" : "0.35");
        }
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, reduced]);

  return (
    <div className={styles.wrap}>
      <svg className={styles.connector} viewBox="0 0 300 240" preserveAspectRatio="none">
        {leftPaths().map((d, i) => (
          <path key={`l-${i}`} d={d} className={running ? "live" : ""} style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
        {rightPaths().map((d, i) => (
          <path key={`r-${i}`} d={d} className={running ? "live" : ""} style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </svg>

      <div className={styles.rings}>
        <div className={`${styles.ring} ${reduced ? "" : styles.spin1}`}>
          {TICK_ANGLES.map((a, i) => (
            <span
              key={a}
              className={`${styles.ringTick} ${i === 0 ? styles.accent : ""}`}
              style={{ transform: `translateX(-50%) rotate(${a}deg) translateY(-120px)` }}
            />
          ))}
        </div>
        <div className={`${styles.ring} ${styles.r1} ${reduced ? "" : styles.spin2}`} />
        <div className={`${styles.ring} ${styles.r2} ${reduced ? "" : styles.spin3}`} />
        <div className={`${styles.ring} ${styles.r3}`} />
      </div>

      <svg className={styles.particles} viewBox="0 0 240 240">
        {PARTICLES.map((_, i) => (
          <circle
            key={i}
            ref={(el) => { particleRefs.current[i] = el; }}
            r="2.4"
            cx="120"
            cy="120"
            opacity="0.35"
          />
        ))}
      </svg>

      <div className={styles.bulb}>
        <div className={styles.glyph}>
          <div className="big">{glyph}</div>
          <div className="lbl">{label}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build and visually verify**

```bash
cd frontend && npm run build
```

Run a pipeline. Confirm: 4 concentric rings (one ticked, one dashed), 9 particles orbit the bulb, accent connector lines flow during a run, bulb pulse-ring expands every 3s, glyph + label change per stage.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): animated core — rings, particles, bulb, flowing connectors"
```

---

### Task 14: Scripts panel (right column top)

**Files:**
- Create: `frontend/src/components/ScriptsPanel.tsx`
- Create: `frontend/src/components/ScriptsPanel.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/components/ScriptsPanel.module.css`**

```css
.panel {
  background: linear-gradient(180deg, var(--bg-2), oklch(0.18 0.008 70));
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  padding: 18px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.headTitle { display: flex; align-items: center; gap: 8px; }

.headBadge {
  width: 18px; height: 18px;
  border-radius: 4px;
  display: grid; place-items: center;
  background: var(--bg-3); color: var(--fg-2);
  font-size: 10px;
}

.empty {
  padding: 30px 16px;
  text-align: center;
  color: var(--fg-3);
  font-size: 13px;
}

.empty .label {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-2);
  margin-bottom: 6px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow-y: auto;
}

.list::-webkit-scrollbar { width: 6px; }
.list::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 3px; }

.card {
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-card);
  padding: 12px;
  opacity: 0;
  transform: translateY(8px);
  animation: enter 0.45s cubic-bezier(.4, 0, .2, 1) forwards;
}

@keyframes enter { to { opacity: 1; transform: translateY(0); } }

.row1 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.idx {
  width: 22px; height: 22px;
  border-radius: 4px;
  background: oklch(0.30 0.04 130 / 0.5);
  color: var(--accent);
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  display: grid; place-items: center;
}

.title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dur {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  padding: 2px 6px;
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: 4px;
}

.hook {
  margin-top: 8px;
  font-size: 11px;
  font-style: italic;
  color: var(--fg-2);
  line-height: 1.4;
  background: oklch(0.20 0.01 70);
  border-left: 2px solid var(--accent);
  border-radius: 0 6px 6px 0;
  padding: 8px 10px;
}

.scenes {
  display: flex;
  gap: 2px;
  margin-top: 8px;
}

.sceneBar {
  flex: 1;
  height: 3px;
  background: var(--bg);
  border-radius: 2px;
  overflow: hidden;
}

.sceneBar i {
  display: block;
  height: 100%;
  background: var(--accent-deep);
}

.sceneBar.hl i { background: var(--accent); }

.tags {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.tag {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  color: var(--fg-3);
  padding: 2px 6px;
  border: 1px solid var(--line-2);
  border-radius: 4px;
}
```

- [ ] **Step 2: Create `frontend/src/components/ScriptsPanel.tsx`**

```tsx
import { useStore } from "../state/store";
import styles from "./ScriptsPanel.module.css";

export default function ScriptsPanel() {
  const { state } = useStore();

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className={styles.headBadge}>C</span>
          <span>Reel scripts</span>
        </div>
        <span>{state.scripts.length} ready</span>
      </div>

      {state.scripts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.label}>No scripts yet</div>
          Press <span style={{ color: "var(--accent)" }}>Run pipeline</span> to generate from saved posts.
        </div>
      ) : (
        <div className={styles.list}>
          {state.scripts.map((s, i) => {
            const widths = Array.from({ length: s.sceneCount }, (_, k) => 50 + ((k * 17 + s.id.length * 3) % 50));
            return (
              <article
                key={s.id}
                className={styles.card}
                style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
              >
                <div className={styles.row1}>
                  <span className={styles.idx}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.title}>{s.title}</span>
                  <span className={styles.dur}>{s.dur}s</span>
                </div>
                <div className={styles.hook}>{s.hook}</div>
                <div className={styles.scenes}>
                  {widths.map((w, k) => (
                    <span key={k} className={`${styles.sceneBar} ${k === 0 ? styles.hl : ""}`}>
                      <i style={{ width: `${w}%` }} />
                    </span>
                  ))}
                </div>
                <div className={styles.tags}>
                  {s.tags.map((t) => (
                    <span key={t} className={styles.tag}>{t}</span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Wire into App**

```tsx
import ScriptsPanel from "./components/ScriptsPanel";
...
<ScriptsPanel />
```

- [ ] **Step 4: Build and visually verify**

```bash
cd frontend && npm run build
```

Run a pipeline. Verify the empty state, then live-entering script cards with hook block, scene bars, and tags.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): reel scripts panel with entry animation"
```

---

### Task 15: Playwright terminal panel

**Files:**
- Create: `frontend/src/components/Terminal.tsx`
- Create: `frontend/src/components/Terminal.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/components/Terminal.module.css`**

```css
.panel {
  background: linear-gradient(180deg, var(--bg-2), oklch(0.18 0.008 70));
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  height: 200px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.dots { display: flex; gap: 4px; margin-right: 8px; }
.dots i {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--line-2);
}
.dots i:nth-child(1) { background: oklch(0.65 0.18 25); }
.dots i:nth-child(2) { background: oklch(0.78 0.14 80); }
.dots i:nth-child(3) { background: oklch(0.70 0.15 145); }

.spacer { flex: 1; }

.body {
  flex: 1;
  overflow: auto;
  padding: 10px 14px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  line-height: 1.55;
  color: var(--fg-2);
}

.body::-webkit-scrollbar { width: 6px; }
.body::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 3px; }

.line {
  display: flex;
  gap: 10px;
  opacity: 0;
  animation: logIn 0.2s ease forwards;
}

@keyframes logIn { to { opacity: 1; } }

.line .t { color: var(--fg-3); flex-shrink: 0; }
.line .tag {
  flex-shrink: 0;
  width: 60px;
  color: var(--fg-3);
}

.line.info .tag { color: oklch(0.75 0.10 230); }
.line.ok   .tag { color: var(--accent); }
.line.warn .tag { color: oklch(0.82 0.15 70); }

.line .msg { color: var(--fg); }

.idle { color: var(--fg-2); }

.cursor {
  display: inline-block;
  width: 7px;
  height: 12px;
  background: var(--accent);
  vertical-align: -2px;
  animation: blink 1s steps(2) infinite;
}

@keyframes blink { 50% { opacity: 0; } }
```

- [ ] **Step 2: Create `frontend/src/components/Terminal.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import styles from "./Terminal.module.css";

export default function Terminal() {
  const { state } = useStore();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [state.logLines.length]);

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.dots}>
          <i /><i /><i />
        </div>
        <span>playwright · agent.log</span>
        <div className={styles.spacer} />
        <span>{state.logLines.length} lines</span>
      </div>
      <div className={styles.body} ref={bodyRef}>
        {state.logLines.length === 0 ? (
          <div className={styles.idle}>
            $ reelify --watch <span className={styles.cursor} />
          </div>
        ) : (
          state.logLines.map((l, i) => (
            <div key={i} className={`${styles.line} ${styles[l.level] ?? ""}`}>
              <span className="t">{l.t}</span>
              <span className="tag">[{l.tag}]</span>
              <span className="msg">{l.msg}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire into App, finalising App.tsx**

```tsx
import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";
import PipelinePanel from "./components/PipelinePanel";
import ScriptsPanel from "./components/ScriptsPanel";
import Terminal from "./components/Terminal";

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <PipelinePanel />
        <div className={styles.rightColumn}>
          <ScriptsPanel />
          <Terminal />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build and visually verify**

```bash
cd frontend && npm run build
```

Run a pipeline. Verify: idle state shows `$ reelify --watch` with blinking cursor; during a run log lines stream in (info/ok/warn coloured tags); auto-scroll keeps the newest line in view; line count in header updates.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): playwright terminal with streamed log lines"
```

---

### Task 16: Remove legacy dashboard + final integration smoke test

**Files:**
- Delete: `dashboard/index.html`
- Delete: `dashboard/.gitkeep`
- Modify: README at root if it still references old paths
- Verify: end-to-end run

- [ ] **Step 1: Remove the legacy dashboard files**

```bash
git rm dashboard/index.html dashboard/.gitkeep
rmdir dashboard 2>/dev/null || true
```

- [ ] **Step 2: Run full backend test suite**

```bash
pytest -v
```

Expected: all green.

- [ ] **Step 3: Build the frontend**

```bash
cd frontend && npm run build && cd ..
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Manual end-to-end smoke test**

In one terminal: `python main.py`
In a browser: open http://localhost:8000.

Check every item:
- Header brand mark + status pill render
- Configure panel: source card visible, dropdown opens & closes on outside click, tone chips toggle, Run pipeline triggers run
- During run: status pill becomes "Live · …" with pulsing dot, stage track progresses, post cards stream in from the left (with `.flying` translateX exit), core particles speed up, connector lines animate, scripts appear in scripts panel with entry stagger, terminal streams log lines with correct level colours, stats counters animate
- Stop run cancels mid-flight (verify in the terminal where uvicorn is running — the orchestrator should print a CancelledError)
- After done: button label becomes "Run again", status pill shows "Run complete · N scripts ready"
- Resize the window below 1180px: layout collapses to a single column

Document any deviation as a follow-up bug before claiming success (per `superpowers:verification-before-completion`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy dashboard; full Reelify redesign live"
```

---

## Self-Review

**1. Spec coverage check:**
- Header (brand + status pill + bell + gear) → Task 10 ✓
- Configure panel (source, count dropdown, tone chips, run, quotas) → Task 11 ✓
- Pipeline panel (stage track, post cards, core, reel cards, stats) → Tasks 12-13 ✓
- Reel scripts panel → Task 14 ✓
- Playwright terminal → Task 15 ✓
- Tone wired through backend → Tasks 1-2 ✓
- Stop endpoint + cancellation → Task 3 ✓
- Stage events → Task 4 ✓
- Reduced-motion handling → Task 7 (CSS) + Task 13 (JS) ✓
- Layout grid + responsive collapse → Task 7 ✓

**2. Placeholder scan:**
- No "TBD", "implement later", or vague "add validation" steps.
- All test/code blocks contain the full content.

**3. Type consistency:**
- `RunRequest.tone` is `Tone` literal in models.py and main.py.
- `orchestrator.run(num_posts, tone)` and `content.run(post, idx, tone)` signatures consistent.
- Frontend `Tone`, `Stage`, `RawEvent`, `Post`, `Script`, `LogLine` defined once in `types.ts` and reused.
- `dispatch({ type: "EVENT", ev })` shape matches the reducer's `Action` union.

**4. Notes / known limitations:**
- Backend emits the existing event names (`post_scraped`, `content_ready`, etc.) plus the new `stage_changed`. The frontend reducer translates this to the design's domain (`stage:*`, `post:*`, `script:*`, `log:*`). This keeps backwards compatibility with any other consumers and avoids touching the scraper agent.
- The `parsing` stage is shown briefly on the stage track if/when the backend transitions through it, but the orchestrator currently emits `scraping → generating → done`. Adding a discrete parsing step is a follow-up if/when LinkedIn HTML parsing becomes its own service.
- Quotas are decorative per spec; static values match the prototype.
- Cancellation works at task-boundary granularity (Playwright awaits get a CancelledError when the task is cancelled). The scraper's async-with auto-closes the browser on cancel.
