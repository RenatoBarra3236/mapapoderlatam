import argparse
import os
from datetime import date, datetime, timedelta

from dotenv import load_dotenv

from config.database import SessionLocal
from ingestion.chilecompra_pipeline import DEFAULT_DAILY_BUDGET, discover_chilecompra, hydrate_chilecompra_queue
from utils.progress import bar, num, pct

_DEMO_DAYS_DEFAULT = 7


def _seed_real(args) -> None:
    end = date.today()
    start = (
        datetime.strptime(args.date_from, "%Y-%m-%d").date()
        if args.date_from
        else end - timedelta(days=args.days - 1)
    )
    if args.date_to:
        end = datetime.strptime(args.date_to, "%Y-%m-%d").date()

    dates: list[date] = []
    cur = start
    while cur <= end:
        dates.append(cur)
        cur += timedelta(days=1)

    total = len(dates)
    sep = "=" * 60
    print(f"\n ChileCompra Seed  {start} -> {end}  ({total} dates  |  {args.kind})")
    print(f" {sep}")

    totals = {"discovered": 0, "queued": 0, "processed": 0, "failed": 0}
    db = SessionLocal()
    try:
        for idx, target_date in enumerate(dates):
            disc = discover_chilecompra(
                db, target_date, kind=args.kind, daily_budget=DEFAULT_DAILY_BUDGET
            )
            totals["discovered"] += disc.discovered
            totals["queued"] += disc.queued
            b = bar(idx + 1, total)
            p = pct(idx + 1, total)
            print(f"  {b}  {p}  {target_date}  discovered={num(disc.discovered)}  queued={num(disc.queued)}")

        print(f"\n  Hydrating {num(totals['queued'])} queued items...")
        hyd = hydrate_chilecompra_queue(db, budget=totals["queued"] + 100, daily_budget=DEFAULT_DAILY_BUDGET, sleep_seconds=0.2)
        totals["processed"] += hyd.processed
        totals["failed"] += hyd.failed
    finally:
        db.close()

    print(f" {sep}")
    print(f"  discovered: {num(totals['discovered'])}  queued: {num(totals['queued'])}")
    print(f"  processed:  {num(totals['processed'])}  failed: {num(totals['failed'])}\n")


def _seed_demo() -> None:
    from ingestion.base import NormalizedEntity, NormalizedGraph, NormalizedRelationship
    from ingestion.runners import persist_graph
    from models import Entity, EntityIdentifier, RawRecord, Relationship, RiskFlag, Source

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
            source_external_id="seed-demo",
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
        print("[DEMO] Seed de fixtures cargado. Datos no reales.")
    finally:
        db.close()


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Seed development database with ChileCompra real data or demo fixture")
    parser.add_argument("--demo", action="store_true", help="Load static demo fixture (no API key required)")
    parser.add_argument("--days", type=int, default=_DEMO_DAYS_DEFAULT, help="Days back to fetch real data (default: 7)")
    parser.add_argument("--from", dest="date_from", metavar="YYYY-MM-DD", help="Start date for real data range")
    parser.add_argument("--to", dest="date_to", metavar="YYYY-MM-DD", help="End date for real data range")
    parser.add_argument("--kind", choices=["licitaciones", "ordenes_compra", "all"], default="all")
    args = parser.parse_args()

    if args.demo:
        _seed_demo()
        return

    if not os.getenv("CHILECOMPRA_TICKET"):
        raise SystemExit(
            "CHILECOMPRA_TICKET no configurado.\n"
            "  - Para datos reales: export CHILECOMPRA_TICKET=<tu_ticket>\n"
            "  - Para fixture de demo: python -m scripts.seed_dev --demo"
        )

    _seed_real(args)


if __name__ == "__main__":
    main()
