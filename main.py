import asyncio
import json
from pathlib import Path

import uvicorn
from fastapi import BackgroundTasks, FastAPI
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
