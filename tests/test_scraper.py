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


async def test_login_raises_on_checkpoint_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/challenge"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login failed"):
        await _login(mock_page)


async def test_login_raises_on_login_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/login?fromSignIn=true"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login failed"):
        await _login(mock_page)


async def test_login_raises_on_pure_checkpoint_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/checkpoint/lg/login-submit"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    with pytest.raises(RuntimeError, match="login failed"):
        await _login(mock_page)


async def test_login_succeeds_on_feed_url():
    mock_page = AsyncMock()
    mock_page.url = "https://www.linkedin.com/feed/"
    mock_page.goto = AsyncMock()
    mock_page.fill = AsyncMock()
    mock_page.click = AsyncMock()
    mock_page.wait_for_load_state = AsyncMock()

    from agents.scraper import _login
    await _login(mock_page)  # should not raise


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
        ".entity-result__title-text": mock_author_el,
        ".entity-result__summary": mock_text_el,
        "a.app-aware-link": mock_link_el,
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
        ".entity-result__title-text": mock_author_el,
        ".entity-result__summary": mock_text_el,
        "a.app-aware-link": mock_link_el,
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
