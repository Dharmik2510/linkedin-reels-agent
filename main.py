import asyncio
import json
from pathlib import Path

import uvicorn
from fastapi import BackgroundTasks, FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

import config  # noqa: F401 — validates env vars at import time
from events import event_bus
from models import Tone
import orchestrator

app = FastAPI(title="LinkedIn Reels Agent")

_pipeline_running: bool = False

_DASHBOARD_PATH = Path(__file__).parent / "dashboard" / "index.html"
DASHBOARD_HTML: str = _DASHBOARD_PATH.read_text()


@app.get("/")
async def index() -> HTMLResponse:
    return HTMLResponse(DASHBOARD_HTML)


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


async def serve() -> None:
    cfg = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="warning")
    server = uvicorn.Server(cfg)
    print("Dashboard running at http://localhost:8000")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(serve())
