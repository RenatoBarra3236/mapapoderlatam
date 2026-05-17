from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from models import Entity, EntityIdentifier


def _entity_result(entity: Entity, matched_identifiers: list[str] | None = None) -> dict:
    return {
        "id": str(entity.id),
        "external_id": entity.external_id,
        "name": entity.display_name,
        "type": entity.entity_type,
        "country": entity.country_code,
        "riskScore": entity.risk_score,
        "risk_score": entity.risk_score,
        "matchedIdentifiers": matched_identifiers or [],
        "metadata": entity.entity_metadata or {},
    }


async def search(
    db: Session,
    q: str,
    node_type: str | None = None,
    country: str | None = None,
    limit: int = 10,
):
    if len(q.strip()) < 2:
        return {"error": "Query debe tener al menos 2 caracteres"}, 400

    query_text = q.strip()
    identifier_matches = (
        db.query(EntityIdentifier)
        .filter(EntityIdentifier.value.ilike(f"%{query_text}%"))
        .limit(limit)
        .all()
    )
    matched_by_entity: dict[int, list[str]] = {}
    for identifier in identifier_matches:
        matched_by_entity.setdefault(identifier.entity_id, []).append(f"{identifier.scheme}:{identifier.value}")

    query = db.query(Entity).options(selectinload(Entity.identifiers))
    query = query.filter(
        or_(
            Entity.canonical_name.ilike(f"%{query_text}%"),
            Entity.display_name.ilike(f"%{query_text}%"),
            Entity.id.in_(matched_by_entity.keys()) if matched_by_entity else False,
        )
    )
    if node_type:
        query = query.filter(Entity.entity_type == node_type)
    if country:
        query = query.filter(Entity.country_code == country.upper())

    similarity_rank = func.greatest(
        func.similarity(Entity.canonical_name, query_text),
        func.similarity(Entity.display_name, query_text),
    )
    entities = (
        query.order_by(similarity_rank.desc(), Entity.risk_score.desc(), Entity.display_name.asc())
        .limit(limit)
        .all()
    )

    return [
        _entity_result(entity, matched_by_entity.get(entity.id))
        for entity in entities
    ]
