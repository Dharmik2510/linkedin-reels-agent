"""Turn post understanding into a content brief for the writer."""

from __future__ import annotations

from models import ContentBrief, Language, Post, PostUnderstanding, Tone
from providers import llm
from tracing import agent_step_span

_STRATEGIST_MODEL = "claude-haiku-4-5"

_SYSTEM = """You are a short-form video content strategist.
Given a LinkedIn post analysis, produce a brief for an Instagram Reels scriptwriter.
Output ONLY valid JSON:
- angle: string (single creative angle)
- hook_direction: string (how to open first 3 seconds)
- structure: array of 4-6 strings (beat-by-beat spoken outline)
- cta_type: string (e.g. follow, comment, save, dm)
"""


async def run(
    post: Post,
    understanding: PostUnderstanding,
    post_index: int,
    *,
    tone: Tone,
    language: Language,
) -> ContentBrief | None:
    async with agent_step_span(
        agent="strategist",
        step="strategist.brief",
        message=f"Planning content for post {post_index + 1}",
        post_index=post_index,
        model=_STRATEGIST_MODEL,
        input_summary=f"tone={tone}, lang={language}",
    ) as span:
        user = (
            f"Tone: {tone}\n"
            f"Output language: {language}\n"
            f"Post text:\n{post.text_content}\n\n"
            f"Analysis:\n{understanding.model_dump_json()}"
        )
        data, cost = await llm.complete_json(
            model=_STRATEGIST_MODEL,
            system=_SYSTEM,
            user=user,
            max_tokens=512,
            cache_system=True,
        )
        span.cost_usd = cost
        brief = ContentBrief(**data)
        span.reasoning_public = f"Angle: {brief.angle}"
        span.output_summary = brief.hook_direction[:80]
        span.artifact = {"content_brief": brief.model_dump()}
        return brief
