from sqlalchemy import Date, DateTime, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


class IngestionQueueItem(Base):
    __tablename__ = "ingestion_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), nullable=False)
    record_type: Mapped[str] = mapped_column(String(80), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="queued", nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    discovered_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_attempt_at = mapped_column(DateTime(timezone=True), nullable=True)
    next_attempt_at = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    queue_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("source_name", "record_type", "external_id", name="uq_ingestion_queue_source_type_external"),
        Index("idx_ingestion_queue_status_priority", "source_name", "status", "priority"),
        Index("idx_ingestion_queue_next_attempt", "next_attempt_at"),
    )


class ApiUsageCounter(Base):
    __tablename__ = "api_usage_counters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), nullable=False)
    ticket_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    usage_date = mapped_column(Date, nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    limit_count: Mapped[int] = mapped_column(Integer, default=9000, nullable=False)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("source_name", "ticket_hash", "usage_date", name="uq_api_usage_source_ticket_date"),
        Index("idx_api_usage_source_date", "source_name", "usage_date"),
    )
