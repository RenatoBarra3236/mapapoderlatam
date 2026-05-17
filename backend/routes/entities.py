from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config.database import get_db
from controllers.graph_controller import get_entity

router = APIRouter()


@router.get("/{entity_id}")
async def read_entity(entity_id: int, db: Session = Depends(get_db)):
    entity = await get_entity(db, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
    return entity
