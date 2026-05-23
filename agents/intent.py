"""Classify post intent from text and media metadata (vision in v2)."""

from __future__ import annotations

from models import Language, Post, PostUnderstanding
from providers import llm
from tracing import agent_step_span

_INTENT_MODEL = "claude-haiku-4-5"

_SYSTEM = """You analyze LinkedIn saved posts for short-form video repurposing.
Output ONLY valid JSON with these fields:
- primary_intent: string (e.g. educate, promote, story, hot_take, hiring, announce)
- audience: string (who should watch)
- content_format: string (text, image, carousel, video, mixed)
- key_points: array of 3-5 strings (main ideas)
- visual_summary: string or null (what images/carousel likely convey; null if no media)
- engagement_hooks: array of 2-3 short hook angles for Reels
- confidence: number 0-1
- language_detected: string (iso 639-1: en, gu, hi, or other)
- reasoning_public: string (2-3 sentences, user-facing, no chain-of-thought)

If media is present but you only have URLs/metadata, infer cautiously and lower confidence.
"""


def _user_payload(post: Post, output_language: Language) -> str:
    media_lines = []
    for m in post.media[:8]:
        media_lines.append(f"- {m.kind}: {m.url[:120]}")
    media_block = "\n".join(media_lines) if media_lines else "(none)"
    return (
        f"Target output language for scripts: {output_language}\n"
        f"Post type: {post.post_type}\n"
        f"Has media: {post.has_media}\n"
        f"Media assets:\n{media_block}\n\n"
        f"Author: {post.author}\n"
        f"Text:\n{post.text_content}"
    )


async def run(
    post: Post,
    post_index: int,
    *,
    output_language: Language = "en",
) -> PostUnderstanding | None:
    async with agent_step_span(
        agent="intent",
        step="intent.analyze",
        message=f"Analyzing intent for post {post_index + 1}",
        post_index=post_index,
        model=_INTENT_MODEL,
        input_summary=(
            f"{post.post_type}, {len(post.text_content)} chars, "
            f"{len(post.media)} media"
        ),
    ) as span:
        try:
            data, cost = await llm.complete_json(
                model=_INTENT_MODEL,
                system=_SYSTEM,
                user=_user_payload(post, output_language),
                max_tokens=768,
            )
            span.cost_usd = cost
            understanding = PostUnderstanding(**data)
            span.reasoning_public = understanding.reasoning_public
            span.output_summary = (
                f"{understanding.primary_intent} · {understanding.content_format} "
                f"(conf {understanding.confidence:.0%})"
            )
            span.artifact = {"post_understanding": understanding.model_dump()}
            return understanding
        except Exception as exc:
            span.reasoning_public = str(exc)
            raise
