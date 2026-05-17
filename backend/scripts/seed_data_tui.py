import argparse
import contextlib
import curses
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from dotenv import load_dotenv
from sqlalchemy import func

from config.database import SessionLocal, engine as _db_engine
from ingestion.chilecompra_pipeline import (
    DEFAULT_DAILY_BUDGET,
    TIMEZONE,
    discover_chilecompra,
    hydrate_chilecompra_queue,
    is_night_window,
    seconds_until_night_window,
)
from ingestion.registry import get_connector
from ingestion.runners import run_connector
from models import Entity, IngestionQueueItem, IngestionRun, RawRecord, Relationship, Source

SOURCES = ("chilecompra", "infolobby")
_BACKGROUND_OUTPUT_LOCK = threading.RLock()


@dataclass
class SourceStats:
    source_name: str
    raw_total: int = 0
    raw_processed: int = 0
    raw_failed: int = 0
    source_rows: int = 0
    entities: int = 0
    relationships: int = 0
    queue_queued: int = 0
    queue_processed: int = 0
    queue_failed: int = 0
    latest_status: str = "-"
    latest_fetched: int = 0
    latest_processed: int = 0
    latest_failed: int = 0


@dataclass
class TaskState:
    name: str
    status: str = "idle"
    message: str = ""
    started_at: datetime | None = None
    finished_at: datetime | None = None
    totals: dict = field(default_factory=dict)


class SeedController:
    def __init__(self, args):
        self.args = args
        self.stop_event = threading.Event()
        self.lock = threading.RLock()
        self.chilecompra = TaskState("ChileCompra worker")
        self.infolobby = TaskState("InfoLobby CSV")
        self._chile_thread: threading.Thread | None = None
        self._infolobby_thread: threading.Thread | None = None

    def start_chilecompra_worker(self) -> None:
        with self.lock:
            if self._chile_thread and self._chile_thread.is_alive():
                self.chilecompra.message = "worker ya esta activo"
                return
            self.chilecompra = TaskState("ChileCompra worker", status="starting", started_at=datetime.now(TIMEZONE))
            self._chile_thread = threading.Thread(target=self._run_chilecompra_worker, name="seed-tui-chilecompra", daemon=True)
            self._chile_thread.start()

    def start_infolobby_load(self) -> None:
        with self.lock:
            if self._infolobby_thread and self._infolobby_thread.is_alive():
                self.infolobby.message = "carga InfoLobby ya esta activa"
                return
            self.infolobby = TaskState("InfoLobby CSV", status="starting", started_at=datetime.now(TIMEZONE))
            self._infolobby_thread = threading.Thread(target=self._run_infolobby_load, name="seed-tui-infolobby", daemon=True)
            self._infolobby_thread.start()

    def shutdown(self) -> None:
        self.stop_event.set()
        if self._chile_thread and self._chile_thread.is_alive():
            self._chile_thread.join(timeout=2)
        if self._infolobby_thread and self._infolobby_thread.is_alive():
            self._infolobby_thread.join(timeout=2)

    def snapshot_tasks(self) -> tuple[TaskState, TaskState]:
        with self.lock:
            return self.chilecompra, self.infolobby

    def _set_chile(self, **updates) -> None:
        with self.lock:
            for key, value in updates.items():
                setattr(self.chilecompra, key, value)

    def _set_infolobby(self, **updates) -> None:
        with self.lock:
            for key, value in updates.items():
                setattr(self.infolobby, key, value)

    def _run_chilecompra_worker(self) -> None:
        _run_background_quietly(self._run_chilecompra_worker_inner)

    def _run_chilecompra_worker_inner(self) -> None:
        if not os.getenv("CHILECOMPRA_TICKET"):
            self._set_chile(status="error", message="CHILECOMPRA_TICKET no configurado", finished_at=datetime.now(TIMEZONE))
            return
        cycle = 0
        totals = {"discovered": 0, "queued": 0, "processed": 0, "failed": 0, "errors": 0}
        while not self.stop_event.is_set():
            now = datetime.now(TIMEZONE)
            if not is_night_window(now, self.args.night_start, self.args.night_end):
                wait = min(60, seconds_until_night_window(now, self.args.night_start))
                self._set_chile(status="waiting", message=f"fuera de ventana nocturna; reintento en {wait}s", totals=totals.copy())
                self.stop_event.wait(wait)
                continue

            cycle += 1
            target_date = (now - timedelta(days=self.args.discover_days_back)).date()
            self._set_chile(status="running", message=f"ciclo {cycle}: discovery {target_date}", totals=totals.copy())
            db = SessionLocal()
            try:
                disc = discover_chilecompra(db, target_date, kind=self.args.kind, estado=self.args.estado, daily_budget=self.args.daily_budget)
                totals["discovered"] += disc.discovered
                totals["queued"] += disc.queued
                hyd = hydrate_chilecompra_queue(
                    db,
                    budget=self.args.hydration_budget,
                    daily_budget=self.args.daily_budget,
                    sleep_seconds=self.args.sleep_seconds,
                )
                totals["processed"] += hyd.processed
                totals["failed"] += hyd.failed
                self._set_chile(
                    status="running",
                    message=f"ciclo {cycle}: +{disc.queued} cola, +{hyd.processed} cargados",
                    totals=totals.copy(),
                )
            except Exception as exc:
                db.rollback()
                totals["errors"] += 1
                self._set_chile(status="error", message=str(exc)[:120], totals=totals.copy())
                self.stop_event.wait(min(300, max(5, self.args.sleep_seconds * 10)))
            finally:
                db.close()

            if self.args.chilecompra_once:
                self._set_chile(status="done", message="worker ejecuto un ciclo", finished_at=datetime.now(TIMEZONE), totals=totals.copy())
                return
            self.stop_event.wait(self.args.worker_interval)

    def _run_infolobby_load(self) -> None:
        _run_background_quietly(self._run_infolobby_load_inner)

    def _run_infolobby_load_inner(self) -> None:
        db = SessionLocal()
        try:
            self._set_infolobby(status="running", message="leyendo CSV UTF-16 en streaming")
            connector = get_connector("infolobby")
            run = run_connector(
                db,
                connector,
                data_dir=self.args.infolobby_data_dir,
                files=self.args.infolobby_files,
                limit=self.args.infolobby_limit,
                batch_size=self.args.batch_size,
            )
            self._set_infolobby(
                status=run.status,
                message=f"fetched={run.records_fetched} processed={run.records_processed} failed={run.records_failed}",
                finished_at=datetime.now(TIMEZONE),
                totals={"fetched": run.records_fetched, "processed": run.records_processed, "failed": run.records_failed},
            )
        except Exception as exc:
            db.rollback()
            self._set_infolobby(status="error", message=str(exc)[:120], finished_at=datetime.now(TIMEZONE))
        finally:
            db.close()


