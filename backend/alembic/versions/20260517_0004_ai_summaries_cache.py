"""ai summaries cache table

Revision ID: 20260517_0004
Revises: 20260517_0003
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa

revision = "20260517_0004"
down_revision = "20260517_0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_summaries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_id", sa.Integer(), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lang", sa.String(8), nullable=False, server_default="es"),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
    )
    op.create_unique_constraint("uq_ai_summaries_entity_lang", "ai_summaries", ["entity_id", "lang"])
    op.create_index("idx_ai_summaries_entity_lang", "ai_summaries", ["entity_id", "lang"])


def downgrade():
    op.drop_index("idx_ai_summaries_entity_lang")
    op.drop_table("ai_summaries")
