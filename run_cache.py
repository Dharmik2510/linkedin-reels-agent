"""In-memory cache of posts from the last completed scrape (for single-post regenerate)."""

from models import Post, Tone

_posts: list[Post] = []
_tone: Tone = "Punchy"


def set_run(posts: list[Post], tone: Tone) -> None:
    global _posts, _tone
    _posts = list(posts)
    _tone = tone


def clear() -> None:
    global _posts
    _posts = []


def get_post(index: int) -> Post | None:
    if index < 0 or index >= len(_posts):
        return None
    return _posts[index]


def count() -> int:
    return len(_posts)


def last_tone() -> Tone:
    return _tone
