from config.database import SessionLocal
from ingestion.base import NormalizedEntity, NormalizedGraph, NormalizedRelationship
from ingestion.runners import persist_graph
from models import Entity, EntityIdentifier, RawRecord, Relationship, RiskFlag, Source


def seed():
    db = SessionLocal()
    try:
        db.query(RiskFlag).delete()
        db.query(Relationship).delete()
        db.query(EntityIdentifier).delete()
        db.query(Entity).delete()
        db.query(Source).delete()
        db.query(RawRecord).delete()
        db.commit()

        graph = NormalizedGraph(
            source_name="development_seed",
            source_external_id="seed-2026-05-17",
            metadata={"source_type": "fixture", "license": "Demo fixture", "is_demo": True, "source_mode": "fixture"},
            entities=[
                NormalizedEntity("mop", "Ministerio de Obras Publicas", "public_body", identifiers=[("CL_RUT", "61202000-0")], metadata={"is_demo": True, "source_mode": "fixture"}),
                NormalizedEntity("muni", "Municipalidad de Providencia", "public_body", identifiers=[("CL_RUT", "69070300-9")], metadata={"is_demo": True, "source_mode": "fixture"}),
                NormalizedEntity("constructora", "Constructora Los Andes SpA", "company", external_id="76111000-K", identifiers=[("CL_RUT", "76111000-K")], metadata={"sector": "Construccion", "is_demo": True, "source_mode": "fixture"}, risk_score=72),
                NormalizedEntity("servicios", "Servicios Digitales Fuentes SA", "company", external_id="76222000-1", identifiers=[("CL_RUT", "76222000-1")], metadata={"sector": "Tecnologia", "is_demo": True, "source_mode": "fixture"}, risk_score=64),
                NormalizedEntity("carlos", "Carlos Fuentes Munoz", "person", external_id="11111111-1", identifiers=[("CL_RUT", "11111111-1")], metadata={"subtitle": "Ex subsecretario", "is_demo": True, "source_mode": "fixture"}, risk_score=85),
                NormalizedEntity("tender", "Licitacion mejoramiento municipal 2424-12-LP24", "tender", external_id="2424-12-LP24", identifiers=[("CHILECOMPRA_TENDER_CODE", "2424-12-LP24")], metadata={"amount": 184500000, "currency": "CLP", "is_demo": True, "source_mode": "fixture"}, risk_score=55),
                NormalizedEntity("po", "Orden de compra 2424-77-SE24", "purchase_order", external_id="2424-77-SE24", identifiers=[("CHILECOMPRA_OC_CODE", "2424-77-SE24")], metadata={"amount": 184500000, "currency": "CLP", "is_demo": True, "source_mode": "fixture"}, risk_score=50),
            ],
            relationships=[
                NormalizedRelationship("muni", "tender", "issued_by", "Publico licitacion", metadata={"is_demo": True, "source_mode": "fixture"}),
                NormalizedRelationship("tender", "constructora", "awarded_to", "Adjudicada a proveedor", metadata={"amount": 184500000, "currency": "CLP", "is_demo": True, "source_mode": "fixture"}),
                NormalizedRelationship("po", "muni", "issued_by", "Emitida por organismo comprador", metadata={"is_demo": True, "source_mode": "fixture"}),
                NormalizedRelationship("po", "constructora", "awarded_to", "Orden de compra a proveedor", metadata={"is_demo": True, "source_mode": "fixture"}),
                NormalizedRelationship("carlos", "mop", "former_role", "Ex autoridad sectorial", metadata={"is_demo": True, "source_mode": "fixture"}),
                NormalizedRelationship("carlos", "constructora", "owns", "Director y participacion declarada", weight=0.18, metadata={"is_demo": True, "source_mode": "fixture"}),
                NormalizedRelationship("servicios", "muni", "related_to", "Proveedor historico municipal", metadata={"is_demo": True, "source_mode": "fixture"}),
            ],
        )
        persist_graph(db, graph)
        db.flush()

        carlos = db.query(Entity).filter(Entity.display_name == "Carlos Fuentes Munoz").one()
        ownership = (
            db.query(Relationship)
            .filter(Relationship.relationship_type == "owns", Relationship.source_entity_id == carlos.id)
            .one()
        )
        source = db.query(Source).filter(Source.source_name == "development_seed").first()
        db.add(
            RiskFlag(
                entity_id=carlos.id,
                relationship_id=ownership.id,
                flag_type="revolving_door",
                severity="high",
                title="Puerta giratoria demo",
                description="Fixture de desarrollo: ex autoridad conectada a proveedor adjudicatario. No corresponde a dato real.",
                evidence_source_id=source.id if source else None,
                flag_metadata={"is_demo": True, "source_mode": "fixture"},
            )
        )
        db.commit()
        print("Seed de desarrollo cargado")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
