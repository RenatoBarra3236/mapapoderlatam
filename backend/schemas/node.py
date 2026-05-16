from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class NodeBase(BaseModel):
    external_id: Optional[str] = None
    type: str
    name: str
    country: str = "CL"
    metadata: Dict[str, Any] = {}
    risk_score: int = 0

class NodeCreate(NodeBase):
    pass

class NodeUpdate(BaseModel):
    name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    risk_score: Optional[int] = None

class NodeResponse(NodeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class NodeDetail(NodeResponse):
    pass
