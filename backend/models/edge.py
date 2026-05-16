from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Date, ForeignKey, Index, func
from sqlalchemy.orm import relationship
from datetime import datetime
from config.database import Base

class Edge(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    label = Column(String(255), nullable=True)
    weight = Column(Float, default=1.0)
    source_url = Column(String(500), nullable=True)
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    source = relationship("Node", foreign_keys=[source_id], back_populates="edges_out")
    target = relationship("Node", foreign_keys=[target_id], back_populates="edges_in")

    __table_args__ = (
        Index("idx_edges_source", "source_id"),
        Index("idx_edges_target", "target_id"),
        Index("idx_edges_type", "type"),
    )
