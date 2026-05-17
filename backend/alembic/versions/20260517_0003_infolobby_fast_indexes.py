"""infolobby fast load support indexes

Revision ID: 20260517_0003
Revises: 20260517_0002
Create Date: 2026-05-17
"""

from alembic import op

revision = "20260517_0003"
down_revision = "20260517_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM entities
                WHERE external_id IS NOT NULL
                GROUP BY external_id
                HAVING count(*) > 1
            ) THEN
                CREATE UNIQUE INDEX IF NOT EXISTS uq_entities_external_id_not_null
                ON entities (external_id)
                WHERE external_id IS NOT NULL;
            END IF;
        END $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_entity_identifiers_source_name ON entity_identifiers (source_name)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_relationships_source_id ON relationships (source_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sources_infolobby_run ON sources ((metadata->>'run_id')) WHERE source_name = 'infolobby'")
    op.execute("CREATE INDEX IF NOT EXISTS idx_entities_infolobby_external ON entities (external_id) WHERE external_id LIKE 'infolobby:%'")


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_entities_infolobby_external")
    op.execute("DROP INDEX IF EXISTS idx_sources_infolobby_run")
    op.execute("DROP INDEX IF EXISTS idx_relationships_source_id")
    op.execute("DROP INDEX IF EXISTS idx_entity_identifiers_source_name")
    op.execute("DROP INDEX IF EXISTS uq_entities_external_id_not_null")
