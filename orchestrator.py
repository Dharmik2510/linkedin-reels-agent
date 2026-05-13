import asyncio
from datetime import datetime, timezone

from agents import content, scraper
from events import push
from models import Tone


async def run(num_posts: int, tone: Tone = "Punchy") -> None:
    now = lambda: datetime.now(timezone.utc).isoformat()

    async def stage(name: str) -> None:
        await push({
            "type": "stage_changed",
            "agent": "orchestrator",
            "message": f"stage: {name}",
            "payload": {"stage": name},
            "timestamp": now(),
        })

    await push({
        "type": "orchestrator_start",
        "agent": "orchestrator",
        "message": f"Starting pipeline for {num_posts} posts ({tone})",
        "payload": {"num_posts": num_posts, "tone": tone},
        "timestamp": now(),
    })
    await stage("scraping")

    try:
        posts = await scraper.run(num_posts)
    except Exception as exc:
        await push({
            "type": "error",
            "agent": "orchestrator",
            "message": f"Scraper failed: {exc}",
            "payload": {},
            "timestamp": now(),
        })
        await stage("idle")
        return

    await stage("generating")

    semaphore = asyncio.Semaphore(3)

    async def generate_with_limit(post, index):
        async with semaphore:
            return await content.run(post, index, tone=tone)

    results = await asyncio.gather(
        *[generate_with_limit(post, i) for i, post in enumerate(posts)],
        return_exceptions=True,
    )

    scripts_generated = sum(
        1 for r in results if r is not None and not isinstance(r, Exception)
    )
    errors = len(results) - scripts_generated

    await stage("done")

    await push({
        "type": "orchestrator_complete",
        "agent": "orchestrator",
        "message": (
            f"Pipeline complete — {scripts_generated} scripts generated, {errors} errors"
        ),
        "payload": {
            "posts_scraped": len(posts),
            "scripts_generated": scripts_generated,
            "errors": errors,
        },
        "timestamp": now(),
    })
