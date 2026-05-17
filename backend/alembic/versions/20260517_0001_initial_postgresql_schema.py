"""initial postgresql schema

Revision ID: 20260517_0001
Revises:
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260517_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "entities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("canonical_name", sa.String(length=500), nullable=False),
        sa.Column("display_name", sa.String(length=500), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False, server_default="CL"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("risk_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_entities_type_country", "entities", ["entity_type", "country_code"])
    op.create_index("idx_entities_risk_score", "entities", ["risk_score"])
    op.create_index("idx_entities_canonical_trgm", "entities", ["canonical_name"], postgresql_using="gin", postgresql_ops={"canonical_name": "gin_trgm_ops"})
    op.create_index("idx_entities_display_trgm", "entities", ["display_name"], postgresql_using="gin", postgresql_ops={"display_name": "gin_trgm_ops"})

    op.create_table(
        "entity_identifiers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_id", sa.Integer(), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scheme", sa.String(length=80), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False, server_default="CL"),
        sa.Column("source_name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("scheme", "value", "country_code", name="uq_identifier_scheme_value_country"),
    )
    op.create_index("idx_identifiers_entity", "entity_identifiers", ["entity_id"])
    op.create_index("idx_identifiers_value_trgm", "entity_identifiers", ["value"], postgresql_using="gin", postgresql_ops={"value": "gin_trgm_ops"})

    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=120), nullable=False),
        sa.Column("source_type", sa.String(length=80), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("license", sa.String(length=255), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("idx_sources_name_external", "sources", ["source_name", "external_id"])

    op.create_table(
        "relationships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_entity_id", sa.Integer(), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_entity_id", sa.Integer(), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=500), nullable=True),
        sa.Column("weight", sa.Numeric(12, 4), nullable=False, server_default="1"),
        sa.Column("confidence_score", sa.Numeric(5, 4), nullable=False, server_default="1"),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_entity_id", "target_entity_id", "relationship_type", "source_id", name="uq_relationship_source_target_type_source"),
    )
    op.create_index("idx_relationships_source", "relationships", ["source_entity_id"])
    op.create_index("idx_relationships_target", "relationships", ["target_entity_id"])
    op.create_index("idx_relationships_type", "relationships", ["relationship_type"])

    op.create_table(
        "raw_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=120), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="fetched"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.UniqueConstraint("source_name", "payload_hash", name="uq_raw_records_source_hash"),
    )
    op.create_index("idx_raw_records_source_external", "raw_records", ["source_name", "external_id"])
    op.create_index("idx_raw_records_status", "raw_records", ["status"])

    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=120), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="running"),
        sa.Column("records_fetched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("idx_ingestion_runs_source_started", "ingestion_runs", ["source_name", "started_at"])

    op.create_table(
        "risk_flags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_id", sa.Integer(), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=True),
        sa.Column("relationship_id", sa.Integer(), sa.ForeignKey("relationships.id", ondelete="CASCADE"), nullable=True),
        sa.Column("flag_type", sa.String(length=120), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence_source_id", sa.Integer(), sa.ForeignKey("sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_risk_flags_entity", "risk_flags", ["entity_id"])
    op.create_index("idx_risk_flags_relationship", "risk_flags", ["relationship_id"])
    op.create_index("idx_risk_flags_severity", "risk_flags", ["severity"])


def downgrade():
    op.drop_table("risk_flags")
    op.drop_table("ingestion_runs")
    op.drop_table("raw_records")
    op.drop_table("relationships")
    op.drop_table("sources")
    op.drop_table("entity_identifiers")
    op.drop_table("entities")
