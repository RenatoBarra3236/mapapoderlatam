from dataclasses import dataclass, field
from typing import Any


@dataclass
class RawRecordInput:
    external_id: str | None
    source_url: str | None
    payload: dict[str, Any]


@dataclass
class NormalizedEntity:
    key: str
    name: str
    entity_type: str
    country_code: str = "CL"
    external_id: str | None = None
    identifiers: list[tuple[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    risk_score: int = 0


@dataclass
class NormalizedRelationship:
    source_key: str
    target_key: str
    relationship_type: str
    label: str | None = None
    weight: float = 1
    confidence_score: float = 1
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedGraph:
    entities: list[NormalizedEntity] = field(default_factory=list)
    relationships: list[NormalizedRelationship] = field(default_factory=list)
    source_name: str = ""
    source_url: str | None = None
    source_external_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseConnector:
    source_name: str

    def fetch(self, **kwargs) -> list[RawRecordInput]:
        raise NotImplementedError

    def normalize(self, raw_record: RawRecordInput) -> NormalizedGraph:
        raise NotImplementedError