def configure_quiet_tui_mode() -> None:
    _db_engine.echo = False
    for logger_name in (
        "sqlalchemy",
        "sqlalchemy.engine",
        "sqlalchemy.pool",
        "uvicorn",
        "urllib3",
    ):
        logging.getLogger(logger_name).setLevel(logging.WARNING)


def _run_background_quietly(fn):
    configure_quiet_tui_mode()
    with _BACKGROUND_OUTPUT_LOCK:
        previous_disable_level = logging.root.manager.disable
        with open(os.devnull, "w") as sink:
            with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
                try:
                    logging.disable(logging.CRITICAL)
                    return fn()
                finally:
                    logging.disable(previous_disable_level)


def collect_source_stats(db, source_names: tuple[str, ...] = SOURCES) -> list[SourceStats]:
    stats = {source: SourceStats(source) for source in source_names}

    for source, status, count in db.query(RawRecord.source_name, RawRecord.status, func.count(RawRecord.id)).group_by(RawRecord.source_name, RawRecord.status):
        if source not in stats:
            continue
        stats[source].raw_total += count
        if status == "processed":
            stats[source].raw_processed = count
        elif status == "failed":
            stats[source].raw_failed = count

    for source, count in db.query(Source.source_name, func.count(Source.id)).group_by(Source.source_name):
        if source in stats:
            stats[source].source_rows = count

    for source, count in db.query(Source.source_name, func.count(Relationship.id)).join(Relationship, Relationship.source_id == Source.id).group_by(Source.source_name):
        if source in stats:
            stats[source].relationships = count

    for source in source_names:
        try:
            stats[source].entities = (
                db.query(Entity)
                .filter(Entity.entity_metadata["source_name"].astext == source)
                .count()
            )
        except Exception:
            stats[source].entities = 0

    for source, status, count in db.query(IngestionQueueItem.source_name, IngestionQueueItem.status, func.count(IngestionQueueItem.id)).group_by(IngestionQueueItem.source_name, IngestionQueueItem.status):
        if source not in stats:
            continue
        if status == "queued":
            stats[source].queue_queued = count
        elif status == "processed":
            stats[source].queue_processed = count
        elif status == "failed":
            stats[source].queue_failed = count

    for source in source_names:
        latest = (
            db.query(IngestionRun)
            .filter(IngestionRun.source_name == source)
            .order_by(IngestionRun.started_at.desc(), IngestionRun.id.desc())
            .first()
        )
        if latest:
            stats[source].latest_status = latest.status
            stats[source].latest_fetched = latest.records_fetched
            stats[source].latest_processed = latest.records_processed
            stats[source].latest_failed = latest.records_failed

    return [stats[source] for source in source_names]


