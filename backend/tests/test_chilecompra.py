from ingestion.sources.chilecompra import ChileCompraConnector, FIXTURE_PURCHASE_ORDER, FIXTURE_TENDER
from ingestion.base import RawRecordInput


def test_chilecompra_fixture_normalization():
    graph = ChileCompraConnector().normalize(RawRecordInput("2424-12-LP24", None, {"_record_type": "tender", "record": FIXTURE_TENDER}))

    assert {entity.entity_type for entity in graph.entities} >= {"public_body", "tender", "company"}
    assert any(rel.relationship_type == "awarded_to" for rel in graph.relationships)
    assert graph.metadata["source_type"] == "public_api"


def test_chilecompra_purchase_order_normalization():
    graph = ChileCompraConnector().normalize(
        RawRecordInput("2424-77-SE24", None, {"_record_type": "purchase_order", "record": FIXTURE_PURCHASE_ORDER})
    )

    assert {entity.entity_type for entity in graph.entities} >= {"public_body", "purchase_order", "company", "tender"}
    assert any(rel.relationship_type == "purchased_from" for rel in graph.relationships)
    assert any(("CHILECOMPRA_OC_CODE", "2424-77-SE24") in entity.identifiers for entity in graph.entities)


def test_chilecompra_fetch_fixture_all():
    records = ChileCompraConnector().fetch(fixture=True, kind="all")

    assert [record.payload["_record_type"] for record in records] == ["tender", "purchase_order"]
