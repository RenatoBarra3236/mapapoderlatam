from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, date

class EdgeBase(BaseModel):
    source_id: int
    target_id: int
    type: str
    label: Optional[str] = None
    weight: float = 1.0
    source_url: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    metadata: Dict[str, Any] = {}

class EdgeCreate(EdgeBase):
    pass

class EdgeResponse(EdgeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
