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


def derived_risk_flags(entities: list[Entity], relationships: list[Relationship], existing: list[RiskFlag]) -> list[dict]:
    existing_entity_ids = {flag.entity_id for flag in existing if flag.entity_id}
    existing_relationship_ids = {flag.relationship_id for flag in existing if flag.relationship_id}
    out = []

    for entity in sorted(entities, key=lambda item: item.risk_score or 0, reverse=True):
        if len(out) >= 8:
            break
        if entity.id in existing_entity_ids:
            continue
        risk = entity.risk_score or 0
        if risk < 40:
            continue
        severity = "high" if risk >= 65 else "medium"
        out.append({
            "id": f"derived-entity-{entity.id}",
            "severity": severity,
            "type": "derived_risk_score",
            "title": {"es": "Score de riesgo elevado", "en": "Elevated risk score"},
            "evidence": {
                "es": f"{entity.display_name} registra score {risk}. Es una señal derivada de los datos cargados y requiere revisión de fuentes.",
                "en": f"{entity.display_name} has risk score {risk}. This is derived from loaded data and requires source review.",
            },
            "source": {"label": "Indicador derivado", "url": "#"},
            "metadata": {"derived": True, "entity_id": entity.id, "risk_score": risk},
        })

    for relationship in relationships:
        if len(out) >= 10:
            break
        if relationship.id in existing_relationship_ids:
            continue
        confidence = float(relationship.confidence_score or 1)
        if confidence >= 0.55:
            continue
        out.append({
            "id": f"derived-relationship-{relationship.id}",
            "severity": "medium",
            "type": "low_confidence_relationship",
            "title": {"es": "Relación con baja confianza", "en": "Low-confidence relationship"},
            "evidence": {
                "es": f"Relación {relationship.relationship_type} con confianza {confidence:.2f}. Debe validarse contra la fuente antes de inferir conclusiones.",
                "en": f"Relationship {relationship.relationship_type} has confidence {confidence:.2f}. Validate against the source before drawing conclusions.",
            },
            "source": {"label": "Indicador derivado", "url": "#"},
            "metadata": {"derived": True, "relationship_id": relationship.id, "confidence_score": confidence},
        })

    return out


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

    persisted_flags = [risk_flag_to_api(flag) for flag in flags]
    derived_flags = derived_risk_flags(entities, relationships, flags)

    return {
        "center": str(center.id),
        "rootId": str(center.id),
        "nodes": [entity_to_node(entity, center.id) for entity in entities],
        "edges": [relationship_to_edge(relationship, flagged_relationship_ids) for relationship in relationships],
        "flags": persisted_flags + derived_flags,
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
            "es": f"Red centrada en {center.display_name}.",
            "en": f"Network centered on {center.display_name}.",
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
