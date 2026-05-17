import argparse
import os

from config.database import SessionLocal
from ingestion.registry import get_connector
from ingestion.runners import run_connector


def main():
    parser = argparse.ArgumentParser(description="Seed real ChileCompra data from Mercado Publico API")
    parser.add_argument("--licitacion", action="append", default=[], help="Codigo de licitacion Mercado Publico. Can be repeated.")
    parser.add_argument("--orden-compra", action="append", default=[], help="Codigo de orden de compra Mercado Publico. Can be repeated.")
    args = parser.parse_args()

    tender_codes = args.licitacion or _env_list("CHILECOMPRA_SEED_TENDER_CODES")
    purchase_order_codes = args.orden_compra or _env_list("CHILECOMPRA_SEED_OC_CODES")
    if not tender_codes and not purchase_order_codes:
        raise SystemExit("Debe indicar --licitacion, --orden-compra, CHILECOMPRA_SEED_TENDER_CODES o CHILECOMPRA_SEED_OC_CODES.")
    if not os.getenv("CHILECOMPRA_TICKET"):
        raise SystemExit("CHILECOMPRA_TICKET es obligatorio para seed real. No se inventan datos ni se usan fixtures en este comando.")

    db = SessionLocal()
    try:
        connector = get_connector("chilecompra")
        if tender_codes:
            run = run_connector(db, connector, kind="licitaciones", codigos=tender_codes)
            print(f"licitaciones: {run.status} fetched={run.records_fetched} processed={run.records_processed} failed={run.records_failed}")
        if purchase_order_codes:
            run = run_connector(db, connector, kind="ordenes_compra", codigos=purchase_order_codes)
            print(f"ordenes_compra: {run.status} fetched={run.records_fetched} processed={run.records_processed} failed={run.records_failed}")
    finally:
        db.close()


def _env_list(name: str) -> list[str]:
    return [value.strip() for value in os.getenv(name, "").split(",") if value.strip()]


if __name__ == "__main__":
    main()
