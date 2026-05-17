from anthropic import AsyncAnthropic
from config.settings import get_settings

settings = get_settings()

client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

DEFAULT_MODEL = "claude-sonnet-4-6"


async def ask_claude(
    prompt: str,
    system: str | list[dict] | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 1024,
) -> str:
    """
    Llama a Claude y retorna la respuesta de texto.

    Si `system` es un string, se envuelve como bloque de texto con cache_control
    ephemeral para que el contexto del subgrafo se cachee entre llamadas al mismo
    nodo (ahorro ~90% en tokens repetidos). El prefijo debe ser >=1024 tokens
    para que el cache se active.
    """
    if isinstance(system, str):
        system_param = [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ]
    else:
        system_param = system

    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_param is not None:
        kwargs["system"] = system_param

    message = await client.messages.create(**kwargs)
    return message.content[0].text
