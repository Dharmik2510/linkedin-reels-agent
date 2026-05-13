import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

import config  # noqa: F401 — validates env vars at import time
from events import event_bus, push
from models import Tone
import orchestrator

app = FastAPI(title="LinkedIn Reels Agent")

_current_task: asyncio.Task | None = None

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
        while True:
            try:
                event = await asyncio.wait_for(event_bus.get(), timeout=15.0)
                yield {"data": json.dumps(event)}
            except asyncio.TimeoutError:
                yield {"comment": "ping"}

    return EventSourceResponse(generator(), ping=0)


class RunRequest(BaseModel):
    num_posts: int = Field(default=5, ge=1, le=100)
    tone: Tone = Field(default="Punchy")


@app.post("/run")
async def run_pipeline(request: RunRequest) -> JSONResponse:
    global _current_task
    if _current_task is not None and not _current_task.done():
        return JSONResponse({"status": "already_running"}, status_code=409)

    async def run_and_reset():
        try:
            await orchestrator.run(request.num_posts, request.tone)
        except asyncio.CancelledError:
            await push({
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


async def serve() -> None:
    cfg = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="warning")
    server = uvicorn.Server(cfg)
    print("Dashboard running at http://localhost:8000")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(serve())
