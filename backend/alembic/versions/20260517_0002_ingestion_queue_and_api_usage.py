"""ingestion queue and api usage counters

Revision ID: 20260517_0002
Revises: 20260517_0001
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260517_0002"
down_revision = "20260517_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ingestion_queue",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=120), nullable=False),
        sa.Column("record_type", sa.String(length=80), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="queued"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("discovered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.UniqueConstraint("source_name", "record_type", "external_id", name="uq_ingestion_queue_source_type_external"),
    )
    op.create_index("idx_ingestion_queue_status_priority", "ingestion_queue", ["source_name", "status", "priority"])
    op.create_index("idx_ingestion_queue_next_attempt", "ingestion_queue", ["next_attempt_at"])

    op.create_table(
        "api_usage_counters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=120), nullable=False),
        sa.Column("ticket_hash", sa.String(length=64), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("limit_count", sa.Integer(), nullable=False, server_default="9000"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_name", "ticket_hash", "usage_date", name="uq_api_usage_source_ticket_date"),
    )
    op.create_index("idx_api_usage_source_date", "api_usage_counters", ["source_name", "usage_date"])


def downgrade():
    op.drop_table("api_usage_counters")
    op.drop_table("ingestion_queue")
