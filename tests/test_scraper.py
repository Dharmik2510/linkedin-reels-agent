from unittest.mock import AsyncMock, MagicMock, patch
import pytest


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
