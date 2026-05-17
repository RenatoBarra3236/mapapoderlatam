import argparse
import os
import sys

from dotenv import load_dotenv

from config.database import SessionLocal
from ingestion.chilecompra_pipeline import DEFAULT_DAILY_BUDGET, hydrate_chilecompra_queue, is_night_window
from models import IngestionQueueItem
from utils.progress import bar, num, pct


def _queue_total(db) -> int:
    return (
        db.query(IngestionQueueItem)
        .filter(
            IngestionQueueItem.source_name == "chilecompra",
            IngestionQueueItem.status.in_(["queued", "processing"]),
        )
        .count()
    )


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Hydrate queued ChileCompra codes into full raw records and normalized graph")
    parser.add_argument("--budget", type=int, default=500, help="Max detail requests for this run")
    parser.add_argument("--daily-budget", type=int, default=DEFAULT_DAILY_BUDGET)
    parser.add_argument("--sleep-seconds", type=float, default=0.2)
    parser.add_argument("--ignore-night-window", action="store_true")
    args = parser.parse_args()

    if not args.ignore_night_window and not is_night_window():
        raise SystemExit("Fuera de ventana nocturna 22:00-07:00. Use --ignore-night-window solo para pruebas puntuales.")
    if not os.getenv("CHILECOMPRA_TICKET"):
        raise SystemExit("CHILECOMPRA_TICKET es obligatorio.")

    db = SessionLocal()
    try:
        initial_depth = _queue_total(db)
    finally:
        db.close()

    budget = min(args.budget, initial_depth)
    sep = "=" * 60
    print(f"\n ChileCompra Hydration  (budget={num(budget)}  queue={num(initial_depth)})")
    print(f" {sep}")

    if initial_depth == 0:
        print("  Queue empty. Nothing to hydrate.")
        print(f" {sep}\n")
        return

    db = SessionLocal()
    try:
        stats = hydrate_chilecompra_queue(
            db,
            budget=args.budget,
            daily_budget=args.daily_budget,
            sleep_seconds=args.sleep_seconds,
        )
    finally:
        db.close()

    db = SessionLocal()
    try:
        remaining = _queue_total(db)
    finally:
        db.close()

    done = stats.processed + stats.failed + stats.skipped
    print(f"  {bar(done, budget)}  {pct(done, budget)}")
    print(f"  processed: {num(stats.processed)}  failed: {num(stats.failed)}  skipped: {num(stats.skipped)}")
    print(f"  requests:  {num(stats.requests_used)}  queue remaining: {num(remaining)}")
    print(f" {sep}\n")


if __name__ == "__main__":
    main()
