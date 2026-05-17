from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from config.database import get_db
from controllers.graph_controller import get_subgraph, get_node_stats

router = APIRouter()

@router.get("/{node_id}")
async def get_graph(
    node_id: int,
    depth: int = 2,
    db: Session = Depends(get_db)
):
    """Obtiene subgrafo centrado en una entidad."""
    result = await get_subgraph(db, node_id, depth)
    if not result["nodes"]:
        raise HTTPException(status_code=404, detail="Nodo no encontrado")
    return result

@router.get("/{node_id}/stats")
async def get_stats(
    node_id: int,
    db: Session = Depends(get_db)
):
    """Obtiene estadísticas de un nodo."""
    stats = await get_node_stats(db, node_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Nodo no encontrado")
    return stats
