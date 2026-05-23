"""In-memory cache of the last scrape (regenerate + agent context)."""

from models import ContentBrief, Language, Post, PostUnderstanding, Tone

_posts: list[Post] = []
_tone: Tone = "Punchy"
_language: Language = "en"
_understandings: dict[int, PostUnderstanding] = {}
_briefs: dict[int, ContentBrief] = {}


def set_run(posts: list[Post], tone: Tone, language: Language = "en") -> None:
    global _posts, _tone, _language, _understandings, _briefs
    _posts = list(posts)
    _tone = tone
    _language = language
    _understandings = {}
    _briefs = {}


def clear() -> None:
    global _posts, _understandings, _briefs
    _posts = []
    _understandings = {}
    _briefs = {}


def get_post(index: int) -> Post | None:
    if index < 0 or index >= len(_posts):
        return None
    return _posts[index]


def count() -> int:
    return len(_posts)


def last_tone() -> Tone:
    return _tone


def last_language() -> Language:
    return _language


def set_understanding(index: int, value: PostUnderstanding) -> None:
    _understandings[index] = value


def get_understanding(index: int) -> PostUnderstanding | None:
    return _understandings.get(index)


def set_brief(index: int, value: ContentBrief) -> None:
    _briefs[index] = value


def get_brief(index: int) -> ContentBrief | None:
    return _briefs.get(index)
