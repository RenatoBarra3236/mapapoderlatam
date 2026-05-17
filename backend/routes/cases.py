from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import get_db
from controllers.graph_controller import get_subgraph
from models import Entity

router = APIRouter()


def _case_summary(entity: Entity) -> dict:
    metadata = entity.entity_metadata or {}
    return {
        "id": str(entity.id),
        "entityId": str(entity.id),
        "name": entity.display_name,
        "type": entity.entity_type,
        "country": entity.country_code,
        "riskScore": entity.risk_score,
        "sourceMode": metadata.get("source_mode"),
        "sourceName": metadata.get("source_name"),
        "isDemo": metadata.get("source_mode") == "fixture" or metadata.get("is_demo") is True,
        "metadata": metadata,
    }


@router.get("")
async def list_cases(
    limit: int = Query(6, le=20),
    include_demo: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(Entity)
    if not include_demo:
        query = query.filter(Entity.entity_metadata["source_mode"].astext == "real_api")

    entities = (
        query
        .order_by(Entity.risk_score.desc(), Entity.display_name.asc())
        .limit(limit)
        .all()
    )

    if not entities and not include_demo:
        entities = (
            db.query(Entity)
            .order_by(Entity.risk_score.desc(), Entity.display_name.asc())
            .limit(limit)
            .all()
        )

    return [_case_summary(entity) for entity in entities]


@router.get("/{case_id}")
async def read_case(case_id: int, db: Session = Depends(get_db)):
    graph = await get_subgraph(db, case_id, depth=2)
    if not graph["nodes"]:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return graph
