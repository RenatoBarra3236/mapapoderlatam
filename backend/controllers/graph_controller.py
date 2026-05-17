from sqlalchemy import text
from sqlalchemy.orm import Session
from models.node import Node
from models.edge import Edge

async def get_subgraph(db: Session, node_id: int, depth: int = 2):
    """
    Obtiene un subgrafo centrado en un nodo usando CTE recursivo.
    Expande hasta N grados de separación (máximo 3).
    """
    depth = min(depth, 3)

    query = text(f"""
    WITH RECURSIVE subgraph AS (
        -- Caso base: nodo inicial
        SELECT id, source_id, target_id FROM (
            SELECT id, id as source_id, id as target_id, 0 as level
            FROM nodes WHERE id = :node_id
            UNION ALL
            -- Relaciones salientes
            SELECT e.id, e.source_id, e.target_id, 1
            FROM edges e WHERE e.source_id = :node_id
            UNION ALL
            -- Relaciones entrantes
            SELECT e.id, e.source_id, e.target_id, 1
            FROM edges e WHERE e.target_id = :node_id
        ) as initial

        UNION ALL

        -- Expansión recursiva
        SELECT e.id, e.source_id, e.target_id
        FROM edges e
        INNER JOIN (
            SELECT source_id FROM subgraph WHERE source_id != target_id
            UNION
            SELECT target_id FROM subgraph WHERE source_id != target_id
        ) sg ON (e.source_id = sg.source_id OR e.target_id = sg.source_id)
        WHERE NOT EXISTS (
            SELECT 1 FROM subgraph s WHERE s.id = e.id
        )
    )
    SELECT DISTINCT
        n.id, n.external_id, n.type, n.name, n.country,
        n.meta, n.risk_score, n.created_at,
        CASE WHEN n.id = :node_id THEN 1 ELSE 0 END as is_root
    FROM nodes n
    WHERE n.id IN (
        SELECT source_id FROM subgraph
        UNION
        SELECT target_id FROM subgraph
        WHERE source_id != target_id
    )
    ORDER BY n.id
    """)

    nodes = db.execute(query, {"node_id": node_id}).fetchall()

    edges_query = text("""
    SELECT id, source_id, target_id, type, label, weight,
           source_url, valid_from, valid_to, metadata, created_at
    FROM edges
    WHERE source_id IN (
        SELECT n.id FROM nodes n
        WHERE n.id IN (
            WITH RECURSIVE visited AS (
                SELECT id FROM nodes WHERE id = :node_id
                UNION ALL
                SELECT DISTINCT e.source_id FROM edges e
                INNER JOIN visited v ON e.source_id = v.id OR e.target_id = v.id
            )
            SELECT id FROM visited
        )
    )
    OR target_id IN (
        SELECT n.id FROM nodes n
        WHERE n.id IN (
            WITH RECURSIVE visited AS (
                SELECT id FROM nodes WHERE id = :node_id
                UNION ALL
                SELECT DISTINCT e.target_id FROM edges e
                INNER JOIN visited v ON e.source_id = v.id OR e.target_id = v.id
            )
            SELECT id FROM visited
        )
    )
    """)

    edges = db.execute(edges_query, {"node_id": node_id}).fetchall()

    return {
        "nodes": [
            {
                "id": n[0],
                "external_id": n[1],
                "type": n[2],
                "name": n[3],
                "country": n[4],
                "metadata": n[5] or {},
                "risk_score": n[6],
                "created_at": n[7].isoformat() if n[7] else None,
                "is_root": bool(n[8])
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": e[0],
                "source_id": e[1],
                "target_id": e[2],
                "type": e[3],
                "label": e[4],
                "weight": float(e[5]) if e[5] else 1.0,
                "source_url": e[6],
                "valid_from": e[7].isoformat() if e[7] else None,
                "valid_to": e[8].isoformat() if e[8] else None,
                "metadata": e[9] or {}
            }
            for e in edges
        ]
    }

async def get_node_stats(db: Session, node_id: int):
    """Obtiene estadísticas de un nodo."""
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        return None

    out_edges = db.query(Edge).filter(Edge.source_id == node_id).count()
    in_edges = db.query(Edge).filter(Edge.target_id == node_id).count()

    contracts = db.query(Edge).filter(
        (Edge.source_id == node_id) | (Edge.target_id == node_id),
        Edge.type == "awarded"
    ).all()

    total_amount = sum(
        float(c.meta.get("amount", 0)) for c in contracts
        if c.meta and isinstance(c.meta, dict)
    )

    return {
        "id": node.id,
        "name": node.name,
        "type": node.type,
        "country": node.country,
        "out_degree": out_edges,
        "in_degree": in_edges,
        "total_degree": out_edges + in_edges,
        "contract_count": len(contracts),
        "total_amount": total_amount,
        "risk_score": node.risk_score
    }
