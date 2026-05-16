import os
from anthropic import Anthropic
from config.settings import get_settings

settings = get_settings()

client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

async def ask_claude(prompt: str, model: str = "claude-3-5-sonnet-20241022") -> str:
    """
    Hace una pregunta a Claude y retorna la respuesta.
    """
    try:
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        )
        return message.content[0].text
    except Exception as e:
        raise Exception(f"Error calling Claude API: {str(e)}")
