import argparse

from dotenv import load_dotenv

from config.database import SessionLocal
from ingestion.registry import get_connector
from ingestion.runners import run_connector


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Run a public-source ingestion connector")
    parser.add_argument("source", choices=["chilecompra", "infolobby", "infoprobidad", "registro_colaboradores", "servel"])
    parser.add_argument("--fixture", action="store_true", help="Use explicit development fixture when supported")
    parser.add_argument("--kind", choices=["licitaciones", "ordenes_compra", "oc", "all"], default="licitaciones", help="ChileCompra record type")
    parser.add_argument("--codigo", action="append", help="ChileCompra tender or purchase-order code. Can be repeated.")
    parser.add_argument("--data-dir", help="Directory containing local InfoLobby CSV files")
    parser.add_argument("--file", action="append", dest="files", help="InfoLobby CSV file to ingest. Can be repeated.")
    parser.add_argument("--limit", type=int, help="Maximum records to process")
    parser.add_argument("--batch-size", type=int, default=1000, help="Commit every N processed records")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        connector = get_connector(args.source)
        run = run_connector(
            db,
            connector,
            fixture=args.fixture,
            kind=args.kind,
            codigos=args.codigo,
            data_dir=args.data_dir,
            files=args.files,
            limit=args.limit,
            batch_size=args.batch_size,
        )
        print(
            f"{run.source_name}: {run.status} "
            f"fetched={run.records_fetched} processed={run.records_processed} failed={run.records_failed}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
