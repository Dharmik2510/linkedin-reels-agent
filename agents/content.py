import json
from datetime import datetime, timezone

import anthropic

import config
from events import push
from models import ContentBrief, Language, Post, PostUnderstanding, ReelsScript, Tone
from tracing import agent_step_span

TONE_GUIDE = {
    "Punchy":      "Short, snappy sentences. Hard hooks. Emphasise the surprising number, claim, or twist.",
    "Story-led":   "Open with a scene or character. Carry a single narrative arc across the script.",
    "Analytical":  "Lead with the data point or insight. Cite the mechanism or evidence in each scene.",
    "Educational": "Frame as a step-by-step breakdown. The viewer should leave knowing how to do something.",
}

LANGUAGE_GUIDE = {
    "en": "Write entirely in English. Natural spoken Indian/Global English is fine.",
    "gu": (
        "Write the hook, script, caption, and CTA in Gujarati (ગુજરાતી). "
        "Use Gujarati script. Light English loanwords only if natural for Reels."
    ),
    "hi": (
        "Write the hook, script, caption, and CTA in Hindi (हिन्दी). "
        "Use Devanagari script. Light English loanwords only if natural for Reels."
    ),
}

_WRITER_MODEL = "claude-sonnet-4-6"


def build_system_prompt(tone: Tone, language: Language) -> str:
    safe_tone = tone if tone in TONE_GUIDE else "Punchy"
    lang_guide = LANGUAGE_GUIDE.get(language, LANGUAGE_GUIDE["en"])
    guidance = TONE_GUIDE[safe_tone]
    return (
        "You are an expert Instagram Reels scriptwriter optimized for retention and engagement. "
        f"Tone: '{safe_tone}'. {guidance}\n"
        f"Language: {lang_guide}\n\n"
        "Rules:\n"
        "- Hook must stop the scroll in ≤15 words (pattern interrupt or curiosity gap).\n"
        "- Script: 30-60 seconds spoken, one idea per line, conversational.\n"
        "- Caption: strong first line; max 150 characters before hashtags in caption field.\n\n"
        "Output valid JSON with these fields:\n"
        "- hook: string\n"
        "- script: string (line breaks between beats)\n"
        "- caption: string\n"
        "- hashtags: array of 10 strings (no # prefix)\n"
        "- cta: string (max 10 words)\n"
        "Output ONLY the JSON object. No markdown, no explanation."
    )


_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


def _parse_script(raw: str, language: Language) -> ReelsScript:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner)
    data = json.loads(text)
    return ReelsScript(**data, language=language)


def _user_message(
    post: Post,
    understanding: PostUnderstanding,
    brief: ContentBrief,
) -> str:
    return (
        f"LinkedIn post by {post.author}:\n{post.text_content}\n\n"
        f"--- Analysis ---\n{understanding.model_dump_json()}\n\n"
        f"--- Content brief ---\n{brief.model_dump_json()}"
    )


async def run(
    post: Post,
    post_index: int,
    tone: Tone = "Punchy",
    *,
    language: Language = "en",
    understanding: PostUnderstanding | None = None,
    brief: ContentBrief | None = None,
    regenerate: bool = False,
) -> ReelsScript | None:
    now = datetime.now(timezone.utc).isoformat()
    gen_payload: dict = {"post_index": post_index, "tone": tone, "language": language}
    if regenerate:
        gen_payload["regenerate"] = True
    verb = "Regenerating" if regenerate else "Writing"
    await push({
        "type": "content_generating",
        "agent": "writer",
        "message": f"{verb} Reels script for post {post_index + 1} ({language})",
        "payload": gen_payload,
        "timestamp": now,
    })

    if understanding is None or brief is None:
        await push({
            "type": "content_error",
            "agent": "writer",
            "message": f"Missing brief for post {post_index + 1}",
            "payload": {"post_index": post_index, "post_url": post.post_url},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return None

    async with agent_step_span(
        agent="writer",
        step="writer.script",
        message=f"{'Regenerating' if regenerate else 'Writing'} script for post {post_index + 1}",
        post_index=post_index,
        model=_WRITER_MODEL,
        input_summary=f"{language}, {tone}",
    ) as span:
        try:
            client = get_client()
            response = await client.messages.create(
                model=_WRITER_MODEL,
                max_tokens=1024,
                system=[{
                    "type": "text",
                    "text": build_system_prompt(tone, language),
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=[{
                    "role": "user",
                    "content": _user_message(post, understanding, brief),
                }],
            )
            usage = response.usage
            from providers.llm import estimate_cost_usd
            span.cost_usd = estimate_cost_usd(
                _WRITER_MODEL,
                getattr(usage, "input_tokens", 0) or 0,
                getattr(usage, "output_tokens", 0) or 0,
            )

            script = _parse_script(response.content[0].text, language)
            span.output_summary = script.hook[:60]
            span.artifact = {"script": script.model_dump()}

            ready_payload: dict = {
                "post_index": post_index,
                "script": script.model_dump(),
                "post": {
                    "author": post.author,
                    "post_url": post.post_url,
                },
                "language": language,
            }
            if regenerate:
                ready_payload["regenerate"] = True
            await push({
                "type": "content_ready",
                "agent": "writer",
                "message": f"Script ready for post {post_index + 1}",
                "payload": ready_payload,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return script
        except Exception as exc:
            err_payload: dict = {
                "post_index": post_index,
                "post_url": post.post_url,
            }
            if regenerate:
                err_payload["regenerate"] = True
            await push({
                "type": "content_error",
                "agent": "writer",
                "message": f"Failed for post {post_index + 1}: {exc}",
                "payload": err_payload,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            span.reasoning_public = str(exc)
            return None
