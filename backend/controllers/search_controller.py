from sqlalchemy import text
from sqlalchemy.orm import Session
from models.node import Node

async def search(
    db: Session,
    q: str,
    node_type: str = None,
    country: str = None,
    limit: int = 10
):
    """
    Búsqueda full-text en nodos de MySQL.
    Soporta búsqueda por nombre con LIKE.
    """
    if len(q) < 2:
        return {"error": "Query debe tener al menos 2 caracteres"}, 400

    query = db.query(Node)

    # Búsqueda por nombre (LIKE)
    query = query.filter(Node.name.ilike(f"%{q}%"))

    # Filtros opcionales
    if node_type:
        query = query.filter(Node.type == node_type)
    if country:
        query = query.filter(Node.country == country)

    # Orden por risk_score (descendente) y nombre (ascendente)
    results = query.order_by(
        Node.risk_score.desc(),
        Node.name.asc()
    ).limit(limit).all()

    return {
        "query": q,
        "results": [
            {
                "id": r.id,
                "external_id": r.external_id,
                "type": r.type,
                "name": r.name,
                "country": r.country,
                "metadata": r.meta or {},
                "risk_score": r.risk_score,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in results
        ],
        "total": len(results)
    }
