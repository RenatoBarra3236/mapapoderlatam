from ingestion.sources.chilecompra import ChileCompraConnector, FIXTURE_TENDER
from ingestion.base import RawRecordInput


def test_chilecompra_fixture_normalization():
    graph = ChileCompraConnector().normalize(RawRecordInput("2424-12-LP24", None, FIXTURE_TENDER))

    assert {entity.entity_type for entity in graph.entities} >= {"public_body", "tender", "company"}
    assert any(rel.relationship_type == "awarded_to" for rel in graph.relationships)
    assert graph.metadata["source_type"] == "public_api"
