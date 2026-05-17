from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config.settings import get_settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatContext(BaseModel):
    entity_name: str = ""
    entity_type: str = ""
    summary: str = ""
    node_count: int = 0
    edge_count: int = 0
    flagged_count: int = 0
    nodes: list[dict] = []
    edges: list[dict] = []
    flags: list[dict] = []


class ChatRequest(BaseModel):
    message: str
    context: ChatContext
    lang: str = "es"
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    provider: str
    model: str


def _build_system_prompt(ctx: ChatContext, lang: str) -> str:
    def _node_line(n: dict) -> str:
        risk = f", riesgo {n['risk']}" if n.get("risk") else ""
        return f"- {n.get('name', '?')} ({n.get('type', '?')}){risk}"

    nodes_text = "\n".join(_node_line(n) for n in ctx.nodes[:20])
    edges_text = "\n".join(
        f"- {e.get('from', '?')} → {e.get('relation', '?')} → {e.get('to', '?')}"
        f"{' [SEÑALADA]' if e.get('flag') else ''}"
        for e in ctx.edges[:25]
    )
    flags_text = "\n".join(
        f"- [{f.get('severity', '?').upper()}] {f.get('title', '')}: {f.get('evidence', '')}"
        for f in ctx.flags[:10]
    )

    if lang == "es":
        return f"""Eres un asistente de análisis de transparencia de la plataforma Mapa de Poder LATAM. \
Ayudas a interpretar redes de poder político, empresarial y contractual basadas en fuentes públicas.

CASO ACTIVO:
Entidad central: {ctx.entity_name}{f' ({ctx.entity_type})' if ctx.entity_type else ''}
Red: {ctx.node_count} entidades, {ctx.edge_count} relaciones documentadas, {ctx.flagged_count} señales de riesgo
{f'Resumen: {ctx.summary}' if ctx.summary else ''}

ENTIDADES EN LA RED:
{nodes_text or '(sin datos)'}

RELACIONES DOCUMENTADAS:
{edges_text or '(sin datos)'}

SEÑALES DE RIESGO:
{flags_text or 'No se detectaron señales de riesgo'}

INSTRUCCIONES:
- Responde solo sobre información visible en esta red
- Usa lenguaje prudente: "vínculo documentado", "señal de riesgo registrada", "relación de fuente pública"
- NO afirmes corrupción, delito ni culpabilidad
- Si no tienes suficiente información, dilo explícitamente
- Sé conciso y directo
- Responde en español"""
    else:
        return f"""You are a transparency analysis assistant for the Mapa de Poder LATAM platform. \
You help interpret networks of political, business, and contractual power based on public sources.

ACTIVE CASE:
Central entity: {ctx.entity_name}{f' ({ctx.entity_type})' if ctx.entity_type else ''}
Network: {ctx.node_count} entities, {ctx.edge_count} documented relationships, {ctx.flagged_count} risk signals
{f'Summary: {ctx.summary}' if ctx.summary else ''}

ENTITIES IN THE NETWORK:
{nodes_text or '(no data)'}

DOCUMENTED RELATIONSHIPS:
{edges_text or '(no data)'}

RISK SIGNALS:
{flags_text or 'No risk signals detected'}

INSTRUCTIONS:
- Answer only about information visible in this network
- Use cautious language: "documented tie", "registered risk signal", "public source relationship"
- DO NOT claim corruption, crime, or guilt
- If you lack enough information, say so explicitly
- Be concise and direct
- Respond in English"""


@router.post("", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    settings = get_settings()

    try:
        from ai.provider import get_provider
        provider = get_provider(settings)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"Dependencia de IA no instalada: {exc}")

    system = _build_system_prompt(req.context, req.lang)
    messages = [{"role": m.role, "content": m.content} for m in req.history]
    messages.append({"role": "user", "content": req.message})

    try:
        reply = await provider.chat(system=system, messages=messages, max_tokens=600)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error del proveedor IA: {exc}")

    return ChatResponse(reply=reply, provider=provider.name, model=provider.model)
