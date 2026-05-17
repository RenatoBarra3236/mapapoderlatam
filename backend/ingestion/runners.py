import contextlib
import logging
from datetime import datetime, timezone
from itertools import islice
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ingestion.base import BaseConnector, NormalizedEntity, NormalizedGraph, RawRecordInput
from ingestion.normalizers import canonicalize_name, payload_hash
from models import Entity, EntityIdentifier, IngestionRun, RawRecord, Relationship, Source

logger = logging.getLogger(__name__)


def upsert_entity(
    db: Session,
    normalized: NormalizedEntity,
    entity_cache: dict[tuple[str, str, str], Entity] | None = None,
    identifier_cache: set[tuple[str, str, str]] | None = None,
) -> Entity:
    cache_key_external = ("external_id", normalized.external_id or "", normalized.country_code)
    entity = entity_cache.get(cache_key_external) if entity_cache and normalized.external_id else None

    identifier = None
    if not entity:
        for scheme, value in normalized.identifiers:
            cache_key = (scheme, value, normalized.country_code)
            if entity_cache and cache_key in entity_cache:
                entity = entity_cache[cache_key]
                if identifier_cache is not None:
                    identifier_cache.add(cache_key)
                break
            if identifier_cache is not None and cache_key in identifier_cache:
                continue
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
                if identifier_cache is not None:
                    identifier_cache.add(cache_key)
                break

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
        cache_key = (scheme, value, normalized.country_code)
        if entity_cache is not None:
            entity_cache[cache_key] = entity
        if identifier_cache is not None and cache_key in identifier_cache:
            continue
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
        if identifier_cache is not None:
            identifier_cache.add(cache_key)
    if entity_cache is not None and normalized.external_id:
        entity_cache[cache_key_external] = entity
    return entity


def persist_graph(
    db: Session,
    graph: NormalizedGraph,
    entity_cache: dict[tuple[str, str, str], Entity] | None = None,
    identifier_cache: set[tuple[str, str, str]] | None = None,
    relationship_cache: dict[tuple[int, int, str], Relationship] | None = None,
) -> int:
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
        entity = upsert_entity(db, normalized_entity, entity_cache=entity_cache, identifier_cache=identifier_cache)
        by_key[normalized_entity.key] = entity

    created = 0
    for normalized_relationship in graph.relationships:
        source_entity = by_key.get(normalized_relationship.source_key)
        target_entity = by_key.get(normalized_relationship.target_key)
        if not source_entity or not target_entity:
            logger.warning("Skipping relationship with missing endpoint: %s", normalized_relationship)
            continue
        rel_key = (source_entity.id, target_entity.id, normalized_relationship.relationship_type)
        exists = relationship_cache.get(rel_key) if relationship_cache is not None else None
        if not exists:
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
            if relationship_cache is not None:
                relationship_cache[rel_key] = exists
            continue
        relationship = Relationship(
            source_entity_id=source_entity.id,
            target_entity_id=target_entity.id,
            relationship_type=normalized_relationship.relationship_type,
            label=normalized_relationship.label,
            weight=normalized_relationship.weight,
            confidence_score=normalized_relationship.confidence_score,
            relationship_metadata=normalized_relationship.metadata,
            source_id=source.id,
        )
        db.add(relationship)
        if relationship_cache is not None:
            relationship_cache[rel_key] = relationship
        created += 1
    return created


def run_connector(db: Session, connector: BaseConnector, **kwargs) -> IngestionRun:
    progress_callback = kwargs.pop("progress_callback", None)
    skip_existing = kwargs.pop("skip_existing", True)
    limit = kwargs.pop("limit", None)
    batch_size = int(kwargs.pop("batch_size", 1000) or 1000)
    if batch_size < 1:
        batch_size = 1000
    run = IngestionRun(source_name=connector.source_name, status="running", run_metadata={"kwargs": {**kwargs, "limit": limit, "batch_size": batch_size}})
    db.add(run)
    db.commit()
    entity_cache: dict[tuple[str, str, str], Entity] = {}
    identifier_cache: set[tuple[str, str, str]] = set()
    relationship_cache: dict[tuple[int, int, str], Relationship] = {}
    records_skipped = 0

    def clear_caches() -> None:
        entity_cache.clear()
        identifier_cache.clear()
        relationship_cache.clear()

    def emit_progress(stage: str, raw: RawRecordInput | None = None) -> None:
        if not progress_callback:
            return
        payload: dict[str, Any] = {
            "source_name": connector.source_name,
            "stage": stage,
            "records_fetched": run.records_fetched,
            "records_processed": run.records_processed,
            "records_failed": run.records_failed,
            "records_skipped": records_skipped,
        }
        if raw is not None:
            payload["external_id"] = raw.external_id
            payload["file"] = raw.payload.get("_file")
            payload["row_number"] = raw.payload.get("_row_number")
        try:
            progress_callback(payload)
        except Exception:
            logger.exception("Progress callback failed for %s", connector.source_name)

    try:
        raw_records = connector.iter_fetch(**kwargs)
        if limit is not None:
            raw_records = islice(raw_records, int(limit))
        for raw in raw_records:
            run.records_fetched += 1
            raw_hash = payload_hash(raw.payload)
            if skip_existing:
                exists = (
                    db.query(RawRecord.id)
                    .filter(RawRecord.source_name == connector.source_name, RawRecord.payload_hash == raw_hash)
                    .first()
                )
                if exists:
                    records_skipped += 1
                    emit_progress("skipped", raw)
                    if run.records_fetched % batch_size == 0:
                        run_id = run.id
                        db.commit()
                        db.expunge_all()
                        clear_caches()
                        run = db.get(IngestionRun, run_id)
                    continue
            raw_record = RawRecord(
                source_name=connector.source_name,
                external_id=raw.external_id,
                source_url=raw.source_url,
                payload_hash=raw_hash,
                payload=raw.payload,
                status="fetched",
            )
            try:
                nested_tx = db.begin_nested() if hasattr(db, "begin_nested") else contextlib.nullcontext()
                with nested_tx:
                    db.add(raw_record)
                    db.flush()
            except IntegrityError:
                records_skipped += 1
                clear_caches()
                logger.info("Skipping duplicate raw record from %s", connector.source_name)
                emit_progress("skipped", raw)
                continue

            try:
                nested_tx = db.begin_nested() if hasattr(db, "begin_nested") else contextlib.nullcontext()
                with nested_tx:
                    emit_progress("processing", raw)
                    graph = connector.normalize(raw)
                    persist_graph(
                        db,
                        graph,
                        entity_cache=entity_cache,
                        identifier_cache=identifier_cache,
                        relationship_cache=relationship_cache,
                    )
                    raw_record.status = "processed"
                    raw_record.processed_at = datetime.now(timezone.utc)
                    run.records_processed += 1
                emit_progress("processed", raw)
            except IntegrityError:
                raw_record.status = "failed"
                raw_record.error_message = "integrity error"
                run.records_failed += 1
                clear_caches()
                logger.exception("Duplicate or invalid raw record from %s", connector.source_name)
                emit_progress("failed", raw)
            except Exception as exc:
                raw_record.status = "failed"
                raw_record.error_message = str(exc)
                run.records_failed += 1
                clear_caches()
                logger.exception("Failed to process %s record %s", connector.source_name, raw.external_id)
                emit_progress("failed", raw)
            if run.records_fetched % batch_size == 0:
                run_id = run.id
                db.commit()
                db.expunge_all()
                clear_caches()
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
