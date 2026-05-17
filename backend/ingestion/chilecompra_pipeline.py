import hashlib
import os
import time
from dataclasses import dataclass
from datetime import date, datetime, time as dtime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ingestion.normalizers import payload_hash
from ingestion.runners import persist_graph
from ingestion.sources.chilecompra import (
    ChileCompraConnector,
    ChileCompraTransientError,
    LICITACIONES_URL,
    ORDEN_COMPRA_URL,
    ORDENES_COMPRA_URL,
)
from models import ApiUsageCounter, IngestionQueueItem, IngestionRun, RawRecord

SOURCE_NAME = "chilecompra"
DEFAULT_DAILY_BUDGET = 9000
TIMEZONE = ZoneInfo("America/Santiago")


@dataclass
class PipelineStats:
    discovered: int = 0
    queued: int = 0
    processed: int = 0
    failed: int = 0
    skipped: int = 0
    requests_used: int = 0


def is_night_window(now: datetime | None = None, night_start: str = "22:00", night_end: str = "07:00") -> bool:
    now = now or datetime.now(TIMEZONE)
    start = _parse_time(night_start)
    end = _parse_time(night_end)
    current = now.timetz().replace(tzinfo=None)
    if start <= end:
        return start <= current < end
    return current >= start or current < end


def seconds_until_night_window(now: datetime | None = None, night_start: str = "22:00") -> int:
    now = now or datetime.now(TIMEZONE)
    start = _parse_time(night_start)
    target = now.replace(hour=start.hour, minute=start.minute, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return max(1, int((target - now).total_seconds()))


def discover_chilecompra(
    db: Session,
    target_date: date,
    kind: str = "all",
    estado: str | None = None,
    daily_budget: int = DEFAULT_DAILY_BUDGET,
) -> PipelineStats:
    ticket = _ticket()
    stats = PipelineStats()
    connector = ChileCompraConnector()
    fecha = target_date.strftime("%d%m%Y")
    requested_kinds = ["licitaciones", "ordenes_compra"] if kind == "all" else [kind]

    for current_kind in requested_kinds:
        if not consume_quota(db, ticket, daily_budget):
            break
        db.commit()
        stats.requests_used += 1
        try:
            records = connector.discover(kind=current_kind, ticket=ticket, fecha=fecha, estado=estado)
        except ChileCompraTransientError as exc:
            if not exc.quota_counted:
                refund_quota(db, ticket)
                stats.requests_used -= 1
                db.commit()
            raise
        for raw in records:
            stats.discovered += 1
            if enqueue_record(db, raw.payload["_record_type"], raw.external_id, raw.source_url, raw.payload):
                stats.queued += 1
        db.commit()
    return stats


def hydrate_chilecompra_queue(
    db: Session,
    budget: int = 500,
    daily_budget: int = DEFAULT_DAILY_BUDGET,
    sleep_seconds: float = 0.2,
) -> PipelineStats:
    ticket = _ticket()
    connector = ChileCompraConnector()
    stats = PipelineStats()

    while stats.requests_used < budget:
        item = next_queue_item(db)
        if not item:
            break
        if not consume_quota(db, ticket, daily_budget):
            break
        db.commit()
        stats.requests_used += 1
        item.status = "processing"
        item.last_attempt_at = datetime.now(TIMEZONE)
        item.attempts += 1
        db.commit()
        try:
            records = _fetch_detail(connector, item, ticket)
            if not records:
                item.status = "skipped"
                item.error_message = "API detail returned no records"
                stats.skipped += 1
            for raw in records:
                save_and_process_raw(db, raw)
                item.status = "processed"
                item.error_message = None
                stats.processed += 1
            db.commit()
        except Exception as exc:
            if isinstance(exc, ChileCompraTransientError) and not exc.quota_counted:
                refund_quota(db, ticket)
                stats.requests_used -= 1
            item.status = "failed" if item.attempts >= 5 else "queued"
            item.error_message = str(exc)
            item.next_attempt_at = datetime.now(TIMEZONE) + timedelta(minutes=min(60, 2**item.attempts))
            stats.failed += 1
            db.commit()
        if sleep_seconds:
            time.sleep(sleep_seconds)
    return stats


def enqueue_record(db: Session, record_type: str, external_id: str | None, source_url: str | None, payload: dict) -> bool:
    if not external_id:
        return False
    exists = (
        db.query(IngestionQueueItem)
        .filter(
            IngestionQueueItem.source_name == SOURCE_NAME,
            IngestionQueueItem.record_type == record_type,
            IngestionQueueItem.external_id == external_id,
        )
        .first()
    )
    if exists:
        exists.queue_metadata = {**(exists.queue_metadata or {}), **_queue_metadata(payload)}
        if exists.status in {"failed", "skipped"}:
            exists.status = "queued"
        return False
    db.add(
        IngestionQueueItem(
            source_name=SOURCE_NAME,
            record_type=record_type,
            external_id=external_id,
            status="queued",
            priority=_priority(payload),
            source_url=source_url,
            queue_metadata=_queue_metadata(payload),
        )
    )
    return True


def next_queue_item(db: Session) -> IngestionQueueItem | None:
    now = datetime.now(TIMEZONE)
    return (
        db.query(IngestionQueueItem)
        .filter(
            IngestionQueueItem.source_name == SOURCE_NAME,
            IngestionQueueItem.status == "queued",
            or_(IngestionQueueItem.next_attempt_at.is_(None), IngestionQueueItem.next_attempt_at <= now),
        )
        .order_by(IngestionQueueItem.priority.asc(), IngestionQueueItem.discovered_at.asc())
        .first()
    )


def save_and_process_raw(db: Session, raw) -> None:
    raw_hash = payload_hash(raw.payload)
    exists = (
        db.query(RawRecord)
        .filter(RawRecord.source_name == SOURCE_NAME, RawRecord.payload_hash == raw_hash)
        .first()
    )
    if exists and exists.status == "processed":
        return
    raw_record = exists or RawRecord(
        source_name=SOURCE_NAME,
        external_id=raw.external_id,
        source_url=raw.source_url,
        payload_hash=raw_hash,
        payload=raw.payload,
        status="fetched",
    )
    db.add(raw_record)
    db.flush()
    graph = ChileCompraConnector().normalize(raw)
    persist_graph(db, graph)
    raw_record.status = "processed"
    raw_record.processed_at = datetime.now(TIMEZONE)


def consume_quota(db: Session, ticket: str, daily_budget: int) -> bool:
    today = datetime.now(TIMEZONE).date()
    ticket_hash = hashlib.sha256(ticket.encode("utf-8")).hexdigest()
    counter = (
        db.query(ApiUsageCounter)
        .filter(
            ApiUsageCounter.source_name == SOURCE_NAME,
            ApiUsageCounter.ticket_hash == ticket_hash,
            ApiUsageCounter.usage_date == today,
        )
        .first()
    )
    if not counter:
        counter = ApiUsageCounter(source_name=SOURCE_NAME, ticket_hash=ticket_hash, usage_date=today, limit_count=daily_budget)
        db.add(counter)
        db.flush()
    if counter.request_count >= min(counter.limit_count, daily_budget):
        return False
    counter.request_count += 1
    counter.limit_count = daily_budget
    db.flush()
    return True


def refund_quota(db: Session, ticket: str) -> None:
    today = datetime.now(TIMEZONE).date()
    ticket_hash = hashlib.sha256(ticket.encode("utf-8")).hexdigest()
    counter = (
        db.query(ApiUsageCounter)
        .filter(
            ApiUsageCounter.source_name == SOURCE_NAME,
            ApiUsageCounter.ticket_hash == ticket_hash,
            ApiUsageCounter.usage_date == today,
        )
        .first()
    )
    if counter and counter.request_count > 0:
        counter.request_count -= 1
        db.flush()


def _fetch_detail(connector: ChileCompraConnector, item: IngestionQueueItem, ticket: str):
    if item.record_type == "purchase_order":
        return connector.fetch(kind="ordenes_compra", ticket=ticket, codigo=item.external_id)
    return connector.fetch(kind="licitaciones", ticket=ticket, codigo=item.external_id)


def _queue_metadata(payload: dict) -> dict:
    record = payload.get("record", payload)
    return {
        "status_code": record.get("CodigoEstado"),
        "status": record.get("Estado"),
        "name": record.get("Nombre"),
        "estimated_amount": record.get("MontoEstimado") or record.get("Total"),
        "buyer": (record.get("Comprador") or {}).get("NombreOrganismo"),
        "discovery": bool(payload.get("_discovery")),
    }


def _priority(payload: dict) -> int:
    record = payload.get("record", payload)
    status = str(record.get("Estado") or "").lower()
    status_code = record.get("CodigoEstado")
    amount = record.get("MontoEstimado") or record.get("Total") or 0
    try:
        amount = float(amount or 0)
    except (TypeError, ValueError):
        amount = 0
    priority = 100
    if "adjudic" in status or status_code in {8, "8"}:
        priority -= 40
    if amount >= 1_000_000_000:
        priority -= 30
    elif amount >= 100_000_000:
        priority -= 15
    buyer = str((record.get("Comprador") or {}).get("NombreOrganismo") or "").lower()
    if any(term in buyer for term in ["municipalidad", "salud", "hospital", "obras publicas", "gobierno regional"]):
        priority -= 10
    return max(1, priority)


def _ticket() -> str:
    ticket = os.getenv("CHILECOMPRA_TICKET")
    if not ticket:
        raise RuntimeError("CHILECOMPRA_TICKET es obligatorio para ChileCompra real.")
    return ticket


def is_date_discovered(db: Session, target_date: date, kind: str) -> bool:
    """True if a successful discovery run exists for this date+kind."""
    return (
        db.query(IngestionRun)
        .filter(
            IngestionRun.source_name == SOURCE_NAME,
            IngestionRun.status == "completed",
            IngestionRun.run_metadata["target_date"].astext == str(target_date),
            IngestionRun.run_metadata["kind"].astext == kind,
        )
        .first()
        is not None
    )


def mark_date_discovered(db: Session, target_date: date, kind: str, stats: PipelineStats) -> None:
    """Record a completed discovery run so backfill can skip it on restart."""
    run = IngestionRun(
        source_name=SOURCE_NAME,
        status="completed",
        records_fetched=stats.discovered,
        records_processed=stats.queued,
        run_metadata={
            "target_date": str(target_date),
            "kind": kind,
            "discovered": stats.discovered,
            "queued": stats.queued,
            "requests_used": stats.requests_used,
        },
    )
    db.add(run)
    db.flush()


def _parse_time(value: str) -> dtime:
    hour, minute = value.split(":", 1)
    return dtime(hour=int(hour), minute=int(minute))
