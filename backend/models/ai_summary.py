from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


class AISummaryCache(Base):
    __tablename__ = "ai_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False
    )
    lang: Mapped[str] = mapped_column(String(8), nullable=False, default="es")
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    __table_args__ = (
        UniqueConstraint("entity_id", "lang", name="uq_ai_summaries_entity_lang"),
        Index("idx_ai_summaries_entity_lang", "entity_id", "lang"),
    )
