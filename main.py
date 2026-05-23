import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

import config  # noqa: F401 — validates env vars at import time
from db import store
from events import hub, push
from models import Language, Tone
import orchestrator
import run_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.init_db()
    yield


app = FastAPI(title="LinkedIn Reels Agent", lifespan=lifespan)

_current_task: asyncio.Task | None = None
_regenerate_task: asyncio.Task | None = None

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


@app.get("/stream")
async def stream() -> EventSourceResponse:
    async def generator():
        async with hub.subscribe() as q:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {"data": json.dumps(event)}
                except asyncio.TimeoutError:
                    yield {"comment": "ping"}

    return EventSourceResponse(generator(), ping=0)


class RunRequest(BaseModel):
    num_posts: int = Field(default=5, ge=1, le=100)
    tone: Tone = Field(default="Punchy")
    language: Language = Field(default="en")


class RegenerateRequest(BaseModel):
    tone: Tone | None = None
    language: Language | None = None


class FeedbackRequest(BaseModel):
    rating: str = Field(pattern="^(up|down)$")
    comment: str | None = None


@app.post("/run")
async def run_pipeline(request: RunRequest) -> JSONResponse:
    global _current_task
    if _current_task is not None and not _current_task.done():
        return JSONResponse({"status": "already_running"}, status_code=409)

    run_id = str(uuid4())

    async def run_and_reset():
        try:
            await orchestrator.run(
                request.num_posts,
                request.tone,
                request.language,
                run_id=run_id,
            )
        except asyncio.CancelledError:
            await push({
                "type": "stage_changed",
                "agent": "orchestrator",
                "message": "Pipeline stopped by user",
                "payload": {"stage": "idle", "run_id": run_id},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            store.finish_run(run_id, status="cancelled", cost_usd=0)
            raise
        finally:
            global _current_task
            _current_task = None

    _current_task = asyncio.create_task(run_and_reset())
    return JSONResponse({
        "status": "started",
        "run_id": run_id,
        "num_posts": request.num_posts,
        "tone": request.tone,
        "language": request.language,
    })


@app.get("/runs/{run_id}")
async def get_run(run_id: str) -> JSONResponse:
    row = store.get_run(run_id)
    if not row:
        return JSONResponse({"status": "not_found"}, status_code=404)
    return JSONResponse(row)


@app.get("/runs/{run_id}/steps")
async def get_run_steps(run_id: str, post_index: int | None = None) -> JSONResponse:
    if not store.get_run(run_id):
        return JSONResponse({"status": "not_found"}, status_code=404)
    steps = store.list_steps(run_id, post_index)
    return JSONResponse({"run_id": run_id, "steps": steps})


@app.post("/runs/{run_id}/steps/{step_id}/feedback")
async def post_feedback(
    run_id: str,
    step_id: str,
    body: FeedbackRequest,
    post_index: int | None = None,
) -> JSONResponse:
    if not store.get_run(run_id):
        return JSONResponse({"status": "not_found"}, status_code=404)
    fid = store.insert_feedback(
        run_id=run_id,
        step_id=step_id,
        post_index=post_index,
        rating=body.rating,
        comment=body.comment,
    )
    await push({
        "type": "feedback_recorded",
        "agent": "system",
        "message": f"Feedback recorded ({body.rating})",
        "payload": {
            "run_id": run_id,
            "step_id": step_id,
            "feedback_id": fid,
            "rating": body.rating,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return JSONResponse({"status": "ok", "feedback_id": fid})


@app.post("/regenerate/{post_index}")
async def regenerate_script(
    post_index: int,
    request: RegenerateRequest = RegenerateRequest(),
) -> JSONResponse:
    global _regenerate_task
    if post_index < 0:
        return JSONResponse({"status": "invalid_index"}, status_code=422)
    if _current_task is not None and not _current_task.done():
        return JSONResponse({"status": "pipeline_running"}, status_code=409)
    if run_cache.get_post(post_index) is None:
        return JSONResponse({"status": "not_found"}, status_code=404)
    if _regenerate_task is not None and not _regenerate_task.done():
        return JSONResponse({"status": "regenerate_busy"}, status_code=409)

    async def run_regenerate() -> None:
        try:
            await orchestrator.regenerate(
                post_index,
                request.tone,
                request.language,
            )
        finally:
            global _regenerate_task
            _regenerate_task = None

    _regenerate_task = asyncio.create_task(run_regenerate())
    return JSONResponse({"status": "started", "post_index": post_index})


@app.post("/stop")
async def stop_pipeline() -> JSONResponse:
    global _current_task
    if _current_task is None or _current_task.done():
        return JSONResponse({"status": "idle"})
    _current_task.cancel()
    return JSONResponse({"status": "stopped"})


async def serve() -> None:
    cfg = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="warning")
    server = uvicorn.Server(cfg)
    print("Dashboard running at http://localhost:8000")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(serve())
