import argparse
import hashlib
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta

from dotenv import load_dotenv

from config.database import SessionLocal, engine as _db_engine

# engine.echo is an internal SQLAlchemy flag — setLevel() alone doesn't silence it
_db_engine.echo = False
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
from ingestion.chilecompra_pipeline import (
    DEFAULT_DAILY_BUDGET,
    TIMEZONE,
    discover_chilecompra,
    hydrate_chilecompra_queue,
    is_date_discovered,
    is_night_window,
    mark_date_discovered,
    seconds_until_night_window,
)
from ingestion.sources.chilecompra import ChileCompraTransientError
from models import ApiUsageCounter, IngestionQueueItem
from utils.progress import (
    C,
    Dashboard,
    bar,
    budget_bar,
    label,
    num,
    pct,
    stat_row,
    val,
)

BACKFILL_DEFAULT_FROM = date(2020, 1, 1)


def _queue_depth(db) -> int:
    return (
        db.query(IngestionQueueItem)
        .filter(IngestionQueueItem.source_name == "chilecompra", IngestionQueueItem.status == "queued")
        .count()
    )


def _budget_used(db, daily_budget: int) -> int:
    ticket = os.environ.get("CHILECOMPRA_TICKET", "")
    ticket_hash = hashlib.sha256(ticket.encode()).hexdigest()
    today = datetime.now(TIMEZONE).date()
    counter = (
        db.query(ApiUsageCounter)
        .filter(
            ApiUsageCounter.source_name == "chilecompra",
            ApiUsageCounter.ticket_hash == ticket_hash,
            ApiUsageCounter.usage_date == today,
        )
        .first()
    )
    return counter.request_count if counter else 0


def _backfill_lines(
    idx: int,
    total: int,
    target_date: date,
    kind: str,
    totals: dict,
    depth: int,
    used: int,
    daily_budget: int,
    last_event: str = "",
) -> list[str]:
    left = max(0, daily_budget - used)
    lines = [
        "",
        f"  {label('Procesando')}    {C.byellow}{target_date}{C.reset}  "
        f"{C.gray}({kind}){C.reset}",
        "",
        f"  {label('Fechas')}        {bar(idx, total, 30)}  {pct(idx, total)}",
        f"  {C.gray}               {num(idx)} / {num(total)} fechas{C.reset}",
        "",
        stat_row("Descubiertos", totals["discovered"], "En cola",  totals["queued"]),
        stat_row("Procesados",   totals["processed"],  "Fallidos", totals["failed"]),
        stat_row("Omitidas",      totals.get("skipped", 0), "Errores", totals.get("errors", 0)),
        "",
        f"  {label('Budget')}        {budget_bar(used, daily_budget, 30)}  {pct(used, daily_budget)}",
        f"  {C.gray}               {num(used)} / {num(daily_budget)} llamadas  ·  {num(left)} restantes{C.reset}",
        f"  {label('Cola')}          {val(num(depth))}  {C.gray}items pendientes{C.reset}",
        "",
    ]
    if last_event:
        lines.extend([f"  {label('Ultimo')}        {C.gray}{last_event[:48]}{C.reset}", ""])
    return lines


def _daemon_lines(
    cycle: int,
    now_str: str,
    target_date: date,
    kind: str,
    totals: dict,
    depth: int,
    used: int,
    daily_budget: int,
) -> list[str]:
    left = max(0, daily_budget - used)
    lines = [
        "",
        f"  {label('Ciclo')}         {val(cycle)}  "
        f"{C.gray}({now_str}){C.reset}",
        f"  {label('Procesando')}    {C.byellow}{target_date}{C.reset}  "
        f"{C.gray}({kind}){C.reset}",
        "",
        stat_row("Descubiertos", totals["discovered"], "En cola",  totals["queued"]),
        stat_row("Procesados",   totals["processed"],  "Fallidos", totals["failed"]),
        "",
        f"  {label('Budget')}        {budget_bar(used, daily_budget, 30)}  {pct(used, daily_budget)}",
        f"  {C.gray}               {num(used)} / {num(daily_budget)} llamadas  ·  {num(left)} restantes{C.reset}",
        f"  {label('Cola')}          {val(num(depth))}  {C.gray}items pendientes{C.reset}",
        "",
    ]
    return lines


