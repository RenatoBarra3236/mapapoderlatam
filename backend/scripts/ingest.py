import argparse

from config.database import SessionLocal
from ingestion.registry import get_connector
from ingestion.runners import run_connector


def main():
    parser = argparse.ArgumentParser(description="Run a public-source ingestion connector")
    parser.add_argument("source", choices=["chilecompra", "infolobby", "infoprobidad", "registro_colaboradores", "servel"])
    parser.add_argument("--fixture", action="store_true", help="Use explicit development fixture when supported")
    parser.add_argument("--codigo", help="ChileCompra tender code")
    parser.add_argument("--fecha", help="ChileCompra date parameter")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        connector = get_connector(args.source)
        run = run_connector(db, connector, fixture=args.fixture, codigo=args.codigo, fecha=args.fecha)
        print(
            f"{run.source_name}: {run.status} "
            f"fetched={run.records_fetched} processed={run.records_processed} failed={run.records_failed}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
