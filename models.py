from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


Tone = Literal["Punchy", "Story-led", "Analytical", "Educational"]
Language = Literal["en", "gu", "hi"]
PostType = Literal["text", "image", "carousel", "video", "mixed"]
StepStatus = Literal["started", "completed", "failed"]


class MediaAsset(BaseModel):
    kind: Literal["image", "carousel_slide", "video", "unknown"] = "image"
    url: str = ""
    slide_index: int | None = None


class Post(BaseModel):
    author: str
    text_content: str
    post_url: str
    scraped_at: datetime
    post_type: PostType = "text"
    media: list[MediaAsset] = Field(default_factory=list)
    has_media: bool = False


class PostUnderstanding(BaseModel):
    primary_intent: str
    audience: str
    content_format: str
    key_points: list[str] = Field(default_factory=list)
    visual_summary: str | None = None
    engagement_hooks: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    language_detected: str = "en"
    reasoning_public: str = ""


class ContentBrief(BaseModel):
    angle: str
    hook_direction: str
    structure: list[str] = Field(default_factory=list)
    cta_type: str = "follow"


class ReelsScript(BaseModel):
    hook: str
    script: str
    caption: str
    hashtags: list[str]
    cta: str
    language: Language = "en"


class AgentEvent(BaseModel):
    type: str
    agent: str
    message: str
    payload: dict[str, Any] = {}
    timestamp: datetime