def _daemon_wait_lines(
    totals: dict,
    depth: int,
    used: int,
    daily_budget: int,
    night_start: str,
    night_end: str,
    wait_str: str,
    now_str: str,
) -> list[str]:
    lines = [
        "",
        f"  {label('Estado')}        fuera de ventana nocturna",
        f"  {label('Ventana')}       {C.byellow}{night_start}{C.reset}"
        f"  {C.gray}hasta{C.reset}  {C.byellow}{night_end}{C.reset}",
        f"  {label('Proxima')}       en ~{C.white}{wait_str}{C.reset}  "
        f"{C.gray}({now_str}){C.reset}",
        "",
        stat_row("Descubiertos", totals["discovered"], "En cola",  totals["queued"]),
        stat_row("Procesados",   totals["processed"],  "Fallidos", totals["failed"]),
        "",
        f"  {label('Budget')}        {budget_bar(used, daily_budget, 24)}  {pct(used, daily_budget)}",
        f"  {C.gray}               {num(used)} / {num(daily_budget)} llamadas{C.reset}",
        f"  {label('Cola')}          {val(num(depth))}  {C.gray}items pendientes{C.reset}",
        "",
    ]
    return lines


def run_backfill(args) -> None:
    start = datetime.strptime(args.backfill_from, "%Y-%m-%d").date() if args.backfill_from else BACKFILL_DEFAULT_FROM
    end = datetime.strptime(args.backfill_to, "%Y-%m-%d").date() if args.backfill_to else date.today()

    dates: list[date] = []
    cur = start
    while cur <= end:
        dates.append(cur)
        cur += timedelta(days=1)

    total = len(dates)
    dash = Dashboard("CHILECOMPRA BACKFILL", f"{start} → {end}")
    totals = {"discovered": 0, "queued": 0, "processed": 0, "failed": 0, "skipped": 0}
    totals["errors"] = 0
    consecutive_errors = 0
    last_event = f"retries={os.getenv('CHILECOMPRA_RETRIES', '3')} backoff={os.getenv('CHILECOMPRA_BACKOFF_SECONDS', '1.5')}s"
    state_lock = threading.RLock()
    state = {
        "idx": 0,
        "target_date": dates[0] if dates else start,
        "depth": 0,
        "used": 0,
        "last_event": last_event,
        "status": "activo",
    }

    def set_state(**updates) -> None:
        with state_lock:
            state.update(updates)

    def lines_snapshot() -> list[str]:
        with state_lock:
            return _backfill_lines(
                state["idx"],
                total,
                state["target_date"],
                args.kind,
                totals.copy(),
                state["depth"],
                state["used"],
                args.daily_budget,
                state["last_event"],
            )

    def status_snapshot() -> str:
        with state_lock:
            return str(state["status"])

    dash.start_auto(lines_snapshot, status_snapshot, interval=args.tui_interval)

    for idx, target_date in enumerate(dates):
        db = SessionLocal()
        try:
            depth = _queue_depth(db)
            used = _budget_used(db, args.daily_budget)
            already_done = is_date_discovered(db, target_date, args.kind)
        finally:
            db.close()
        set_state(idx=idx, target_date=target_date, depth=depth, used=used, last_event=last_event, status="activo")

        if already_done:
            totals["skipped"] += 1
            last_event = f"{target_date} omitida: discovery ya registrado"
            set_state(idx=idx + 1, last_event=last_event)
            continue

        left = max(0, args.daily_budget - used)

        if left <= 0:
            dash.stop_auto([
                "",
                f"  {C.bred}Budget agotado por hoy.{C.reset}",
                "",
                f"  {label('Procesadas')}    {val(num(idx))} / {val(num(total))} fechas",
                "",
                f"  {C.gray}Reanudar manana:{C.reset}",
                f"  {C.byellow}--backfill-from={target_date}{C.reset}",
                "",
            ], status="pausado")
            return

        db = SessionLocal()
        try:
            disc = discover_chilecompra(
                db, target_date, kind=args.kind, estado=args.estado, daily_budget=args.daily_budget
            )
            totals["discovered"] += disc.discovered
            totals["queued"] += disc.queued
            mark_date_discovered(db, target_date, args.kind, disc)
            db.commit()
            consecutive_errors = 0
            last_event = f"{target_date}: {num(disc.discovered)} descubiertos, {num(disc.queued)} en cola"
            set_state(idx=idx + 1, last_event=last_event)
        except ChileCompraTransientError as exc:
            db.rollback()
            totals["errors"] += 1
            consecutive_errors += 1
            last_event = f"{target_date}: fallo transitorio ({consecutive_errors}/{args.max_consecutive_errors})"
            set_state(idx=idx + 1, last_event=last_event)
            dash.log(f"discover {target_date}: {exc}")
        except Exception as exc:
            db.rollback()
            totals["errors"] += 1
            consecutive_errors += 1
            last_event = f"{target_date}: error ({consecutive_errors}/{args.max_consecutive_errors})"
            set_state(idx=idx + 1, last_event=last_event)
            dash.log(f"discover {target_date}: {exc}")
        finally:
            db.close()

        if consecutive_errors >= args.max_consecutive_errors:
            db = SessionLocal()
            try:
                depth = _queue_depth(db)
                used = _budget_used(db, args.daily_budget)
            finally:
                db.close()
            dash.stop_auto([
                "",
                f"  {C.bred}Backfill pausado por errores consecutivos.{C.reset}",
                "",
                f"  {label('Fecha')}         {val(str(target_date))}",
                f"  {label('Errores')}       {val(num(consecutive_errors))} consecutivos",
                f"  {label('Causa')}         {C.gray}fallos transitorios de red/API tras reintentos{C.reset}",
                "",
                f"  {label('Budget')}        {budget_bar(used, args.daily_budget, 30)}  {pct(used, args.daily_budget)}",
                f"  {C.gray}               {num(used)} / {num(args.daily_budget)} llamadas hoy{C.reset}",
                f"  {label('Cola')}          {val(num(depth))}  {C.gray}items pendientes{C.reset}",
                "",
                f"  {C.gray}Reanudar cuando la API estabilice:{C.reset}",
                f"  {C.byellow}--backfill-from={target_date}{C.reset}",
                "",
            ], status="pausado")
            return

        if args.hydrate:
            db = SessionLocal()
            try:
                hyd = hydrate_chilecompra_queue(
                    db,
                    budget=args.hydration_budget,
                    daily_budget=args.daily_budget,
                    sleep_seconds=args.sleep_seconds,
                )
                totals["processed"] += hyd.processed
                totals["failed"] += hyd.failed
                if hyd.processed or hyd.failed:
                    last_event = f"{target_date}: hydration procesados={num(hyd.processed)} fallidos={num(hyd.failed)}"
                    set_state(last_event=last_event)
            except Exception as exc:
                db.rollback()
                totals["errors"] += 1
                last_event = f"{target_date}: hydration error"
                set_state(last_event=last_event)
                dash.log(f"hydrate {target_date}: {exc}")
            finally:
                db.close()

        if args.sleep_between > 0:
            time.sleep(args.sleep_between)

    db = SessionLocal()
    try:
        depth = _queue_depth(db)
        used = _budget_used(db, args.daily_budget)
    finally:
        db.close()

    dash.stop_auto([
        "",
        f"  {C.bgreen}Backfill completado.{C.reset}",
        "",
        f"  {label('Fechas')}        {bar(total, total, 30)}  {pct(total, total)}",
        f"  {C.gray}               {num(total)} / {num(total)} fechas  "
        f"({num(totals['skipped'])} omitidas por cache){C.reset}",
        "",
        stat_row("Descubiertos", totals["discovered"], "En cola",  totals["queued"]),
        stat_row("Procesados",   totals["processed"],  "Fallidos", totals["failed"]),
        stat_row("Omitidas",      totals.get("skipped", 0), "Errores", totals.get("errors", 0)),
        "",
        f"  {label('Budget')}        {budget_bar(used, args.daily_budget, 30)}  {pct(used, args.daily_budget)}",
        f"  {C.gray}               {num(used)} / {num(args.daily_budget)} llamadas hoy{C.reset}",
        f"  {label('Cola')}          {val(num(depth))}  {C.gray}items pendientes{C.reset}",
        "",
    ], status="listo")


