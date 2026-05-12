import asyncio
from datetime import datetime, timezone

from playwright.async_api import Page, async_playwright

import config
from events import push
from models import Post

LOGIN_URL = "https://www.linkedin.com/login"
SAVED_POSTS_URL = "https://www.linkedin.com/my-items/saved-posts/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
POST_SELECTOR = ".scaffold-finite-scroll__content .entity-result"


async def _login(page: Page) -> None:
    await push({
        "type": "scraper_login",
        "agent": "scraper",
        "message": "Logging in to LinkedIn...",
        "payload": {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await page.goto(LOGIN_URL)
    await page.fill("#username", config.LINKEDIN_EMAIL)
    await page.fill("#password", config.LINKEDIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.wait_for_load_state("networkidle")

    url = page.url
    if "/login" in url or "/checkpoint" in url or "/challenge" in url:
        await push({
            "type": "error",
            "agent": "scraper",
            "message": "LinkedIn login failed — check credentials or complete CAPTCHA manually",
            "payload": {"url": url},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        raise RuntimeError("LinkedIn login failed")


async def _scroll_until_n_posts(page: Page, num_posts: int, max_stale: int = 5) -> None:
    prev_count = -1
    stale_attempts = 0
    while True:
        posts = await page.query_selector_all(POST_SELECTOR)
        count = len(posts)
        if count >= num_posts:
            break
        if count == prev_count:
            stale_attempts += 1
            if stale_attempts >= max_stale:
                break  # LinkedIn gave us all it will
        else:
            stale_attempts = 0
        prev_count = count
        await push({
            "type": "scraper_scrolling",
            "agent": "scraper",
            "message": f"Loaded {count}/{num_posts} posts, scrolling...",
            "payload": {"loaded": count, "target": num_posts},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        await page.evaluate("window.scrollBy(0, 800)")
        await asyncio.sleep(1.5)


async def _extract_post(page: Page, element) -> Post | None:
    try:
        author_el = await element.query_selector(".entity-result__title-text")
        author = (await author_el.inner_text()).strip() if author_el else "Unknown"

        text_el = await element.query_selector(".entity-result__summary")
        text_content = (await text_el.inner_text()).strip() if text_el else ""

        link_el = await element.query_selector("a.app-aware-link")
        post_url = (await link_el.get_attribute("href")) if link_el else ""
        if post_url and not post_url.startswith("http"):
            post_url = f"https://www.linkedin.com{post_url}"

        return Post(
            author=author,
            text_content=text_content,
            post_url=post_url or "",
            scraped_at=datetime.now(timezone.utc),
        )
    except Exception:
        return None


async def run(num_posts: int) -> list[Post]:
    posts: list[Post] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, slow_mo=50)
        context = await browser.new_context(user_agent=USER_AGENT)
        page = await context.new_page()

        try:
            await _login(page)

            await push({
                "type": "scraper_navigating",
                "agent": "scraper",
                "message": "Navigating to saved posts...",
                "payload": {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await page.goto(SAVED_POSTS_URL)
            await page.wait_for_load_state("networkidle")

            await _scroll_until_n_posts(page, num_posts)

            elements = await page.query_selector_all(POST_SELECTOR)
            elements = elements[:num_posts]

            for i, element in enumerate(elements):
                post = await _extract_post(page, element)
                if post:
                    posts.append(post)
                    await push({
                        "type": "post_scraped",
                        "agent": "scraper",
                        "message": f"Scraped post {i + 1}/{len(elements)}: {post.author}",
                        "payload": {
                            "index": i,
                            "total": len(elements),
                            "post": post.model_dump(mode="json"),
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
        finally:
            await browser.close()

    await push({
        "type": "scraper_done",
        "agent": "scraper",
        "message": f"Scraping complete — {len(posts)} posts collected",
        "payload": {"count": len(posts)},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return posts
