import anthropic
from ai.provider import AIProvider

_MODEL = "claude-sonnet-4-6"


class ClaudeProvider(AIProvider):
    def __init__(self, api_key: str):
        self._client = anthropic.AsyncAnthropic(api_key=api_key, timeout=45.0)

    @property
    def name(self) -> str:
        return "claude"

    @property
    def model(self) -> str:
        return _MODEL

    async def chat(self, system: str, messages: list[dict], max_tokens: int = 1024) -> str:
        response = await self._client.messages.create(
            model=_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return response.content[0].text