def run_daemon(args) -> None:
    dash = Dashboard("CHILECOMPRA WORKER")
    cycle = 0
    totals = {"discovered": 0, "queued": 0, "processed": 0, "failed": 0}
    consecutive_errors = 0
    state_lock = threading.RLock()
    state = {
        "mode": "active",
        "cycle": 0,
        "now_str": "--:--:--",
        "target_date": date.today(),
        "depth": 0,
        "used": 0,
        "wait_str": "0m 00s",
        "status": "activo",
    }

    def set_state(**updates) -> None:
        with state_lock:
            state.update(updates)

    def lines_snapshot() -> list[str]:
        with state_lock:
            if state["mode"] == "waiting":
                return _daemon_wait_lines(
                    totals.copy(),
                    state["depth"],
                    state["used"],
                    args.daily_budget,
                    args.night_start,
                    args.night_end,
                    state["wait_str"],
                    state["now_str"],
                )
            return _daemon_lines(
                state["cycle"],
                state["now_str"],
                state["target_date"],
                args.kind,
                totals.copy(),
                state["depth"],
                state["used"],
                args.daily_budget,
            )

    def status_snapshot() -> str:
        with state_lock:
            return str(state["status"])

    dash.start_auto(lines_snapshot, status_snapshot, interval=args.tui_interval)

    while True:
        now = datetime.now(TIMEZONE)
        db = SessionLocal()
        try:
            depth = _queue_depth(db)
            used = _budget_used(db, args.daily_budget)
        finally:
            db.close()

        if not is_night_window(now, args.night_start, args.night_end):
            wait = min(300, seconds_until_night_window(now, args.night_start))
            h, m, s = wait // 3600, (wait % 3600) // 60, wait % 60
            wait_str = f"{h}h {m:02d}m" if h else f"{m}m {s:02d}s"
            set_state(mode="waiting", now_str=now.strftime("%H:%M:%S"), depth=depth, used=used, wait_str=wait_str, status="esperando")
            if args.once:
                dash.stop_auto(lines_snapshot(), status="esperando")
                return
            time.sleep(min(wait, 60))
            continue

        target_date = (now - timedelta(days=args.discover_days_back)).date()
        cycle += 1
        set_state(
            mode="active",
            cycle=cycle,
            now_str=now.strftime("%H:%M:%S"),
            target_date=target_date,
            depth=depth,
            used=used,
            status="activo",
        )

        db = SessionLocal()
        pause_after_error = False
        try:
            try:
                disc = discover_chilecompra(
                    db, target_date, kind=args.kind, estado=args.estado, daily_budget=args.daily_budget
                )
                totals["discovered"] += disc.discovered
                totals["queued"] += disc.queued

                hyd = hydrate_chilecompra_queue(
                    db, budget=args.hydration_budget, daily_budget=args.daily_budget, sleep_seconds=0.2
                )
                totals["processed"] += hyd.processed
                totals["failed"] += hyd.failed
                consecutive_errors = 0
            except Exception as exc:
                db.rollback()
                consecutive_errors += 1
                dash.log(f"ciclo {cycle}: {exc}")
                if consecutive_errors >= args.max_consecutive_errors:
                    dash.log(f"pausa corta: {consecutive_errors} errores consecutivos")
                    pause_after_error = True
        finally:
            db.close()

        if args.once:
            dash.stop_auto(lines_snapshot(), status=status_snapshot())
            return
        if pause_after_error:
            time.sleep(min(900, args.sleep_seconds * 10))
        time.sleep(args.sleep_seconds)


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="ChileCompra ingestion worker")
    parser.add_argument("--daily-budget", type=int, default=DEFAULT_DAILY_BUDGET)
    parser.add_argument("--hydration-budget", type=int, default=500)
    parser.add_argument("--discover-days-back", type=int, default=1)
    parser.add_argument("--kind", choices=["licitaciones", "ordenes_compra", "all"], default="all")
    parser.add_argument("--estado", help="ChileCompra estado parameter for discovery")
    parser.add_argument("--night-start", default="22:00")
    parser.add_argument("--night-end", default="07:00")
    parser.add_argument("--sleep-seconds", type=float, default=0.2, help="Delay between hydration requests")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    parser.add_argument("--backfill", action="store_true", help="Backfill 2020-01-01 to today")
    parser.add_argument("--backfill-from", default=None, metavar="YYYY-MM-DD")
    parser.add_argument("--backfill-to", default=None, metavar="YYYY-MM-DD")
    parser.add_argument("--no-hydrate", dest="hydrate", action="store_false", default=True)
    parser.add_argument("--sleep-between", type=float, default=0.1, help="Seconds between dates during backfill")
    parser.add_argument("--max-consecutive-errors", type=int, default=5, help="Pause backfill after this many consecutive failures")
    parser.add_argument("--tui-interval", type=float, default=0.25, help="Seconds between background TUI redraws")
    args = parser.parse_args()
    args.max_consecutive_errors = max(1, args.max_consecutive_errors)
    args.tui_interval = max(0.05, args.tui_interval)

    if not os.getenv("CHILECOMPRA_TICKET"):
        raise SystemExit("CHILECOMPRA_TICKET es obligatorio para el worker ChileCompra.")

    try:
        if args.backfill or args.backfill_from or args.backfill_to:
            run_backfill(args)
        else:
            run_daemon(args)
    except KeyboardInterrupt:
        raise SystemExit("\nInterrumpido por usuario. Reanuda con --backfill-from=<ultima-fecha-visible> si estabas en backfill.")


if __name__ == "__main__":
    main()
