from collections import deque

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import Entity, Relationship, RiskFlag, Source


def entity_to_node(entity: Entity, root_id: int | None = None) -> dict:
    return {
        "id": str(entity.id),
        "type": entity.entity_type,
        "name": entity.display_name,
        "subtitle": (entity.entity_metadata or {}).get("subtitle"),
        "country": entity.country_code,
        "risk": entity.risk_score,
        "riskScore": entity.risk_score,
        "metadata": entity.entity_metadata or {},
        "meta": entity.entity_metadata or {},
        "is_root": entity.id == root_id,
    }


def relationship_to_edge(relationship: Relationship, flagged_ids: set[int] | None = None) -> dict:
    flagged = relationship.id in (flagged_ids or set())
    return {
        "id": str(relationship.id),
        "source": str(relationship.source_entity_id),
        "target": str(relationship.target_entity_id),
        "source_id": str(relationship.source_entity_id),
        "target_id": str(relationship.target_entity_id),
        "s": str(relationship.source_entity_id),
        "t": str(relationship.target_entity_id),
        "type": relationship.relationship_type,
        "label": relationship.label,
        "weight": float(relationship.weight or 1),
        "confidenceScore": float(relationship.confidence_score or 1),
        "suspicious": flagged,
        "flag": flagged,
        "metadata": relationship.relationship_metadata or {},
    }


def risk_flag_to_api(flag: RiskFlag) -> dict:
    return {
        "id": str(flag.id),
        "severity": flag.severity,
        "type": flag.flag_type,
        "title": {"es": flag.title, "en": flag.title},
        "evidence": {"es": flag.description, "en": flag.description},
        "source": {
            "label": flag.evidence_source.source_name if flag.evidence_source else "Fuente registrada",
            "url": flag.evidence_source.source_url if flag.evidence_source else "#",
        },
        "metadata": flag.flag_metadata or {},
    }


async def get_subgraph(db: Session, node_id: int, depth: int = 2):
    depth = max(1, min(depth, 3))
    center = db.get(Entity, node_id)
    if not center:
        return {"center": str(node_id), "nodes": [], "edges": [], "flags": [], "timeline": [], "sources": []}

    visited = {center.id}
    frontier = deque([(center.id, 0)])
    relationship_ids: set[int] = set()

    while frontier:
        current_id, level = frontier.popleft()
        if level >= depth:
            continue
        relationships = (
            db.query(Relationship)
            .filter(or_(Relationship.source_entity_id == current_id, Relationship.target_entity_id == current_id))
            .all()
        )
        for relationship in relationships:
            relationship_ids.add(relationship.id)
            for next_id in (relationship.source_entity_id, relationship.target_entity_id):
                if next_id not in visited:
                    visited.add(next_id)
                    frontier.append((next_id, level + 1))

    entities = db.query(Entity).filter(Entity.id.in_(visited)).order_by(Entity.id).all()
    relationships = (
        db.query(Relationship)
        .filter(Relationship.id.in_(relationship_ids))
        .filter(Relationship.source_entity_id.in_(visited), Relationship.target_entity_id.in_(visited))
        .order_by(Relationship.id)
        .all()
    )
    flags = (
        db.query(RiskFlag)
        .filter(or_(RiskFlag.entity_id.in_(visited), RiskFlag.relationship_id.in_([r.id for r in relationships])))
        .all()
    )
    flagged_relationship_ids = {flag.relationship_id for flag in flags if flag.relationship_id}
    source_ids = {relationship.source_id for relationship in relationships if relationship.source_id}
    source_ids.update(flag.evidence_source_id for flag in flags if flag.evidence_source_id)
    sources = db.query(Source).filter(Source.id.in_(source_ids)).all() if source_ids else []

    return {
        "center": str(center.id),
        "rootId": str(center.id),
        "nodes": [entity_to_node(entity, center.id) for entity in entities],
        "edges": [relationship_to_edge(relationship, flagged_relationship_ids) for relationship in relationships],
        "flags": [risk_flag_to_api(flag) for flag in flags],
        "timeline": [],
        "sources": [
            {
                "id": str(source.id),
                "sourceName": source.source_name,
                "sourceType": source.source_type,
                "sourceUrl": source.source_url,
                "externalId": source.external_id,
                "fetchedAt": source.fetched_at.isoformat() if source.fetched_at else None,
                "metadata": source.source_metadata or {},
            }
            for source in sources
        ],
        "summary": {
            "es": f"Grafo centrado en {center.display_name}. IA real no habilitada; resumen generado desde datos estructurados.",
            "en": f"Graph centered on {center.display_name}. Real AI is not enabled; summary generated from structured data.",
        },
    }


async def get_entity(db: Session, entity_id: int):
    entity = db.get(Entity, entity_id)
    if not entity:
        return None
    return entity_to_node(entity, entity.id)


async def get_node_stats(db: Session, node_id: int):
    entity = db.get(Entity, node_id)
    if not entity:
        return None
    out_edges = db.query(Relationship).filter(Relationship.source_entity_id == node_id).count()
    in_edges = db.query(Relationship).filter(Relationship.target_entity_id == node_id).count()
    return {
        "id": str(entity.id),
        "name": entity.display_name,
        "type": entity.entity_type,
        "country": entity.country_code,
        "out_degree": out_edges,
        "in_degree": in_edges,
        "total_degree": out_edges + in_edges,
        "risk_score": entity.risk_score,
    }
