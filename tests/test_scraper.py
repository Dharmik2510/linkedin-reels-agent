from unittest.mock import AsyncMock
from unittest.mock import patch as mock_patch
import pytest


@pytest.fixture(autouse=True)
def clear_bus():
    from events import event_bus
    while not event_bus.empty():
        event_bus.get_nowait()
    yield
    while not event_bus.empty():
        event_bus.get_nowait()


async def test_login_waits_for_manual_verification_on_checkpoint():
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError  # noqa: F401

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    # wait_for_url is called twice: once for the post-submit navigation,
    # once to wait for the user to complete 2FA. Both succeed in this test.
    mock_page.wait_for_url = AsyncMock()

    from agents.scraper import _login
    await _login(mock_page)  # should NOT raise

    assert mock_page.wait_for_url.await_count == 2


async def test_login_raises_when_verification_times_out():
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    # Both the post-submit nav wait and the verification wait time out.
    # The post-submit timeout is caught and falls through; the verification
    # timeout is what raises "login failed".
    mock_page.wait_for_url = AsyncMock(side_effect=PlaywrightTimeoutError("timeout"))

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login failed"):
        await _login(mock_page)

    # 1 post-submit wait + 1 verification wait = 2
    assert mock_page.wait_for_url.await_count == 2


async def test_login_raises_on_login_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/login?fromSignIn=true"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    mock_page.wait_for_url = AsyncMock()

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login failed"):
        await _login(mock_page)

    # Bad credentials should fire only the post-submit nav wait, NOT the
    # verification wait (which is gated on a /checkpoint or /challenge URL).
    assert mock_page.wait_for_url.await_count == 1


async def test_login_does_not_wait_for_networkidle():
    # LinkedIn keeps persistent analytics connections; the page never reaches
    # networkidle and waiting for it times out at 30s. domcontentloaded is what
    # we actually need before checking the post-submit URL.
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()

    from agents.scraper import _login
    await _login(mock_page)

    for call in mock_page.wait_for_load_state.call_args_list:
        # First positional arg is the state name
        arg = call.args[0] if call.args else call.kwargs.get("state")
        assert arg != "networkidle", f"_login should not wait for networkidle (called with {arg!r})"


async def test_scraper_module_source_avoids_networkidle():
    # Belt-and-suspenders: the saved-posts goto in run() also previously waited
    # for networkidle and timed out. Lock that out at the module level.
    import inspect
    from agents import scraper
    source = inspect.getsource(scraper)
    assert "networkidle" not in source, "scraper.py must not use 'networkidle' load state"


async def test_login_targets_form_name_attributes_for_variant_resilience():
    # LinkedIn occasionally serves login HTML variants without id="username".
    # The form's name attributes are stable because the auth endpoint requires
    # them in the POST body — using them avoids timeouts on variant pages.
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()

    from agents.scraper import _login
    await _login(mock_page)

    fill_calls = mock_page.fill.call_args_list
    assert len(fill_calls) == 2
    username_selector = fill_calls[0].args[0]
    password_selector = fill_calls[1].args[0]
    assert "session_key" in username_selector
    assert "session_password" in password_selector


async def test_login_password_selector_falls_back_to_input_type():
    # If LinkedIn renames both id and name (e.g. variant pages), matching by
    # input[type='password'] still finds the field.
    from agents.scraper import PASSWORD_SELECTOR
    assert "input[type='password']" in PASSWORD_SELECTOR


async def test_login_submits_via_enter_press_not_button_click():
    # page.click('button[type="submit"]') has an actionability retry loop:
    # if the original submit button detaches during post-click navigation,
    # Playwright re-resolves the selector on the *new* page and locks onto an
    # unrelated disabled button[type="submit"] (e.g. /feed/'s hidden post
    # composer button). Pressing Enter on the password field is a one-shot
    # keyboard event with no retry semantics — submission proceeds naturally.
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.press = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()

    from agents.scraper import _login
    await _login(mock_page)

    assert mock_page.press.await_count == 1, "form must be submitted via press(Enter)"
    assert mock_page.press.call_args.args[1] == "Enter"
    # The buggy click path must not be reintroduced
    assert mock_page.click.await_count == 0


