from sqlalchemy import Column, Integer, String, DateTime, JSON, func, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from config.database import Base

class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True)
    external_id = Column(String(255), unique=True, nullable=True)
    type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    country = Column(String(10), default="CL")
    metadata = Column(JSON, default={})
    risk_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    edges_out = relationship("Edge", foreign_keys="Edge.source_id", back_populates="source")
    edges_in = relationship("Edge", foreign_keys="Edge.target_id", back_populates="target")

    __table_args__ = (
        Index("idx_nodes_name", "name"),
        Index("idx_nodes_type", "type"),
        Index("idx_nodes_country", "country"),
    )
