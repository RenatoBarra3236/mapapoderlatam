from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config.database import get_db
from controllers.graph_controller import get_subgraph
from models import Entity

router = APIRouter()


@router.get("")
async def list_cases(limit: int = Query(6, le=20), db: Session = Depends(get_db)):
    entities = (
        db.query(Entity)
        .order_by(Entity.risk_score.desc(), Entity.display_name.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(entity.id),
            "entityId": str(entity.id),
            "name": entity.display_name,
            "type": entity.entity_type,
            "country": entity.country_code,
            "riskScore": entity.risk_score,
            "metadata": entity.entity_metadata or {},
        }
        for entity in entities
    ]


@router.get("/{case_id}")
async def read_case(case_id: int, db: Session = Depends(get_db)):
    graph = await get_subgraph(db, case_id, depth=2)
    if not graph["nodes"]:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return graph
