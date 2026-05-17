from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    canonical_name: Mapped[str] = mapped_column(String(500), nullable=False)
    display_name: Mapped[str] = mapped_column(String(500), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), default="CL", nullable=False)
    entity_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    identifiers = relationship("EntityIdentifier", back_populates="entity", cascade="all, delete-orphan")
    outgoing_relationships = relationship(
        "Relationship",
        foreign_keys="Relationship.source_entity_id",
        back_populates="source_entity",
        cascade="all, delete-orphan",
    )
    incoming_relationships = relationship(
        "Relationship",
        foreign_keys="Relationship.target_entity_id",
        back_populates="target_entity",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_entities_type_country", "entity_type", "country_code"),
        Index("idx_entities_risk_score", "risk_score"),
        Index("idx_entities_canonical_trgm", "canonical_name", postgresql_using="gin", postgresql_ops={"canonical_name": "gin_trgm_ops"}),
        Index("idx_entities_display_trgm", "display_name", postgresql_using="gin", postgresql_ops={"display_name": "gin_trgm_ops"}),
    )


class EntityIdentifier(Base):
    __tablename__ = "entity_identifiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    scheme: Mapped[str] = mapped_column(String(80), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), default="CL", nullable=False)
    source_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entity = relationship("Entity", back_populates="identifiers")

    __table_args__ = (
        UniqueConstraint("scheme", "value", "country_code", name="uq_identifier_scheme_value_country"),
        Index("idx_identifiers_entity", "entity_id"),
        Index("idx_identifiers_value_trgm", "value", postgresql_using="gin", postgresql_ops={"value": "gin_trgm_ops"}),
    )


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), nullable=False)
    source_type: Mapped[str] = mapped_column(String(80), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fetched_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    license: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index("idx_sources_name_external", "source_name", "external_id"),
    )
