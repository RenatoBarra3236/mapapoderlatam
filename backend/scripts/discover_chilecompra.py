import argparse
import os
from datetime import date, datetime, timedelta

from dotenv import load_dotenv

from config.database import SessionLocal
from ingestion.chilecompra_pipeline import DEFAULT_DAILY_BUDGET, discover_chilecompra, is_night_window
from utils.progress import bar, num, pct


def _print_progress(idx: int, total: int, target_date: date, stats_line: str) -> None:
    b = bar(idx, total)
    p = pct(idx, total)
    print(f"  {b}  {p}  {target_date}  {stats_line}")


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Discover ChileCompra record codes by date/status and enqueue them")
    parser.add_argument("--date", help="Single date YYYY-MM-DD")
    parser.add_argument("--from", dest="date_from", help="Start date YYYY-MM-DD")
    parser.add_argument("--to", dest="date_to", help="End date YYYY-MM-DD")
    parser.add_argument("--kind", choices=["licitaciones", "ordenes_compra", "all"], default="all")
    parser.add_argument("--estado", help="ChileCompra API estado parameter")
    parser.add_argument("--daily-budget", type=int, default=DEFAULT_DAILY_BUDGET)
    parser.add_argument("--ignore-night-window", action="store_true")
    args = parser.parse_args()

    if not args.ignore_night_window and not is_night_window():
        raise SystemExit("Fuera de ventana nocturna 22:00-07:00. Use --ignore-night-window solo para pruebas puntuales.")
    if not os.getenv("CHILECOMPRA_TICKET"):
        raise SystemExit("CHILECOMPRA_TICKET es obligatorio.")

    dates = _dates(args)
    total = len(dates)
    totals = {"discovered": 0, "queued": 0, "requests": 0}

    sep = "=" * 60
    print(f"\n ChileCompra Discovery  ({total} dates  |  {args.kind})")
    print(f" {sep}")

    db = SessionLocal()
    try:
        for idx, target_date in enumerate(dates):
            stats = discover_chilecompra(
                db, target_date, kind=args.kind, estado=args.estado, daily_budget=args.daily_budget
            )
            totals["discovered"] += stats.discovered
            totals["queued"] += stats.queued
            totals["requests"] += stats.requests_used
            _print_progress(
                idx + 1,
                total,
                target_date,
                f"discovered={num(stats.discovered)}  queued={num(stats.queued)}  requests={stats.requests_used}",
            )
            if stats.requests_used == 0 and idx > 0:
                print(f"\n  Budget exhausted. Resume with --from={target_date}")
                break
    finally:
        db.close()

    print(f" {sep}")
    print(f"  Total  discovered: {num(totals['discovered'])}  queued: {num(totals['queued'])}  requests: {num(totals['requests'])}\n")


def _dates(args) -> list[date]:
    if args.date:
        return [datetime.strptime(args.date, "%Y-%m-%d").date()]
    if not args.date_from or not args.date_to:
        raise SystemExit("Debe indicar --date o rango --from/--to.")
    start = datetime.strptime(args.date_from, "%Y-%m-%d").date()
    end = datetime.strptime(args.date_to, "%Y-%m-%d").date()
    if end < start:
        raise SystemExit("--to no puede ser anterior a --from.")
    days = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days


if __name__ == "__main__":
    main()
