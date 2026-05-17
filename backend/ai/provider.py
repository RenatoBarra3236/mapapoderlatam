from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    async def chat(self, system: str, messages: list[dict], max_tokens: int = 1024) -> str: ...

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def model(self) -> str: ...


def get_provider(settings) -> "AIProvider":
    provider_name = (settings.AI_PROVIDER or "").lower().strip()

    if provider_name == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ValueError("AI_PROVIDER=gemini pero GEMINI_API_KEY no está configurado")
        from ai.gemini_provider import GeminiProvider
        return GeminiProvider(
            settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
            timeout_ms=settings.GEMINI_TIMEOUT_MS,
        )

    # Default: Claude
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("AI_PROVIDER=claude pero ANTHROPIC_API_KEY no está configurado")
    from ai.claude_provider import ClaudeProvider
    return ClaudeProvider(settings.ANTHROPIC_API_KEY)
