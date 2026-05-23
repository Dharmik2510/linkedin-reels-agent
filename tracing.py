"""Observable agent steps: SSE + SQLite."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from db import store
from events import push
from run_context import get_budget, get_run_id


async def emit_agent_step(
    *,
    agent: str,
    step: str,
    status: str,
    message: str,
    post_index: int | None = None,
    model: str | None = None,
    cost_usd: float = 0.0,
    duration_ms: int | None = None,
    reasoning_public: str | None = None,
    input_summary: str | None = None,
    output_summary: str | None = None,
    artifact: dict[str, Any] | None = None,
    step_id: str | None = None,
) -> str:
    step_id = step_id or str(uuid4())
    run_id = get_run_id()
    now = datetime.now(timezone.utc).isoformat()

    payload: dict[str, Any] = {
        "run_id": run_id,
        "step_id": step_id,
        "post_index": post_index,
        "step": step,
        "status": status,
        "model": model,
        "cost_usd": round(cost_usd, 6),
        "duration_ms": duration_ms,
        "reasoning_public": reasoning_public,
        "input_summary": input_summary,
        "output_summary": output_summary,
    }
    if artifact is not None:
        payload["artifact"] = artifact

    await push({
        "type": "agent_step",
        "agent": agent,
        "message": message,
        "payload": payload,
        "timestamp": now,
    })

    if run_id:
        store.insert_step(
            run_id=run_id,
            step_id=step_id,
            post_index=post_index,
            agent=agent,
            step=step,
            status=status,
            message=message,
            model=model,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
            reasoning_public=reasoning_public,
            input_summary=input_summary,
            output_summary=output_summary,
            artifact=artifact,
        )
        if cost_usd > 0 and status == "completed":
            store.add_run_cost(run_id, cost_usd)
            budget = get_budget()
            if budget:
                budget.add(cost_usd)

    return step_id


class agent_step_span:
    """Async context manager for started → completed/failed steps."""

    def __init__(
        self,
        *,
        agent: str,
        step: str,
        message: str,
        post_index: int | None = None,
        model: str | None = None,
        input_summary: str | None = None,
    ) -> None:
        self.agent = agent
        self.step = step
        self.message = message
        self.post_index = post_index
        self.model = model
        self.input_summary = input_summary
        self.step_id = ""
        self._t0 = 0.0
        self.cost_usd = 0.0
        self.reasoning_public: str | None = None
        self.output_summary: str | None = None
        self.artifact: dict[str, Any] | None = None

    async def __aenter__(self) -> agent_step_span:
        self._t0 = time.perf_counter()
        self.step_id = await emit_agent_step(
            agent=self.agent,
            step=self.step,
            status="started",
            message=self.message,
            post_index=self.post_index,
            model=self.model,
            input_summary=self.input_summary,
        )
        return self

    async def __aexit__(self, exc_type, exc, _tb) -> None:
        duration_ms = int((time.perf_counter() - self._t0) * 1000)
        if exc_type is not None:
            await emit_agent_step(
                agent=self.agent,
                step=self.step,
                status="failed",
                message=f"{self.message} — {exc}",
                post_index=self.post_index,
                model=self.model,
                cost_usd=self.cost_usd,
                duration_ms=duration_ms,
                step_id=self.step_id,
            )
            return
        await emit_agent_step(
            agent=self.agent,
            step=self.step,
            status="completed",
            message=self.message,
            post_index=self.post_index,
            model=self.model,
            cost_usd=self.cost_usd,
            duration_ms=duration_ms,
            reasoning_public=self.reasoning_public,
            output_summary=self.output_summary,
            artifact=self.artifact,
            step_id=self.step_id,
        )