async def test_login_selectors_filter_to_visible_inputs():
    # LinkedIn's redesigned login page has hidden duplicate inputs (autofill
    # targets or hidden modals) alongside the visible form. Without :visible,
    # wait_for_selector locks onto the first-in-DOM hidden duplicate and waits
    # forever for it to become visible.
    from agents.scraper import USERNAME_SELECTOR, PASSWORD_SELECTOR
    # Every clause in the selector list must include the :visible filter
    for clause in USERNAME_SELECTOR.split(","):
        assert ":visible" in clause, f"username clause missing :visible: {clause!r}"
    for clause in PASSWORD_SELECTOR.split(","):
        assert ":visible" in clause, f"password clause missing :visible: {clause!r}"


async def test_saved_posts_diagnostics_probes_candidate_selectors_and_screenshots():
    # When zero posts match POST_SELECTOR after scrolling, we don't know whether
    # the page is empty, blocked, or just renamed in a redesign. The diagnostic
    # probes several candidate selectors and saves a screenshot so we can see
    # what LinkedIn actually rendered.
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/my-items/saved-posts/"
    mock_page.title = AsyncMock(return_value="My Items | LinkedIn")
    mock_page.screenshot = AsyncMock()
    mock_locator = AsyncMock()
    mock_locator.count = AsyncMock(return_value=0)
    mock_page.locator = lambda sel: mock_locator

    from agents.scraper import _emit_saved_posts_diagnostics
    await _emit_saved_posts_diagnostics(mock_page)

    # Screenshot must be attempted so we can see what was rendered
    assert mock_page.screenshot.await_count == 1
    # Must probe at least a handful of candidate selectors so we have evidence
    # to choose the right post container after a redesign
    assert mock_locator.count.await_count >= 4


async def test_login_captures_diagnostics_when_form_not_found():
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError

    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/login/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    mock_page.wait_for_selector = AsyncMock(side_effect=PlaywrightTimeoutError("timeout"))
    mock_page.screenshot = AsyncMock()
    mock_page.title = AsyncMock(return_value="LinkedIn Login")
    mock_page.frames = ["main"]  # iterable, not AsyncMock

    # Probe locator counts — return a Locator-like mock with count()
    mock_locator = AsyncMock()
    mock_locator.count = AsyncMock(return_value=0)
    mock_page.locator = lambda sel: mock_locator

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login form not found"):
        await _login(mock_page)

    # Diagnostic screenshot must be attempted so user can share what LinkedIn served
    assert mock_page.screenshot.await_count == 1


async def test_login_waits_for_form_hydration_before_filling():
    # If we fill before the form's inputs are attached, fill can time out
    # even though the page is technically loaded.
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()

    call_order: list[str] = []
    mock_page.wait_for_selector.side_effect = lambda *a, **kw: call_order.append("wait_for_selector")
    mock_page.fill.side_effect = lambda *a, **kw: call_order.append("fill")

    from agents.scraper import _login
    await _login(mock_page)

    assert call_order[0] == "wait_for_selector"
    assert "fill" in call_order


async def test_login_waits_for_post_submit_navigation_before_url_check():
    # Regression: wait_for_load_state("domcontentloaded") returns immediately
    # for the already-loaded /login page, so reading page.url right after
    # press(Enter) gave the pre-submit URL — and the /login-in-URL check
    # falsely fired "check credentials" even on perfectly valid logins.
    # Verify _login waits for the URL to change before evaluating the result.
    mock_page = AsyncMock()
    # Start at the login URL, then have wait_for_url's side_effect "commit"
    # the post-submit navigation by mutating mock_page.url to /feed/.
    mock_page.url = "https://www.linkedin.com/login"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.press = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()

    async def _commit_navigation(*args, **kwargs):
        mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.wait_for_url = AsyncMock(side_effect=_commit_navigation)

    from agents.scraper import _login
    # Must NOT raise: navigation eventually lands on /feed/, which is success.
    # Without the fix, the URL is still /login at check time → raises.
    await _login(mock_page)

    # The post-submit wait_for_url must have been invoked.
    assert mock_page.wait_for_url.await_count >= 1


