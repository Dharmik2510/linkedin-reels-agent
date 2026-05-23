import asyncio
from datetime import datetime, timezone

from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError, async_playwright

import config
from events import push
from models import MediaAsset, Post, PostType

LOGIN_URL = "https://www.linkedin.com/login"
SAVED_POSTS_URL = "https://www.linkedin.com/my-items/saved-posts/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
# Each saved post is a direct <li> child of the only role=list <ul> inside the
# scroll container. LinkedIn obfuscated the <li>'s class (a per-deploy hash
# like "oFDtiZRoj..."), so we anchor on the stable ARIA role + scaffold class
# instead of the hashed CSS class.
POST_SELECTOR = ".scaffold-finite-scroll__content ul[role='list'] > li"
VERIFICATION_TIMEOUT_MS = 5 * 60 * 1000  # user has 5 minutes to complete 2FA/CAPTCHA

# LinkedIn's redesigned login page has hidden duplicate inputs in the DOM
# (autofill targets) alongside the visible sign-in form. The :visible filter
# scopes the match to the real, user-facing input — otherwise wait_for_selector
# locks onto the first-in-DOM hidden duplicate and never resolves.
USERNAME_SELECTOR = (
    "input#username:visible, "
    "input[name='session_key']:visible, "
    "input[type='email']:visible"
)
PASSWORD_SELECTOR = (
    "input#password:visible, "
    "input[name='session_password']:visible, "
    "input[type='password']:visible"
)
LOGIN_DEBUG_SCREENSHOT = "linkedin_login_debug.png"
SAVED_POSTS_DEBUG_SCREENSHOT = "linkedin_saved_posts_debug.png"
SAVED_POSTS_DEBUG_HTML = "linkedin_saved_posts_main.html"

# Candidate post-container selectors. LinkedIn renames classes between redesigns,
# so we probe several and report counts; whichever matches is the new structure.
SAVED_POSTS_CANDIDATE_SELECTORS = [
    POST_SELECTOR,
    ".scaffold-finite-scroll__content .entity-result",  # pre-2026 redesign
    ".feed-shared-update-v2",
    "[data-urn^='urn:li:activity']",
    "[data-chameleon-result-urn^='urn:li:activity']",
    "li[data-urn]",
    "li.reusable-search__result-container",
    ".scaffold-finite-scroll__content > ul > li",
    "ul[role='list'] > li",
    "main article",
    "main li",
]


