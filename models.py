from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


Tone = Literal["Punchy", "Story-led", "Analytical", "Educational"]


class Post(BaseModel):
    author: str
    text_content: str
    post_url: str
    scraped_at: datetime


class ReelsScript(BaseModel):
    hook: str
    script: str
    caption: str
    hashtags: list[str]
    cta: str


class AgentEvent(BaseModel):
    type: str
    agent: str
    message: str
    payload: dict[str, Any] = {}
    timestamp: datetime
