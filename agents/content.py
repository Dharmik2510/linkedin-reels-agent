import json
from datetime import datetime, timezone

import anthropic

import config
from events import push
from models import Post, ReelsScript, Tone

TONE_GUIDE = {
    "Punchy":      "Short, snappy sentences. Hard hooks. Emphasise the surprising number, claim, or twist.",
    "Story-led":   "Open with a scene or character. Carry a single narrative arc across the script.",
    "Analytical":  "Lead with the data point or insight. Cite the mechanism or evidence in each scene.",
    "Educational": "Frame as a step-by-step breakdown. The viewer should leave knowing how to do something.",
}


def build_system_prompt(tone: Tone) -> str:
    safe_tone = tone if tone in TONE_GUIDE else "Punchy"
    guidance = TONE_GUIDE[safe_tone]
    return (
        "You are an expert Instagram Reels scriptwriter. Transform the LinkedIn post content "
        f"into an Instagram Reels script in the '{safe_tone}' tone. {guidance}\n\n"
        "Output valid JSON with these fields:\n"
        "- hook: string (first 3 seconds, attention-grabbing opener, max 15 words)\n"
        "- script: string (30-60 second spoken script, conversational tone, broken into lines)\n"
        "- caption: string (Instagram caption with relevant hashtags, max 150 chars)\n"
        "- hashtags: array of 10 strings (no # prefix)\n"
        "- cta: string (call to action, max 10 words)\n"
        "Output ONLY the JSON object. No markdown, no explanation."
    )

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


def _parse_script(raw: str) -> ReelsScript:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop opening fence line and closing fence line
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner)
    return ReelsScript(**json.loads(text))


async def run(post: Post, post_index: int, tone: Tone = "Punchy") -> ReelsScript | None:
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
        script = _parse_script(response.content[0].text)
        await push({
            "type": "content_ready",
            "agent": "content",
            "message": f"Script ready for post {post_index + 1}",
            "payload": {"post_index": post_index, "script": script.model_dump()},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return script
    except Exception as exc:
        await push({
            "type": "content_error",
            "agent": "content",
            "message": f"Failed to generate script for post {post_index + 1}: {exc}",
            "payload": {"post_index": post_index, "post_url": post.post_url},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return None
