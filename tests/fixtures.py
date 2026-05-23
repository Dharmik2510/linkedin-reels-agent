from datetime import datetime, timezone

from models import ContentBrief, Post, PostUnderstanding, ReelsScript

SAMPLE_UNDERSTANDING = PostUnderstanding(
    primary_intent="educate",
    audience="professionals",
    content_format="text",
    key_points=["AI changes work", "Learning is continuous"],
    engagement_hooks=["What if AI replaced your job tomorrow?"],
    confidence=0.9,
    language_detected="en",
    reasoning_public="Educational text post aimed at professionals.",
)

SAMPLE_BRIEF = ContentBrief(
    angle="Practical AI literacy",
    hook_direction="Open with a provocative question about daily work",
    structure=["Hook", "Problem", "Insight", "Action", "CTA"],
    cta_type="follow",
)

SAMPLE_SCRIPT = ReelsScript(
    hook="Test hook here now",
    script="Test spoken script content",
    caption="Test caption #test",
    hashtags=["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    cta="Follow me right now",
    language="en",
)

SAMPLE_POST = Post(
    author="Jane Doe",
    text_content="AI is transforming how we work and learn every single day.",
    post_url="https://linkedin.com/posts/123",
    scraped_at=datetime.now(timezone.utc),
)

SAMPLE_POSTS = [
    Post(
        author=f"Author {i}",
        text_content=f"Content {i}",
        post_url=f"https://linkedin.com/posts/{i}",
        scraped_at=datetime.now(timezone.utc),
    )
    for i in range(3)
]
