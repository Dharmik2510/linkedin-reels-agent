import os
from dotenv import load_dotenv

load_dotenv()


def _get_required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise ValueError(f"Missing required environment variable: {key}")
    return val


ANTHROPIC_API_KEY: str = _get_required("ANTHROPIC_API_KEY")
LINKEDIN_EMAIL: str = _get_required("LINKEDIN_EMAIL")
LINKEDIN_PASSWORD: str = _get_required("LINKEDIN_PASSWORD")

MAX_RUN_BUDGET_USD: float = float(os.getenv("REELIFY_MAX_RUN_BUDGET_USD", "2.0"))
