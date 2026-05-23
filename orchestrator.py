import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from agents import content, intent, scraper, strategist
from budgets import RunBudget
from db import store
from events import push
from models import Language, Tone
import run_cache
import run_context
from tracing import agent_step_span, emit_agent_step


async def run(
    num_posts: int,
    tone: Tone = "Punchy",
    language: Language = "en",
    *,
    run_id: str | None = None,
) -> None:
    rid = run_id or str(uuid4())
    import config as app_config
    budget = RunBudget(max_usd=app_config.MAX_RUN_BUDGET_USD)
    run_context.set_run(rid, budget)

    now = lambda: datetime.now(timezone.utc).isoformat()

    async def stage(name: str) -> None:
        await push({
            "type": "stage_changed",
            "agent": "orchestrator",
            "message": f"stage: {name}",
            "payload": {"stage": name, "run_id": rid},
            "timestamp": now(),
        })

    final_status = "completed"
    try:
        store.create_run(rid, num_posts=num_posts, tone=tone, language=language)

        await emit_agent_step(
            agent="orchestrator",
            step="run.start",
            status="completed",
            message=f"Run started — {num_posts} posts, {tone}, {language}",
            input_summary=f"budget ${budget.max_usd:.2f}",
        )

        await push({
            "type": "orchestrator_start",
            "agent": "orchestrator",
            "message": f"Starting pipeline for {num_posts} posts ({tone}, {language})",
            "payload": {
                "num_posts": num_posts,
                "tone": tone,
                "language": language,
                "run_id": rid,
            },
            "timestamp": now(),
        })
        await stage("scraping")

        async with agent_step_span(
            agent="scraper",
            step="scraper.collect",
            message="Scraping saved LinkedIn posts",
            model=None,
        ):
            try:
                posts = await scraper.run(num_posts)
            except Exception as exc:
                await push({
                    "type": "error",
                    "agent": "orchestrator",
                    "message": f"Scraper failed: {exc}",
                    "payload": {"run_id": rid},
                    "timestamp": now(),
                })
                await stage("idle")
                run_cache.clear()
                final_status = "failed"
                return

        run_cache.set_run(posts, tone, language)
        await stage("analyzing")

        sem = asyncio.Semaphore(3)

        async def analyze_one(post, index: int):
            async with sem:
                if budget.would_exceed(0.05):
                    await emit_agent_step(
                        agent="intent",
                        step="intent.analyze",
                        status="failed",
                        message=f"Budget exceeded — skipped post {index + 1}",
                        post_index=index,
                    )
                    return None
                try:
                    u = await intent.run(post, index, output_language=language)
                    if u:
                        run_cache.set_understanding(index, u)
                    return u
                except Exception:
                    return None

        await asyncio.gather(*[analyze_one(p, i) for i, p in enumerate(posts)])

        await stage("generating")

        async def write_one(post, index: int):
            async with sem:
                understanding = run_cache.get_understanding(index)
                if understanding is None:
                    await push({
                        "type": "content_error",
                        "agent": "writer",
                        "message": f"No understanding for post {index + 1}",
                        "payload": {"post_index": index, "post_url": post.post_url},
                        "timestamp": now(),
                    })
                    return None
                if budget.would_exceed(0.15):
                    await push({
                        "type": "content_error",
                        "agent": "writer",
                        "message": f"Budget exceeded — skipped post {index + 1}",
                        "payload": {"post_index": index, "post_url": post.post_url},
                        "timestamp": now(),
                    })
                    return None
                try:
                    brief = await strategist.run(
                        post, understanding, index, tone=tone, language=language,
                    )
                    if brief is None:
                        return None
                    run_cache.set_brief(index, brief)
                    return await content.run(
                        post,
                        index,
                        tone=tone,
                        language=language,
                        understanding=understanding,
                        brief=brief,
                    )
                except Exception:
                    return None

        results = await asyncio.gather(
            *[write_one(post, i) for i, post in enumerate(posts)],
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
                f"Pipeline complete — {scripts_generated} scripts, {errors} errors"
            ),
            "payload": {
                "run_id": rid,
                "posts_scraped": len(posts),
                "scripts_generated": scripts_generated,
                "errors": errors,
                "cost_usd": round(budget.spent_usd, 4),
            },
            "timestamp": now(),
        })
    finally:
        store.finish_run(rid, status=final_status, cost_usd=budget.spent_usd)
        run_context.clear_run()


async def regenerate(
    post_index: int,
    tone: Tone | None = None,
    language: Language | None = None,
) -> bool:
    post = run_cache.get_post(post_index)
    if post is None:
        return False
    effective_tone = tone if tone is not None else run_cache.last_tone()
    effective_language = language if language is not None else run_cache.last_language()

    understanding = run_cache.get_understanding(post_index)
    if understanding is None:
        understanding = await intent.run(
            post, post_index, output_language=effective_language,
        )
        if understanding:
            run_cache.set_understanding(post_index, understanding)

    if understanding is None:
        return False

    brief = await strategist.run(
        post, understanding, post_index, tone=effective_tone, language=effective_language,
    )
    if brief is None:
        return False
    run_cache.set_brief(post_index, brief)

    await content.run(
        post,
        post_index,
        tone=effective_tone,
        language=effective_language,
        understanding=understanding,
        brief=brief,
        regenerate=True,
    )
    return True
