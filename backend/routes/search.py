from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from config.database import get_db
from controllers.search_controller import search

router = APIRouter()

@router.get("")
async def search_nodes(
    q: str = Query(..., min_length=2),
    type: str = Query(None),
    country: str = Query(None),
    limit: int = Query(10, le=100),
    db: Session = Depends(get_db)
):
    """Búsqueda de entidades por nombre o identificador."""
    result = await search(db, q, type, country, limit)
    if isinstance(result, tuple):  # Error response
        raise HTTPException(status_code=result[1], detail=result[0]["error"])
    return result
