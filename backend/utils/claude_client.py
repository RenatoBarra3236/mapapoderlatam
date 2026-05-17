DEFAULT_MODEL = "claude-sonnet-4-6"


async def ask_claude(
    prompt: str,
    system: str | list[dict] | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 1024,
) -> str:
    """
    AI integration intentionally left as stub for a future product phase.
    """
    raise RuntimeError("AI integration is disabled in this phase.")