async def test_login_succeeds_on_feed_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    await _login(mock_page)  # should not raise


_AUTHOR_SELECTOR = ".entity-result__content-actor a[href*='/in/'] span[aria-hidden='true']"
_TEXT_SELECTOR = ".entity-result__content-summary"
_LINK_SELECTOR = "a[href*='/feed/update/']"


async def test_extract_post_returns_post():
    from datetime import datetime, timezone
    mock_author_el = AsyncMock()
    mock_author_el.inner_text = AsyncMock(return_value="  Jane Doe  ")

    mock_text_el = AsyncMock()
    mock_text_el.inner_text = AsyncMock(return_value="  Some post content  ")

    mock_link_el = AsyncMock()
    mock_link_el.get_attribute = AsyncMock(return_value="https://linkedin.com/posts/abc")

    mock_element = AsyncMock()
    mock_element.query_selector = AsyncMock(side_effect=lambda sel: {
        _AUTHOR_SELECTOR: mock_author_el,
        _TEXT_SELECTOR: mock_text_el,
        _LINK_SELECTOR: mock_link_el,
    }.get(sel))

    mock_page = AsyncMock()

    from agents.scraper import _extract_post
    post = await _extract_post(mock_page, mock_element)

    assert post is not None
    assert post.author == "Jane Doe"
    assert post.text_content == "Some post content"
    assert post.post_url == "https://linkedin.com/posts/abc"


async def test_extract_post_prepends_domain_for_relative_url():
    mock_author_el = AsyncMock()
    mock_author_el.inner_text = AsyncMock(return_value="Jane Doe")

    mock_text_el = AsyncMock()
    mock_text_el.inner_text = AsyncMock(return_value="content")

    mock_link_el = AsyncMock()
    mock_link_el.get_attribute = AsyncMock(return_value="/posts/abc123")

    mock_element = AsyncMock()
    mock_element.query_selector = AsyncMock(side_effect=lambda sel: {
        _AUTHOR_SELECTOR: mock_author_el,
        _TEXT_SELECTOR: mock_text_el,
        _LINK_SELECTOR: mock_link_el,
    }.get(sel))

    from agents.scraper import _extract_post
    post = await _extract_post(AsyncMock(), mock_element)

    assert post.post_url == "https://www.linkedin.com/posts/abc123"


async def test_extract_post_returns_none_on_exception():
    mock_element = AsyncMock()
    mock_element.query_selector = AsyncMock(side_effect=Exception("DOM error"))

    from agents.scraper import _extract_post
    result = await _extract_post(AsyncMock(), mock_element)
    assert result is None


async def test_scroll_breaks_when_enough_posts_loaded():
    mock_page = AsyncMock()
    # Immediately has enough posts on first check
    mock_page.query_selector_all = AsyncMock(return_value=["post"] * 5)

    from agents.scraper import _scroll_until_n_posts
    with mock_patch("asyncio.sleep", AsyncMock()):
        await _scroll_until_n_posts(mock_page, 5)
    # query_selector_all called once, no scrolling needed
    assert mock_page.query_selector_all.call_count == 1


async def test_scroll_breaks_on_stale_count():
    mock_page = AsyncMock()
    # Always returns 3 posts (never enough, never grows)
    mock_page.query_selector_all = AsyncMock(return_value=["post"] * 3)
    mock_page.evaluate = AsyncMock()

    from agents.scraper import _scroll_until_n_posts
    # Should eventually break after 3 stale attempts
    with mock_patch("asyncio.sleep", AsyncMock()):
        await _scroll_until_n_posts(mock_page, 10, max_stale=3)
    # Did not loop forever
    assert mock_page.evaluate.call_count == 3  # scrolled 3 times before giving up
