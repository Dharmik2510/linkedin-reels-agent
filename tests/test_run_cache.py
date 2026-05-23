from datetime import datetime, timezone

from models import Post
import run_cache


def _post(i: int) -> Post:
    return Post(
        author=f"Author {i}",
        text_content=f"Body {i}",
        post_url=f"https://linkedin.com/posts/{i}",
        scraped_at=datetime.now(timezone.utc),
    )


def test_set_run_and_get_post():
    run_cache.clear()
    posts = [_post(0), _post(1)]
    run_cache.set_run(posts, "Story-led")
    assert run_cache.count() == 2
    assert run_cache.get_post(0) is not None
    assert run_cache.get_post(0).author == "Author 0"
    assert run_cache.get_post(2) is None
    assert run_cache.last_tone() == "Story-led"


def test_clear():
    run_cache.set_run([_post(0)], "Punchy")
    run_cache.clear()
    assert run_cache.count() == 0