def format_stats_table(stats: list[SourceStats]) -> list[str]:
    lines = ["Fuente        Raw proc/fail     Evidencias  Entidades  Relaciones  Cola q/p/f   Ultima corrida"]
    for item in stats:
        queue = f"{item.queue_queued}/{item.queue_processed}/{item.queue_failed}"
        latest = f"{item.latest_status} {item.latest_processed}/{item.latest_failed}"
        lines.append(
            f"{item.source_name:<13} "
            f"{item.raw_processed:>7}/{item.raw_failed:<7} "
            f"{item.source_rows:>9} "
            f"{item.entities:>9} "
            f"{item.relationships:>10} "
            f"{queue:>10}   "
            f"{latest}"
        )
    return lines


def render_plain_once(args) -> None:
    db = SessionLocal()
    try:
        for line in format_stats_table(collect_source_stats(db)):
            print(line)
    finally:
        db.close()


def run_curses(args) -> None:
    configure_quiet_tui_mode()
    controller = SeedController(args)
    try:
        curses.wrapper(_curses_main, args, controller)
    finally:
        controller.shutdown()


def _curses_main(stdscr, args, controller: SeedController) -> None:
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.timeout(500)
    message = "Listo. c=ChileCompra worker, i=InfoLobby CSV, r=refrescar, q=salir"

    while True:
        db = SessionLocal()
        try:
            stats = collect_source_stats(db)
        finally:
            db.close()
        chile_task, infolobby_task = controller.snapshot_tasks()

        stdscr.erase()
        _add(stdscr, 0, 0, "Mapa Poder LatAm - Seed de datos", curses.A_BOLD)
        _add(stdscr, 1, 0, "c inicia ChileCompra en fondo | i carga InfoLobby | r refresca | q sale")
        _add(stdscr, 3, 0, "Estado de fuentes", curses.A_BOLD)
        for idx, line in enumerate(format_stats_table(stats), start=4):
            _add(stdscr, idx, 0, line)

        base = 7 + len(stats)
        _add(stdscr, base, 0, "Tareas", curses.A_BOLD)
        _add(stdscr, base + 1, 0, _task_line(chile_task))
        _add(stdscr, base + 2, 0, _task_line(infolobby_task))
        _add(stdscr, base + 4, 0, message[: max(10, curses.COLS - 1)])
        stdscr.refresh()

        key = stdscr.getch()
        if key in (ord("q"), ord("Q")):
            message = "Saliendo; esperando cierre de hilos..."
            break
        if key in (ord("c"), ord("C")):
            controller.start_chilecompra_worker()
            message = "ChileCompra worker solicitado"
        elif key in (ord("i"), ord("I")):
            controller.start_infolobby_load()
            message = "Carga InfoLobby solicitada"
        elif key in (ord("r"), ord("R"), -1):
            message = message
        else:
            message = f"Tecla no reconocida: {key}"


def _task_line(task: TaskState) -> str:
    started = task.started_at.strftime("%H:%M:%S") if task.started_at else "--:--:--"
    return f"{task.name:<20} {task.status:<12} desde {started}  {task.message}"


def _add(stdscr, y: int, x: int, text: str, attr: int = 0) -> None:
    try:
        stdscr.addnstr(y, x, text, max(0, curses.COLS - x - 1), attr)
    except curses.error:
        pass


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="TUI general para seedeo de datos")
    parser.add_argument("--once", action="store_true", help="Print current ingestion counters and exit")
    parser.add_argument("--infolobby-data-dir", default=None, help="Directorio con CSV locales InfoLobby")
    parser.add_argument("--infolobby-file", action="append", dest="infolobby_files", help="CSV InfoLobby a cargar. Repetible.")
    parser.add_argument("--infolobby-limit", type=int, default=None, help="Limite de filas InfoLobby para pruebas")
    parser.add_argument("--batch-size", type=int, default=1000, help="Commit cada N registros")
    parser.add_argument("--daily-budget", type=int, default=DEFAULT_DAILY_BUDGET)
    parser.add_argument("--hydration-budget", type=int, default=500)
    parser.add_argument("--discover-days-back", type=int, default=1)
    parser.add_argument("--kind", choices=["licitaciones", "ordenes_compra", "all"], default="all")
    parser.add_argument("--estado", help="Parametro estado ChileCompra")
    parser.add_argument("--night-start", default="22:00")
    parser.add_argument("--night-end", default="07:00")
    parser.add_argument("--sleep-seconds", type=float, default=0.2)
    parser.add_argument("--worker-interval", type=float, default=60)
    parser.add_argument("--chilecompra-once", action="store_true", help="El worker ChileCompra ejecuta un ciclo y queda detenido")
    args = parser.parse_args()

    if args.once:
        render_plain_once(args)
        return
    configure_quiet_tui_mode()
    run_curses(args)


if __name__ == "__main__":
    main()
