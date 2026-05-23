"""Anthropic LLM wrapper with rough cost accounting."""

from __future__ import annotations

import json
from typing import Any

import anthropic

import config

# USD per 1M tokens (approximate; tune from Anthropic pricing page)
_PRICING: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (0.8, 4.0),
}

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    inp_m, out_m = _PRICING.get(model, (3.0, 15.0))
    return (input_tokens * inp_m + output_tokens * out_m) / 1_000_000


async def complete_json(
    *,
    model: str,
    system: str,
    user: str,
    max_tokens: int = 1024,
    cache_system: bool = False,
) -> tuple[dict[str, Any], float]:
    """Return (parsed JSON object, estimated cost USD)."""
    client = get_client()
    system_block: list[dict[str, Any]] = [{"type": "text", "text": system}]
    if cache_system:
        system_block[0]["cache_control"] = {"type": "ephemeral"}

    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_block,
        messages=[{"role": "user", "content": user}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner)

    usage = response.usage
    cost = estimate_cost_usd(
        model,
        getattr(usage, "input_tokens", 0) or 0,
        getattr(usage, "output_tokens", 0) or 0,
    )
    return json.loads(text), cost
