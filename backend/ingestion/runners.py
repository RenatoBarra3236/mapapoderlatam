import logging
from datetime import datetime, timezone
from itertools import islice

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ingestion.base import BaseConnector, NormalizedEntity, NormalizedGraph, RawRecordInput
from ingestion.normalizers import canonicalize_name, payload_hash
from models import Entity, EntityIdentifier, IngestionRun, RawRecord, Relationship, Source

logger = logging.getLogger(__name__)


def upsert_entity(db: Session, normalized: NormalizedEntity) -> Entity:
    identifier = None
    for scheme, value in normalized.identifiers:
        identifier = (
            db.query(EntityIdentifier)
            .filter(
                EntityIdentifier.scheme == scheme,
                EntityIdentifier.value == value,
                EntityIdentifier.country_code == normalized.country_code,
            )
            .first()
        )
        if identifier:
            entity = identifier.entity
            break
    else:
        entity = None

    if not entity and normalized.external_id:
        entity = db.query(Entity).filter(Entity.external_id == normalized.external_id).first()
    if not entity:
        entity = Entity(
            external_id=normalized.external_id,
            canonical_name=canonicalize_name(normalized.name),
            display_name=normalized.name,
            entity_type=normalized.entity_type,
            country_code=normalized.country_code,
            entity_metadata=normalized.metadata,
            risk_score=normalized.risk_score,
        )
        db.add(entity)
        db.flush()
    else:
        entity.display_name = normalized.name or entity.display_name
        entity.canonical_name = canonicalize_name(entity.display_name)
        entity.entity_type = normalized.entity_type or entity.entity_type
        entity.entity_metadata = {**(entity.entity_metadata or {}), **(normalized.metadata or {})}
        entity.risk_score = max(entity.risk_score or 0, normalized.risk_score or 0)

    for scheme, value in normalized.identifiers:
        exists = (
            db.query(EntityIdentifier)
            .filter(
                EntityIdentifier.scheme == scheme,
                EntityIdentifier.value == value,
                EntityIdentifier.country_code == normalized.country_code,
            )
            .first()
        )
        if not exists:
            db.add(
                EntityIdentifier(
                    entity_id=entity.id,
                    scheme=scheme,
                    value=value,
                    country_code=normalized.country_code,
                    source_name=normalized.metadata.get("source_name"),
                )
            )
    return entity


def persist_graph(db: Session, graph: NormalizedGraph) -> int:
    source = Source(
        source_name=graph.source_name,
        source_type=graph.metadata.get("source_type", "public_api"),
        source_url=graph.source_url,
        external_id=graph.source_external_id,
        license=graph.metadata.get("license"),
        source_metadata=graph.metadata,
    )
    db.add(source)
    db.flush()

    by_key: dict[str, Entity] = {}
    for normalized_entity in graph.entities:
        normalized_entity.metadata.setdefault("source_name", graph.source_name)
        entity = upsert_entity(db, normalized_entity)
        by_key[normalized_entity.key] = entity

    created = 0
    for normalized_relationship in graph.relationships:
        source_entity = by_key.get(normalized_relationship.source_key)
        target_entity = by_key.get(normalized_relationship.target_key)
        if not source_entity or not target_entity:
            logger.warning("Skipping relationship with missing endpoint: %s", normalized_relationship)
            continue
        exists = (
            db.query(Relationship)
            .filter(
                Relationship.source_entity_id == source_entity.id,
                Relationship.target_entity_id == target_entity.id,
                Relationship.relationship_type == normalized_relationship.relationship_type,
            )
            .first()
        )
        if exists:
            exists.relationship_metadata = {
                **(exists.relationship_metadata or {}),
                **(normalized_relationship.metadata or {}),
            }
            continue
        db.add(
            Relationship(
                source_entity_id=source_entity.id,
                target_entity_id=target_entity.id,
                relationship_type=normalized_relationship.relationship_type,
                label=normalized_relationship.label,
                weight=normalized_relationship.weight,
                confidence_score=normalized_relationship.confidence_score,
                relationship_metadata=normalized_relationship.metadata,
                source_id=source.id,
            )
        )
        created += 1
    return created


def run_connector(db: Session, connector: BaseConnector, **kwargs) -> IngestionRun:
    limit = kwargs.pop("limit", None)
    batch_size = int(kwargs.pop("batch_size", 1000) or 1000)
    if batch_size < 1:
        batch_size = 1000
    run = IngestionRun(source_name=connector.source_name, status="running", run_metadata={"kwargs": {**kwargs, "limit": limit, "batch_size": batch_size}})
    db.add(run)
    db.commit()
    try:
        raw_records = connector.iter_fetch(**kwargs)
        if limit is not None:
            raw_records = islice(raw_records, int(limit))
        for raw in raw_records:
            run.records_fetched += 1
            raw_record = RawRecord(
                source_name=connector.source_name,
                external_id=raw.external_id,
                source_url=raw.source_url,
                payload_hash=payload_hash(raw.payload),
                payload=raw.payload,
                status="fetched",
            )
            db.add(raw_record)
            try:
                db.flush()
                graph = connector.normalize(raw)
                persist_graph(db, graph)
                raw_record.status = "processed"
                raw_record.processed_at = datetime.now(timezone.utc)
                run.records_processed += 1
            except IntegrityError:
                db.rollback()
                run = db.get(IngestionRun, run.id)
                run.records_failed += 1
                logger.exception("Duplicate or invalid raw record from %s", connector.source_name)
            except Exception as exc:
                raw_record.status = "failed"
                raw_record.error_message = str(exc)
                run.records_failed += 1
                logger.exception("Failed to process %s record %s", connector.source_name, raw.external_id)
            if run.records_fetched % batch_size == 0:
                run_id = run.id
                db.commit()
                db.expunge_all()
                run = db.get(IngestionRun, run_id)
        run.status = "completed" if run.records_failed == 0 else "completed_with_errors"
    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        logger.exception("Connector %s failed", connector.source_name)
    finally:
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
    return run
