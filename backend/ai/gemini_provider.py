from google import genai
from google.genai import types
from ai.provider import AIProvider

_MODEL = "gemini-3.1-flash-lite-preview"


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str):
        self._client = genai.Client(
            api_key=api_key,
            http_options={'timeout': 45.0}
        )


    @property
    def name(self) -> str:
        return "gemini"

    @property
    def model(self) -> str:
        return _MODEL

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
            model=_MODEL,
            contents=[
                *history,
                types.Content(role="user", parts=[types.Part(text=last_text)]),
            ],
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                max_output_tokens=max_tokens,
            ),
        )
        return response.text