async def _emit_saved_posts_diagnostics(page: Page) -> None:
    """Probe candidate post-container selectors and save a screenshot so we can
    identify the right selector after a LinkedIn redesign.
    """
    diagnostics: dict = {"url": page.url}
    try:
        diagnostics["title"] = await page.title()
    except Exception:
        diagnostics["title"] = "<unavailable>"

    selector_counts: dict = {}
    for selector in SAVED_POSTS_CANDIDATE_SELECTORS:
        try:
            selector_counts[selector] = await page.locator(selector).count()
        except Exception as e:
            selector_counts[selector] = f"<error: {e}>"
    diagnostics["selector_counts"] = selector_counts

    try:
        await page.screenshot(path=SAVED_POSTS_DEBUG_SCREENSHOT, full_page=True)
        diagnostics["screenshot"] = SAVED_POSTS_DEBUG_SCREENSHOT
    except Exception as e:
        diagnostics["screenshot"] = f"failed: {e}"

    # Dump <main>'s HTML so we can grep for the post-container's class after
    # a redesign — class probes alone don't reveal the right scoping.
    try:
        main_html = await page.evaluate(
            "document.querySelector('main')?.outerHTML?.slice(0, 60000) || ''"
        )
        with open(SAVED_POSTS_DEBUG_HTML, "w") as f:
            f.write(main_html)
        diagnostics["main_html_file"] = SAVED_POSTS_DEBUG_HTML
    except Exception as e:
        diagnostics["main_html_file"] = f"failed: {e}"

    await push({
        "type": "error",
        "agent": "scraper",
        "message": f"No posts found on saved-posts page. Diagnostics: {diagnostics}",
        "payload": diagnostics,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def _emit_login_diagnostics(page: Page) -> None:
    """Capture what LinkedIn actually served when the login form selector times out.
    Saves a screenshot and emits an event with URL, title, frame count, and counts of
    common form-like elements so we can identify variant HTML or iframe wrappers.
    """
    diagnostics: dict = {"url": page.url, "frame_count": len(page.frames)}
    try:
        diagnostics["title"] = await page.title()
    except Exception:
        diagnostics["title"] = "<unavailable>"

    for probe_name, probe_selector in [
        ("password_inputs", "input[type='password']"),
        ("visible_password_inputs", "input[type='password']:visible"),
        ("email_inputs", "input[type='email']"),
        ("visible_email_inputs", "input[type='email']:visible"),
        ("text_inputs", "input[type='text']"),
        ("forms", "form"),
        ("iframes", "iframe"),
    ]:
        try:
            diagnostics[probe_name] = await page.locator(probe_selector).count()
        except Exception:
            diagnostics[probe_name] = "<error>"

    try:
        await page.screenshot(path=LOGIN_DEBUG_SCREENSHOT, full_page=True)
        diagnostics["screenshot"] = LOGIN_DEBUG_SCREENSHOT
    except Exception as e:
        diagnostics["screenshot"] = f"failed: {e}"

    await push({
        "type": "error",
        "agent": "scraper",
        "message": f"LinkedIn login form not found. Diagnostics: {diagnostics}",
        "payload": diagnostics,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def _login(page: Page) -> None:
    await push({
        "type": "scraper_login",
        "agent": "scraper",
        "message": "Logging in to LinkedIn...",
        "payload": {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    await page.goto(LOGIN_URL)
    try:
        await page.wait_for_selector(PASSWORD_SELECTOR, state="visible", timeout=15000)
    except PlaywrightTimeoutError:
        await _emit_login_diagnostics(page)
        raise RuntimeError("LinkedIn login form not found")
    await page.fill(USERNAME_SELECTOR, config.LINKEDIN_EMAIL)
    await page.fill(PASSWORD_SELECTOR, config.LINKEDIN_PASSWORD)
    # page.click('button[type="submit"]') has an actionability-retry loop: if
    # the original button detaches due to post-click navigation, Playwright
    # re-resolves the selector on the *new* page and locks onto an unrelated
    # disabled button (e.g. /feed/'s post composer). press(Enter) is a one-shot
    # keyboard event — submission proceeds without retry semantics.
    pre_submit_url = page.url
    await page.press(PASSWORD_SELECTOR, "Enter")
    # press(Enter) only dispatches the keyboard event; LinkedIn then POSTs the
    # form and 302's to /feed (success), /checkpoint or /challenge
    # (verification), or back to /login?fromSignIn=... (bad credentials).
    # wait_for_load_state("domcontentloaded") alone would return immediately
    # because the *current* /login document is already DOMContentLoaded — so
    # the URL check below would read the still-/login pre-submit URL and
    # falsely report "check credentials". Wait for the post-submit navigation
    # to actually change the URL before evaluating the result.
    try:
        await page.wait_for_url(
            lambda u: u != pre_submit_url,
            wait_until="domcontentloaded",
            timeout=30000,
        )
    except PlaywrightTimeoutError:
        # No URL change within 30s — either an XHR-only submit or LinkedIn
        # never accepted the form. Fall through; the URL check below will
        # report based on whatever state we ended up in.
        pass

    url = page.url
    if "/checkpoint" in url or "/challenge" in url:
        await push({
            "type": "scraper_verification",
            "agent": "scraper",
            "message": "Complete LinkedIn verification in the browser window (waiting up to 5 minutes)...",
            "payload": {"url": url},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        try:
            await page.wait_for_url(
                lambda u: "/checkpoint" not in u
                and "/challenge" not in u
                and "/login" not in u,
                timeout=VERIFICATION_TIMEOUT_MS,
            )
        except PlaywrightTimeoutError:
            await push({
                "type": "error",
                "agent": "scraper",
                "message": "LinkedIn login failed — verification not completed in time",
                "payload": {"url": page.url},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            raise RuntimeError("LinkedIn login failed")
    elif "/login" in url:
        await push({
            "type": "error",
            "agent": "scraper",
            "message": "LinkedIn login failed — check credentials",
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


async def _detect_media(element) -> tuple[PostType, list[MediaAsset], bool]:
    """Best-effort media detection from saved-post list item."""
    media: list[MediaAsset] = []
    post_type: PostType = "text"

    carousel = await element.query_selector(
        "[data-test-id='carousel'], .artdeco-carousel, button[aria-label*='carousel']"
    )
    video = await element.query_selector("video, [data-test-id='video']")

    imgs = await element.query_selector_all(
        "img[src*='media'], img[src*='licdn.com'], img.feed-images"
    )
    for i, img in enumerate(imgs[:6]):
        src = await img.get_attribute("src")
        if not src or src.startswith("data:"):
            continue
        media.append(MediaAsset(kind="carousel_slide", url=src, slide_index=i))

    if video:
        post_type = "video"
        poster = await video.get_attribute("poster")
        if poster:
            media.append(MediaAsset(kind="video", url=poster))
    elif carousel or len(media) > 1:
        post_type = "carousel"
    elif len(media) == 1:
        post_type = "image"

    has_media = post_type != "text" or len(media) > 0
    if post_type == "text" and has_media:
        post_type = "mixed"
    return post_type, media, has_media


async def _extract_post(page: Page, element) -> Post | None:
    try:
        # The author's visible name lives in the aria-hidden span inside the
        # profile-link <a>. There's a sibling visually-hidden span ("View X's
        # profile") for screen readers — selecting the aria-hidden one avoids
        # concatenating both.
        author_el = await element.query_selector(
            ".entity-result__content-actor a[href*='/in/'] span[aria-hidden='true']"
        )
        author = (await author_el.inner_text()).strip() if author_el else "Unknown"

        text_el = await element.query_selector(".entity-result__content-summary")
        text_content = (await text_el.inner_text()).strip() if text_el else ""

        # The post URL is on the embedded preview link; href contains the
        # activity URN (e.g. /feed/update/urn:li:activity:NNNN).
        link_el = await element.query_selector("a[href*='/feed/update/']")
        post_url = (await link_el.get_attribute("href")) if link_el else ""
        if post_url and not post_url.startswith("http"):
            post_url = f"https://www.linkedin.com{post_url}"

        post_type, media, has_media = await _detect_media(element)

        return Post(
            author=author,
            text_content=text_content,
            post_url=post_url or "",
            scraped_at=datetime.now(timezone.utc),
            post_type=post_type,
            media=media,
            has_media=has_media,
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
            await page.wait_for_load_state("domcontentloaded")

            await _scroll_until_n_posts(page, num_posts)

            elements = await page.query_selector_all(POST_SELECTOR)
            if not elements:
                await _emit_saved_posts_diagnostics(page)
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

    # Only reached on clean exit (login failure raises before this point)
    await push({
        "type": "scraper_done",
        "agent": "scraper",
        "message": f"Scraping complete — {len(posts)} posts collected",
        "payload": {"count": len(posts)},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return posts
