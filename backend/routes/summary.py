from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai.provider import get_provider
from ai.summarizer import build_context_message, get_system_prompt
from config.database import get_db
from config.settings import get_settings
from controllers.graph_controller import get_subgraph
from models.ai_summary import AISummaryCache

router = APIRouter()


@router.get("/{entity_id}")
async def get_summary(entity_id: int, lang: str = "es", db: Session = Depends(get_db)):
    if lang not in ("es", "en"):
        lang = "es"

    cached = (
        db.query(AISummaryCache)
        .filter(AISummaryCache.entity_id == entity_id, AISummaryCache.lang == lang)
        .first()
    )
    if cached:
        return {
            "entity_id": entity_id,
            "lang": lang,
            "summary": cached.summary_text,
            "provider": cached.provider,
            "model": cached.model,
            "cached": True,
        }

    settings = get_settings()
    try:
        provider = get_provider(settings)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=f"AI provider not configured: {e}")

    graph = await get_subgraph(db, entity_id, depth=2)
    if not graph.get("nodes"):
        raise HTTPException(status_code=404, detail="Entity not found")

    graph["rootId"] = str(entity_id)
    system = get_system_prompt(lang)
    context_msg = build_context_message(graph, lang)

    try:
        summary_text = await provider.chat(
            system=system,
            messages=[{"role": "user", "content": context_msg}],
            max_tokens=700,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")

    record = AISummaryCache(
        entity_id=entity_id,
        lang=lang,
        summary_text=summary_text,
        provider=provider.name,
        model=provider.model,
    )
    db.add(record)
    db.commit()

    return {
        "entity_id": entity_id,
        "lang": lang,
        "summary": summary_text,
        "provider": provider.name,
        "model": provider.model,
        "cached": False,
    }
