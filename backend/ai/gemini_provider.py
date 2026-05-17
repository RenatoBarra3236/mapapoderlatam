from google import genai
from google.genai import types
from ai.provider import AIProvider

_MODEL = "gemini-3.1-flash-lite-preview"


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str = _MODEL, timeout_ms: int = 45000):
        self._model = model or _MODEL
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=max(int(timeout_ms or 45000), 1000)),
        )


    @property
    def name(self) -> str:
        return "gemini"

    @property
    def model(self) -> str:
        return self._model

    async def chat(self, system: str, messages: list[dict], max_tokens: int = 1024) -> str:
        history = []
        for msg in messages[:-1]:
            role = "user" if msg["role"] == "user" else "model"
            history.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

        last_text = messages[-1]["content"] if messages else ""

        # thinking models require system_instruction as Content, not plain string
        system_content = types.Content(
            role="user",
            parts=[types.Part(text=system)],
        )

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=[
                *history,
                types.Content(role="user", parts=[types.Part(text=last_text)]),
            ],
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                max_output_tokens=max_tokens,
            ),
        )
        text = response.text or ""
        if not text.strip():
            raise RuntimeError("Gemini returned an empty response")
        return text
