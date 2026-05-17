use anyhow::Result;
use clap::Parser;
use crossterm::{
    cursor::{Hide, MoveTo, Show},
    event::{self, Event, KeyCode},
    execute, queue,
    style::{Attribute, Print, SetAttribute},
    terminal::{self, Clear, ClearType, EnterAlternateScreen, LeaveAlternateScreen},
};
use postgres::{Client, NoTls};
use serde_json::Value;
use std::{
    collections::HashMap,
    env,
    fs::{File, OpenOptions},
    io::{self, BufWriter, Read, Write},
    path::{Path, PathBuf},
    process::Child,
    sync::mpsc::{self, Receiver, Sender},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const INFOLOBBY_SOURCE_URL: &str = "https://www.infolobby.cl/";
const INFOLOBBY_LICENSE: &str = "InfoLobby / Consejo para la Transparencia";
const OFFSHORE_SOURCE_URL: &str = "https://offshoreleaks.icij.org/";
const OFFSHORE_LICENSE: &str = "ICIJ Offshore Leaks";
const LATAM_ISO3: &[&str] = &[
    "ARG", "BOL", "BRA", "CHL", "COL", "CRI", "CUB", "DOM", "ECU", "SLV", "GTM", "HND", "MEX",
    "NIC", "PAN", "PRY", "PER", "URY", "VEN", "PRI",
];

#[derive(Parser, Debug)]
#[command(name = "seed-tui-rs", about = "TUI Rust para carga de datos")]
struct Args {
    #[arg(long)]
    once: bool,
    #[arg(long)]
    run_infolobby: bool,
    #[arg(long)]
    run_offshore: bool,
    #[arg(long)]
    database_url: Option<String>,
    #[arg(long)]
    infolobby_data_dir: Option<String>,
    #[arg(long)]
    infolobby_file: Vec<String>,
    #[arg(long)]
    infolobby_limit: Option<u64>,
    #[arg(long, default_value_t = 64)]
    infolobby_copy_chunk_mb: u64,
    #[arg(long)]
    infolobby_skip_raw_records: bool,
    #[arg(long)]
    infolobby_skip_count: bool,
    #[arg(long)]
    offshore_data_dir: Option<String>,
    #[arg(long)]
    offshore_limit: Option<u64>,
    #[arg(long)]
    offshore_country_code: Vec<String>,
    #[arg(long, default_value_t = 500)]
    hydration_budget: u64,
    #[arg(long, default_value_t = 1)]
    discover_days_back: u64,
    #[arg(long, default_value = "all")]
    kind: String,
    #[arg(long)]
    estado: Option<String>,
    #[arg(long, default_value = "22:00")]
    night_start: String,
    #[arg(long, default_value = "07:00")]
    night_end: String,
    #[arg(long, default_value_t = 0.2)]
    sleep_seconds: f64,
    #[arg(long, default_value_t = 9000)]
    daily_budget: u64,
    #[arg(long)]
    chilecompra_once: bool,
    #[arg(long)]
    skip_night_window: bool,
    #[arg(long, help = "Backfill desde YYYY-MM-DD")]
    backfill_from: Option<String>,
    #[arg(long, help = "Backfill hasta YYYY-MM-DD (por defecto hoy)")]
    backfill_to: Option<String>,
    #[arg(long, default_value_t = 0.1, help = "Segundos entre fechas durante backfill")]
    sleep_between: f64,
    #[arg(long, default_value_t = 5, help = "Pausar backfill tras N errores consecutivos")]
    max_consecutive_errors: u32,
}

#[derive(Clone, Default)]
struct SourceStats {
    source_name: String,
    raw_processed: i64,
    raw_failed: i64,
    source_rows: i64,
    entities: i64,
    relationships: i64,
    queue_queued: i64,
    queue_processed: i64,
    queue_failed: i64,
    latest_status: String,
    latest_processed: i64,
    latest_failed: i64,
}

#[derive(Clone)]
struct TaskState {
    name: String,
    status: String,
    message: String,
    started: Option<Instant>,
    processed: u64,
    skipped: u64,
    failed: u64,
    total: u64,
    rate: f64,
    file: String,
    row_number: String,
}

impl TaskState {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            status: "idle".to_string(),
            message: String::new(),
            started: None,
            processed: 0,
            skipped: 0,
            failed: 0,
            total: 0,
            rate: 0.0,
            file: "-".to_string(),
            row_number: "-".to_string(),
        }
    }
}

enum Msg {
    Progress { task: TaskKind, payload: Value },
    Stats(Vec<SourceStats>),
}

#[derive(Copy, Clone)]
enum TaskKind {
    Chile,
    InfoLobby,
    Offshore,
}

struct RunningTask {
    child: Child,
}

struct App {
    backend_dir: PathBuf,
    db_url: String,
    stats: Vec<SourceStats>,
    chile: TaskState,
    infolobby: TaskState,
    offshore: TaskState,
    chile_proc: Option<RunningTask>,
    chilecompra_active: bool,
    infolobby_active: bool,
    offshore_active: bool,
    offshore_proc: Option<RunningTask>,
    message: String,
    last_stats: Instant,
    stats_loading: bool,
    log_file: Option<BufWriter<File>>,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let backend_dir = find_backend_dir()?;
    let _ = dotenvy::from_path(backend_dir.join(".env"));
    let db_url = normalize_db_url(
        &args
            .database_url
            .clone()
            .or_else(|| env::var("DATABASE_URL").ok())
            .unwrap_or_else(|| {
                "postgresql://mapapoder:mapapoder@localhost:5432/mapapoderlatam".to_string()
            }),
    );

    if args.once {
        let stats = collect_stats(&db_url).unwrap_or_default();
        print_stats(&stats);
        return Ok(());
    }
    if args.run_infolobby {
        let (tx, _rx) = mpsc::channel();
        run_infolobby_rust(
            InfolobbyOptions {
                db_url,
                data_dir: args
                    .infolobby_data_dir
                    .clone()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| backend_dir.join("data/infolobby")),
                files: args.infolobby_file.clone(),
                limit: args.infolobby_limit,
                chunk_bytes: args.infolobby_copy_chunk_mb.max(1) as usize * 1024 * 1024,
                skip_raw_records: args.infolobby_skip_raw_records,
                skip_count: args.infolobby_skip_count,
            },
            tx,
        )?;
        println!("InfoLobby Rust completado");
        return Ok(());
    }
    if args.run_offshore {
        let (tx, _rx) = mpsc::channel();
        run_offshore_rust(
            OffshoreOptions {
                db_url,
                data_dir: args
                    .offshore_data_dir
                    .clone()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| backend_dir.join("data/offshore")),
                limit: args.offshore_limit,
                country_codes: normalize_offshore_country_codes(&args.offshore_country_code),
            },
            tx,
        )?;
        println!("Offshore Rust completado");
        return Ok(());
    }

    let (tx, rx) = mpsc::channel();
    let log_file = open_log_file(&backend_dir);
    let mut app = App {
        backend_dir,
        db_url,
        stats: Vec::new(),
        chile: TaskState::new("ChileCompra worker"),
        infolobby: TaskState::new("InfoLobby CSV"),
        offshore: TaskState::new("Offshore Leaks"),
        chile_proc: None,
        chilecompra_active: false,
        infolobby_active: false,
        offshore_active: false,
        offshore_proc: None,
        message: "Listo".to_string(),
        last_stats: Instant::now() - Duration::from_secs(60),
        stats_loading: false,
        log_file,
    };

    run_tui(&mut app, &args, tx, rx)
}

fn run_tui(app: &mut App, args: &Args, tx: Sender<Msg>, rx: Receiver<Msg>) -> Result<()> {
    let mut out = io::stdout();
    terminal::enable_raw_mode()?;
    execute!(out, EnterAlternateScreen, Hide)?;
    let result = run_tui_inner(app, args, tx, rx);
    execute!(out, Show, LeaveAlternateScreen)?;
    terminal::disable_raw_mode()?;
    flush_log(&mut app.log_file);
    result
}

fn run_tui_inner(app: &mut App, args: &Args, tx: Sender<Msg>, rx: Receiver<Msg>) -> Result<()> {
    loop {
        drain_messages(app, &rx);
        refresh_stats(app, &tx);
        flush_log(&mut app.log_file);
        draw(app)?;
        if event::poll(Duration::from_millis(250))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('q') | KeyCode::Char('Q') => {
                        app.message = "Saliendo; deteniendo procesos...".to_string();
                        stop_children(app);
                        break;
                    }
                    KeyCode::Char('r') | KeyCode::Char('R') => {
                        app.last_stats = Instant::now() - Duration::from_secs(60);
                        app.message = "Refresco solicitado".to_string();
                    }
                    KeyCode::Char('i') | KeyCode::Char('I') => {
                        start_infolobby(app, args, tx.clone())
                    }
                    KeyCode::Char('o') | KeyCode::Char('O') => {
                        start_offshore(app, args, tx.clone())
                    }
                    KeyCode::Char('c') | KeyCode::Char('C') => start_chile(app, args, tx.clone()),
                    _ => app.message = "Tecla no reconocida".to_string(),
                }
            }
        }
    }
    Ok(())
}

fn start_infolobby(app: &mut App, args: &Args, tx: Sender<Msg>) {
    if app.infolobby_active {
        app.message = "Carga InfoLobby ya esta activa".to_string();
        return;
    }
    app.infolobby_active = true;
    reset_task(&mut app.infolobby);
    app.infolobby.status = "running".to_string();
    app.infolobby.message = "carga Rust iniciada".to_string();
    app.message = "InfoLobby Rust iniciado".to_string();

    let opts = InfolobbyOptions {
        db_url: app.db_url.clone(),
        data_dir: args
            .infolobby_data_dir
            .clone()
            .map(PathBuf::from)
            .unwrap_or_else(|| app.backend_dir.join("data/infolobby")),
        files: args.infolobby_file.clone(),
        limit: args.infolobby_limit,
        chunk_bytes: args.infolobby_copy_chunk_mb.max(1) as usize * 1024 * 1024,
        skip_raw_records: args.infolobby_skip_raw_records,
        skip_count: args.infolobby_skip_count,
    };
    thread::spawn(move || {
        if let Err(err) = run_infolobby_rust(opts, tx.clone()) {
            let _ = tx.send(Msg::Progress {
                task: TaskKind::InfoLobby,
                payload: serde_json::json!({
                    "phase": "done",
                    "status": "error",
                    "message": err.to_string(),
                    "records_failed": 1
                }),
            });
        }
    });
}

fn start_offshore(app: &mut App, args: &Args, tx: Sender<Msg>) {
    if app.offshore_active {
        app.message = "Carga Offshore ya esta activa".to_string();
        return;
    }
    app.offshore_active = true;
    reset_task(&mut app.offshore);
    app.offshore.status = "running".to_string();
    app.offshore.message = "carga Rust iniciada".to_string();
    app.message = "Offshore Rust iniciado".to_string();
    let opts = OffshoreOptions {
        db_url: app.db_url.clone(),
        data_dir: args
            .offshore_data_dir
            .clone()
            .map(PathBuf::from)
            .unwrap_or_else(|| app.backend_dir.join("data/offshore")),
        limit: args.offshore_limit,
        country_codes: normalize_offshore_country_codes(&args.offshore_country_code),
    };
    thread::spawn(move || {
        if let Err(err) = run_offshore_rust(opts, tx.clone()) {
            let _ = tx.send(Msg::Progress {
                task: TaskKind::Offshore,
                payload: serde_json::json!({
                    "phase": "done",
                    "status": "error",
                    "message": pg_error_detail(&err),
                    "records_failed": 1
                }),
            });
        }
    });
}

fn start_chile(app: &mut App, args: &Args, tx: Sender<Msg>) {
    if app.chilecompra_active {
        app.message = "ChileCompra ya esta activo".to_string();
        return;
    }
    let ticket = match std::env::var("CHILECOMPRA_TICKET") {
        Ok(t) if !t.trim().is_empty() => t,
        _ => {
            app.chile.status = "error".to_string();
            app.chile.message = "CHILECOMPRA_TICKET no configurado — define la variable de entorno".to_string();
            app.message = "ChileCompra: CHILECOMPRA_TICKET falta".to_string();
            return;
        }
    };
    app.chilecompra_active = true;
    reset_task(&mut app.chile);
    app.chile.status = "running".to_string();
    app.chile.message = "iniciando worker ChileCompra".to_string();
    app.message = "ChileCompra worker iniciado".to_string();
    let opts = ChileCompraOpts {
        db_url: app.db_url.clone(),
        ticket,
        daily_budget: args.daily_budget,
        hydration_budget: args.hydration_budget,
        discover_days_back: args.discover_days_back,
        kind: args.kind.clone(),
        estado: args.estado.clone(),
        night_start: args.night_start.clone(),
        night_end: args.night_end.clone(),
        sleep_seconds: args.sleep_seconds,
        once: args.chilecompra_once,
        skip_night_window: args.skip_night_window,
        backfill_from: args.backfill_from.clone(),
        backfill_to: args.backfill_to.clone(),
        sleep_between: args.sleep_between,
        max_consecutive_errors: args.max_consecutive_errors,
    };
    thread::spawn(move || {
        match run_chilecompra_worker(opts, tx.clone()) {
            Ok(()) => {}
            Err(err) => {
                let _ = tx.send(Msg::Progress {
                    task: TaskKind::Chile,
                    payload: serde_json::json!({
                        "phase": "done",
                        "status": "error",
                        "message": err.to_string(),
                    }),
                });
            }
        }
    });
}

fn open_log_file(backend_dir: &Path) -> Option<BufWriter<File>> {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let path = backend_dir.join(format!("seed-{ts}.log"));
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map(|f| BufWriter::with_capacity(64 * 1024, f))
        .ok()
}

fn flush_log(log_file: &mut Option<BufWriter<File>>) {
    if let Some(f) = log_file {
        let _ = f.flush();
    }
}

fn log_event(log_file: &mut Option<BufWriter<File>>, source: &str, payload: &Value) {
    let Some(f) = log_file else { return };
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let line = format!("[{ts}] [{source}] {}\n", payload);
    let _ = f.write_all(line.as_bytes());
}

fn drain_messages(app: &mut App, rx: &Receiver<Msg>) {
    // Cap per frame so message flood never starves the render/input loop
    let mut n = 0;
    while let Ok(msg) = rx.try_recv() {
        match msg {
            Msg::Progress { task, payload } => {
                log_event(&mut app.log_file, task_name(task), &payload);
                apply_progress(task_state_mut(app, task), &payload);
            }
            Msg::Stats(stats) => {
                app.stats = stats;
                app.stats_loading = false;
            }
        }
        n += 1;
        if n >= 500 {
            break;
        }
    }
    poll_finished(app, TaskKind::Chile);
    poll_finished(app, TaskKind::InfoLobby);
    poll_finished(app, TaskKind::Offshore);
}

fn poll_finished(app: &mut App, task: TaskKind) {
    match task {
        TaskKind::InfoLobby => {
            if app.infolobby.status == "completed" || app.infolobby.status == "error" {
                app.infolobby_active = false;
            }
            return;
        }
        TaskKind::Offshore => {
            if app.offshore.status == "completed" || app.offshore.status == "error" {
                app.offshore_active = false;
            }
            if app.offshore_proc.is_none() {
                return;
            }
        }
        TaskKind::Chile => {
            if app.chile.status == "completed" || app.chile.status == "error" || app.chile.status == "done" {
                app.chilecompra_active = false;
            }
        }
    }
    let finished = {
        let slot = match task {
            TaskKind::Chile => &mut app.chile_proc,
            TaskKind::InfoLobby => unreachable!(),
            TaskKind::Offshore => &mut app.offshore_proc,
        };
        if let Some(proc) = slot {
            match proc.child.try_wait() {
                Ok(Some(status)) => Some(status),
                _ => None,
            }
        } else {
            None
        }
    };
    if let Some(status) = finished {
        let state = task_state_mut(app, task);
        state.status = if status.success() {
            "completed"
        } else {
            "error"
        }
        .to_string();
        if state.message.is_empty() || state.message == "proceso iniciado" {
            state.message = format!("proceso finalizo con {status}");
        }
        match task {
            TaskKind::Chile => app.chile_proc = None,
            TaskKind::InfoLobby => unreachable!(),
            TaskKind::Offshore => app.offshore_proc = None,
        }
    }
}

fn apply_progress(state: &mut TaskState, payload: &Value) {
    let phase = payload_str(payload, "phase")
        .or_else(|| payload_str(payload, "stage"))
        .unwrap_or("running");
    if phase == "stderr" || phase == "log" {
        state.message = payload_str(payload, "message")
            .unwrap_or("")
            .chars()
            .take(120)
            .collect();
        return;
    }
    state.status = payload_str(payload, "status")
        .unwrap_or("running")
        .to_string();
    if state.status == "error" {
        state.message = payload_str(payload, "message")
            .unwrap_or("error")
            .chars()
            .take(120)
            .collect();
        return;
    }
    if state.status == "running" && phase == "done" {
        state.status = "completed".to_string();
    }
    state.processed = payload_u64(payload, "records_processed")
        .or_else(|| payload_u64(payload, "inserted_relationships"))
        .or_else(|| payload_u64(payload, "processed"))
        .unwrap_or(state.processed);
    state.failed = payload_u64(payload, "records_failed")
        .or_else(|| payload_u64(payload, "failed"))
        .unwrap_or(state.failed);
    state.skipped = payload_u64(payload, "records_skipped")
        .or_else(|| payload_u64(payload, "skipped"))
        .unwrap_or(state.skipped);
    state.total = payload_u64(payload, "total")
        .or_else(|| payload_u64(payload, "total_rows"))
        .or_else(|| payload_u64(payload, "discovered"))
        .unwrap_or(state.total);
    state.file = payload_str(payload, "file")
        .unwrap_or(&state.file)
        .to_string();
    state.row_number = payload_u64(payload, "file_rows")
        .map(|n| n.to_string())
        .unwrap_or_else(|| state.row_number.clone());
    if let Some(started) = state.started {
        let elapsed = started.elapsed().as_secs_f64().max(0.001);
        state.rate = (state
            .processed
            .max(payload_u64(payload, "counting_rows").unwrap_or(0)) as f64)
            / elapsed;
    }
    state.message = format!(
        "{phase} {} {}/{} {:.1}/s",
        state.file, state.processed, state.total, state.rate
    );
}

fn reset_task(task: &mut TaskState) {
    task.status = "starting".to_string();
    task.message.clear();
    task.started = Some(Instant::now());
    task.processed = 0;
    task.skipped = 0;
    task.failed = 0;
    task.total = 0;
    task.rate = 0.0;
    task.file = "-".to_string();
    task.row_number = "-".to_string();
}

fn refresh_stats(app: &mut App, tx: &Sender<Msg>) {
    if app.stats_loading || app.last_stats.elapsed() < Duration::from_secs(2) {
        return;
    }
    app.last_stats = Instant::now();
    app.stats_loading = true;
    let db_url = app.db_url.clone();
    let tx = tx.clone();
    thread::spawn(move || {
        let stats = collect_stats(&db_url).unwrap_or_default();
        let _ = tx.send(Msg::Stats(stats));
    });
}

fn collect_stats(db_url: &str) -> Result<Vec<SourceStats>> {
    let mut client = Client::connect(db_url, NoTls)?;
    let sources = ["chilecompra", "infolobby", "offshore"];
    let mut stats: Vec<SourceStats> = sources
        .iter()
        .map(|s| SourceStats {
            source_name: s.to_string(),
            latest_status: "-".to_string(),
            ..Default::default()
        })
        .collect();

    for row in client.query("SELECT source_name, status, count(*)::bigint FROM raw_records GROUP BY source_name, status", &[])? {
        if let Some(s) = find_stat(&mut stats, row.get::<_, String>(0).as_str()) {
            let status: String = row.get(1);
            let count: i64 = row.get(2);
            if status == "processed" {
                s.raw_processed = count;
            } else if status == "failed" {
                s.raw_failed = count;
            }
        }
    }
    for row in client.query(
        "SELECT source_name, count(*)::bigint FROM sources GROUP BY source_name",
        &[],
    )? {
        if let Some(s) = find_stat(&mut stats, row.get::<_, String>(0).as_str()) {
            s.source_rows = row.get(1);
        }
    }
    for row in client.query(
        "SELECT s.source_name, count(r.id)::bigint FROM sources s JOIN relationships r ON r.source_id = s.id GROUP BY s.source_name",
        &[],
    )? {
        if let Some(s) = find_stat(&mut stats, row.get::<_, String>(0).as_str()) {
            s.relationships = row.get(1);
        }
    }
    for source in sources {
        let pattern = format!("{source}:%");
        if let Some(s) = find_stat(&mut stats, source) {
            s.entities = client
                .query_one(
                    "SELECT count(*)::bigint FROM entities WHERE external_id LIKE $1",
                    &[&pattern],
                )?
                .get(0);
        }
    }
    for row in client.query("SELECT source_name, status, count(*)::bigint FROM ingestion_queue GROUP BY source_name, status", &[]).unwrap_or_default() {
        if let Some(s) = find_stat(&mut stats, row.get::<_, String>(0).as_str()) {
            let status: String = row.get(1);
            let count: i64 = row.get(2);
            if status == "queued" {
                s.queue_queued = count;
            } else if status == "processed" {
                s.queue_processed = count;
            } else if status == "failed" {
                s.queue_failed = count;
            }
        }
    }
    for source in sources {
        if let Some(row) = client.query_opt(
            "SELECT status, records_processed::bigint, records_failed::bigint FROM ingestion_runs WHERE source_name = $1 ORDER BY started_at DESC, id DESC LIMIT 1",
            &[&source],
        )? {
            if let Some(s) = find_stat(&mut stats, source) {
                s.latest_status = row.get(0);
                s.latest_processed = row.get(1);
                s.latest_failed = row.get(2);
            }
        }
    }
    Ok(stats)
}

fn draw(app: &App) -> Result<()> {
    let mut out = io::stdout();
    let (w, h) = terminal::size()?;
    queue!(out, MoveTo(0, 0), Clear(ClearType::All))?;
    queue!(
        out,
        SetAttribute(Attribute::Bold),
        Print(" MAPA PODER LATAM :: SEED DE DATOS (Rust) "),
        SetAttribute(Attribute::Reset)
    )?;
    queue!(
        out,
        MoveTo(2, 1),
        Print("[c] ChileCompra   [i] InfoLobby   [o] Offshore Leaks   [r] refrescar   [q] salir")
    )?;
    draw_stats(&mut out, &app.stats, 3)?;
    let top = 9 + app.stats.len() as u16;
    let panel_w = (w.saturating_sub(4) / 3).max(30);
    draw_task(&mut out, 1, top, panel_w, &app.chile)?;
    draw_task(&mut out, panel_w + 2, top, panel_w, &app.infolobby)?;
    draw_task(
        &mut out,
        panel_w * 2 + 3,
        top,
        w.saturating_sub(panel_w * 2 + 4),
        &app.offshore,
    )?;
    queue!(
        out,
        MoveTo(1, h.saturating_sub(2)),
        Print("-".repeat(w.saturating_sub(2) as usize))
    )?;
    queue!(
        out,
        MoveTo(2, h.saturating_sub(1)),
        Print(trunc(&app.message, w.saturating_sub(4) as usize))
    )?;
    out.flush()?;
    Ok(())
}

fn draw_stats(out: &mut io::Stdout, stats: &[SourceStats], y: u16) -> Result<()> {
    queue!(
        out,
        MoveTo(1, y),
        Print("+ FUENTES ".to_string() + &"-".repeat(108) + "+")
    )?;
    queue!(
        out,
        MoveTo(2, y + 1),
        Print(format!(
            "{:<13} {:>13} {:>9} {:>9} {:>10} {:>11}   {}",
            "Fuente", "Raw ok/fail", "Evid.", "Ent.", "Rel.", "Cola q/p/f", "Ultima corrida"
        ))
    )?;
    for (idx, s) in stats.iter().enumerate() {
        queue!(
            out,
            MoveTo(2, y + 3 + idx as u16),
            Print(format!(
                "{:<13} {:>7}/{:<5} {:>9} {:>9} {:>10} {:>3}/{:>3}/{:<3}   {} {}/{}",
                s.source_name,
                s.raw_processed,
                s.raw_failed,
                s.source_rows,
                s.entities,
                s.relationships,
                s.queue_queued,
                s.queue_processed,
                s.queue_failed,
                s.latest_status,
                s.latest_processed,
                s.latest_failed
            ))
        )?;
    }
    Ok(())
}

fn draw_task(out: &mut io::Stdout, x: u16, y: u16, w: u16, task: &TaskState) -> Result<()> {
    let done = task.processed + task.skipped + task.failed;
    let pct = if task.total > 0 {
        ((done as f64 / task.total as f64) * 100.0).min(100.0)
    } else {
        0.0
    };
    let bar_w = w.saturating_sub(14).max(10) as usize;
    let filled = ((bar_w as f64) * pct / 100.0) as usize;
    let bar = format!(
        "[{}{}]",
        "#".repeat(filled),
        ".".repeat(bar_w.saturating_sub(filled))
    );
    queue!(
        out,
        MoveTo(x, y),
        Print(format!("+{}+", "-".repeat(w.saturating_sub(2) as usize)))
    )?;
    queue!(
        out,
        MoveTo(x + 2, y),
        Print(trunc(
            &task.name.to_uppercase(),
            w.saturating_sub(4) as usize
        ))
    )?;
    queue!(
        out,
        MoveTo(x + 2, y + 1),
        Print(format!("Estado {:<12}", task.status))
    )?;
    queue!(
        out,
        MoveTo(x + 2, y + 3),
        Print(format!("{} {:>5.1}%", bar, pct))
    )?;
    queue!(
        out,
        MoveTo(x + 2, y + 4),
        Print(trunc(
            &format!(
                "{}/{} ok  {} skip  {} fail  {:.1}/s",
                task.processed, task.total, task.skipped, task.failed, task.rate
            ),
            w.saturating_sub(4) as usize
        ))
    )?;
    queue!(
        out,
        MoveTo(x + 2, y + 5),
        Print(trunc(
            &format!("Actual {}#{}", task.file, task.row_number),
            w.saturating_sub(4) as usize
        ))
    )?;
    queue!(
        out,
        MoveTo(x + 2, y + 6),
        Print(trunc(&task.message, w.saturating_sub(4) as usize))
    )?;
    queue!(
        out,
        MoveTo(x, y + 7),
        Print(format!("+{}+", "-".repeat(w.saturating_sub(2) as usize)))
    )?;
    Ok(())
}

fn find_backend_dir() -> Result<PathBuf> {
    let cwd = env::current_dir()?;
    if cwd.join("alembic.ini").is_file() {
        return Ok(cwd);
    }
    if cwd.join("backend/alembic.ini").is_file() {
        return Ok(cwd.join("backend"));
    }
    if let Some(parent) = cwd.parent() {
        if parent.join("alembic.ini").is_file() {
            return Ok(parent.to_path_buf());
        }
    }
    anyhow::bail!("No pude ubicar backend/ desde {}", cwd.display())
}

fn normalize_db_url(url: &str) -> String {
    url.replacen("postgresql+psycopg://", "postgresql://", 1)
}

fn print_stats(stats: &[SourceStats]) {
    println!(
        "Fuente        Raw ok/fail  Evidencias  Entidades  Relaciones  Cola q/p/f   Ultima corrida"
    );
    for s in stats {
        println!(
            "{:<13} {:>7}/{:<5} {:>10} {:>9} {:>10} {:>3}/{:>3}/{:<3}   {} {}/{}",
            s.source_name,
            s.raw_processed,
            s.raw_failed,
            s.source_rows,
            s.entities,
            s.relationships,
            s.queue_queued,
            s.queue_processed,
            s.queue_failed,
            s.latest_status,
            s.latest_processed,
            s.latest_failed
        );
    }
}

fn task_name(task: TaskKind) -> &'static str {
    match task {
        TaskKind::Chile => "ChileCompra",
        TaskKind::InfoLobby => "InfoLobby",
        TaskKind::Offshore => "Offshore",
    }
}

fn task_state_mut(app: &mut App, task: TaskKind) -> &mut TaskState {
    match task {
        TaskKind::Chile => &mut app.chile,
        TaskKind::InfoLobby => &mut app.infolobby,
        TaskKind::Offshore => &mut app.offshore,
    }
}

fn stop_children(app: &mut App) {
    for slot in [&mut app.chile_proc, &mut app.offshore_proc] {
        if let Some(proc) = slot {
            let _ = proc.child.kill();
            let _ = proc.child.wait();
        }
        *slot = None;
    }
    app.chilecompra_active = false;
    app.infolobby_active = false;
    app.offshore_active = false;
}

fn find_stat<'a>(stats: &'a mut [SourceStats], source: &str) -> Option<&'a mut SourceStats> {
    stats.iter_mut().find(|s| s.source_name == source)
}

fn payload_str<'a>(payload: &'a Value, key: &str) -> Option<&'a str> {
    payload.get(key).and_then(Value::as_str)
}

fn payload_u64(payload: &Value, key: &str) -> Option<u64> {
    payload.get(key).and_then(Value::as_u64)
}

fn trunc(value: &str, max: usize) -> String {
    if value.chars().count() <= max {
        value.to_string()
    } else {
        value
            .chars()
            .take(max.saturating_sub(1))
            .collect::<String>()
            + "…"
    }
}

struct OffshoreOptions {
    db_url: String,
    data_dir: PathBuf,
    limit: Option<u64>,
    country_codes: Vec<String>,
}

fn normalize_offshore_country_codes(values: &[String]) -> Vec<String> {
    let source: Vec<String> = if values.is_empty() {
        LATAM_ISO3.iter().map(|v| v.to_string()).collect()
    } else {
        values.to_vec()
    };
    let mut out = Vec::new();
    for value in source {
        let code = value.trim().to_uppercase();
        if !code.is_empty() && !out.contains(&code) {
            out.push(code);
        }
    }
    if out.is_empty() {
        LATAM_ISO3.iter().map(|v| v.to_string()).collect()
    } else {
        out
    }
}

fn pg_error_detail(err: &anyhow::Error) -> String {
    for cause in err.chain() {
        if let Some(pg) = cause.downcast_ref::<postgres::Error>() {
            if let Some(db) = pg.as_db_error() {
                let mut msg = format!("{}: {}", db.severity(), db.message());
                if let Some(d) = db.detail() { msg.push_str(&format!(" | detail: {d}")); }
                if let Some(h) = db.hint() { msg.push_str(&format!(" | hint: {h}")); }
                return msg;
            }
        }
    }
    err.to_string()
}

fn run_offshore_rust(opts: OffshoreOptions, tx: Sender<Msg>) -> Result<()> {
    let run_token = uuid::Uuid::new_v4().to_string().replace('-', "_");
    let mut client = Client::connect(&opts.db_url, NoTls)?;
    client.batch_execute("SET statement_timeout = 0; SET work_mem = '512MB'; SET search_path = pg_temp, public;")?;
    let run_id: i32 = client
        .query_one(
            "INSERT INTO ingestion_runs (source_name, status, metadata) VALUES ('offshore', 'running', $1::text::jsonb) RETURNING id",
            &[&serde_json::json!({"mode":"rust_tui_rebuild","country_codes":opts.country_codes,"limit":opts.limit,"run_token":run_token}).to_string()],
        )?
        .get(0);
    let result = (|| -> Result<(u64, u64)> {
        cleanup_offshore(&mut client)?;
        emit_offshore(
            &tx,
            serde_json::json!({"phase":"cleanup","stage":"cleanup"}),
        )?;
        let (tables, copied) = copy_offshore_csvs(&mut client, &opts.data_dir, &tx)?;
        normalize_offshore_sql(
            &mut client,
            &tables,
            &opts.country_codes,
            opts.limit,
            &run_token,
            &tx,
        )?;
        let processed: i64 = client.query_one(
            "SELECT count(*) FROM relationships r JOIN sources s ON s.id = r.source_id WHERE s.source_name = 'offshore'",
            &[],
        )?.get(0);
        finish_simple_run(
            &mut client,
            run_id,
            "completed",
            copied,
            processed as u64,
            None,
        )?;
        emit_offshore(
            &tx,
            serde_json::json!({"phase":"done","stage":"done","status":"completed","records_fetched":copied,"records_processed":processed,"total":processed}),
        )?;
        Ok((copied, processed as u64))
    })();
    if let Err(err) = result {
        let _ = finish_simple_run(&mut client, run_id, "failed", 0, 0, Some(&err.to_string()));
        return Err(err);
    }
    Ok(())
}

fn offshore_headers() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        (
            "nodes-addresses.csv",
            vec![
                "node_id",
                "address",
                "name",
                "countries",
                "country_codes",
                "sourceID",
                "valid_until",
                "note",
            ],
        ),
        (
            "nodes-entities.csv",
            vec![
                "node_id",
                "name",
                "original_name",
                "former_name",
                "jurisdiction",
                "jurisdiction_description",
                "company_type",
                "address",
                "internal_id",
                "incorporation_date",
                "inactivation_date",
                "struck_off_date",
                "dorm_date",
                "status",
                "service_provider",
                "ibcRUC",
                "country_codes",
                "countries",
                "sourceID",
                "valid_until",
                "note",
            ],
        ),
        (
            "nodes-intermediaries.csv",
            vec![
                "node_id",
                "name",
                "status",
                "internal_id",
                "address",
                "countries",
                "country_codes",
                "sourceID",
                "valid_until",
                "note",
            ],
        ),
        (
            "nodes-officers.csv",
            vec![
                "node_id",
                "name",
                "countries",
                "country_codes",
                "sourceID",
                "valid_until",
                "note",
            ],
        ),
        (
            "nodes-others.csv",
            vec![
                "node_id",
                "name",
                "type",
                "incorporation_date",
                "struck_off_date",
                "closed_date",
                "jurisdiction",
                "jurisdiction_description",
                "countries",
                "country_codes",
                "sourceID",
                "valid_until",
                "note",
            ],
        ),
        (
            "relationships.csv",
            vec![
                "node_id_start",
                "node_id_end",
                "rel_type",
                "link",
                "status",
                "start_date",
                "end_date",
                "sourceID",
            ],
        ),
    ]
}

fn copy_offshore_csvs(
    client: &mut Client,
    data_dir: &Path,
    tx: &Sender<Msg>,
) -> Result<(HashMap<String, String>, u64)> {
    let run_token = uuid::Uuid::new_v4().to_string().replace('-', "_");
    let mut tables = HashMap::new();
    let mut total = 0;
    for (file_name, headers) in offshore_headers() {
        let table = format!(
            "tmp_offshore_{}_{}",
            Path::new(file_name)
                .file_stem()
                .and_then(|v| v.to_str())
                .unwrap_or("csv")
                .replace('-', "_"),
            run_token
        );
        let cols = headers
            .iter()
            .map(|h| format!("\"{}\" text", h.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(", ");
        client.batch_execute(&format!(
            "CREATE TEMP TABLE {table} (_seq BIGSERIAL, {cols})"
        ))?;
        let copied = copy_utf8_csv_text(client, &data_dir.join(file_name), &table, &headers)?;
        total += copied;
        // indexes on join columns so normalize JOIN is not O(N*M)
        if file_name == "relationships.csv" {
            client.batch_execute(&format!(
                "CREATE INDEX ON {table} (node_id_start); CREATE INDEX ON {table} (node_id_end)"
            ))?;
        } else {
            client.batch_execute(&format!("CREATE INDEX ON {table} (node_id)"))?;
        }
        tables.insert(file_name.to_string(), table);
        emit_offshore(
            tx,
            serde_json::json!({"phase":"copy rows","stage":"copy rows","file":file_name,"file_rows":copied,"records_fetched":total,"records_processed":total,"total_rows":total}),
        )?;
    }
    Ok((tables, total))
}

fn copy_utf8_csv_text(
    client: &mut Client,
    path: &Path,
    table: &str,
    headers: &[&str],
) -> Result<u64> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(path)?;
    validate_infolobby_headers(&mut rdr, path, headers)?;
    let copy_sql = format!(
        "COPY {table} ({}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')",
        headers
            .iter()
            .map(|h| format!("\"{}\"", h.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(", ")
    );
    let mut writer = client.copy_in(&copy_sql)?;
    let mut buf = String::with_capacity(64 * 1024 * 1024);
    let mut copied = 0;
    for row in rdr.records() {
        let row = row?;
        if row.len() < headers.len() {
            continue;
        }
        for idx in 0..headers.len() {
            if idx > 0 {
                buf.push('\t');
            }
            buf.push_str(&copy_text_cell(row.get(idx).unwrap_or("")));
        }
        buf.push('\n');
        copied += 1;
        if buf.len() >= 64 * 1024 * 1024 {
            writer.write_all(buf.as_bytes())?;
            buf.clear();
        }
    }
    if !buf.is_empty() {
        writer.write_all(buf.as_bytes())?;
    }
    writer.finish()?;
    Ok(copied)
}

fn cleanup_offshore(client: &mut Client) -> Result<()> {
    client.batch_execute(
        r#"
        DELETE FROM relationships WHERE source_id IN (SELECT id FROM sources WHERE source_name = 'offshore');
        DELETE FROM raw_records WHERE source_name = 'offshore';
        DELETE FROM sources WHERE source_name = 'offshore';
        DELETE FROM entity_identifiers WHERE source_name = 'offshore';
        DELETE FROM entities e
        WHERE e.external_id LIKE 'offshore:%'
          AND COALESCE(e.metadata->>'source_name', 'offshore') = 'offshore'
          AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.source_entity_id = e.id OR r.target_entity_id = e.id);
        "#,
    )?;
    Ok(())
}

fn finish_simple_run(
    client: &mut Client,
    run_id: i32,
    status: &str,
    fetched: u64,
    processed: u64,
    error: Option<&str>,
) -> Result<()> {
    client.execute(
        "UPDATE ingestion_runs SET status = $1, finished_at = now(), records_fetched = $2, records_processed = $3, records_failed = $4, error_message = $5 WHERE id = $6",
        &[&status, &(fetched as i32), &(processed as i32), &(if error.is_some() { 1 } else { 0 }), &error, &run_id],
    )?;
    Ok(())
}

fn normalize_offshore_sql(
    client: &mut Client,
    tables: &HashMap<String, String>,
    country_codes: &[String],
    limit: Option<u64>,
    run_token: &str,
    tx: &Sender<Msg>,
) -> Result<()> {
    client.batch_execute(
        r#"
        CREATE TEMP TABLE tmp_offshore_country_map (iso3 text PRIMARY KEY, iso2 text NOT NULL);
        CREATE TEMP TABLE tmp_offshore_nodes (node_id text PRIMARY KEY, node_kind text, display_name text, canonical_name text, entity_type text, country_codes text, countries text, source_id_raw text, metadata jsonb);
        CREATE TEMP TABLE tmp_offshore_selected_relationships (seq bigint, node_id_start text, node_id_end text, rel_type text, link text, status text, start_date text, end_date text, source_id_raw text);
        CREATE TEMP TABLE tmp_offshore_selected_nodes (node_id text PRIMARY KEY);
        CREATE TEMP TABLE tmp_offshore_source_map (kind text, stable_key text, source_id integer);
        INSERT INTO tmp_offshore_country_map (iso3, iso2) VALUES
        ('ARG','AR'),('BOL','BO'),('BRA','BR'),('CHL','CL'),('COL','CO'),('CRI','CR'),('CUB','CU'),('DOM','DO'),('ECU','EC'),('SLV','SV'),('GTM','GT'),('HND','HN'),('MEX','MX'),('NIC','NI'),('PAN','PA'),('PRY','PY'),('PER','PE'),('URY','UY'),('VEN','VE'),('PRI','PR');
        "#,
    )?;
    for (file, kind, typ, display) in [
        (
            "nodes-addresses.csv",
            "address",
            "address",
            "COALESCE(NULLIF(name, ''), NULLIF(address, ''), 'Offshore address ' || node_id)",
        ),
        (
            "nodes-entities.csv",
            "entity",
            "company",
            "COALESCE(NULLIF(name, ''), NULLIF(original_name, ''), 'Offshore entity ' || node_id)",
        ),
        (
            "nodes-intermediaries.csv",
            "intermediary",
            "company",
            "COALESCE(NULLIF(name, ''), 'Offshore intermediary ' || node_id)",
        ),
        (
            "nodes-officers.csv",
            "officer",
            "person",
            "COALESCE(NULLIF(name, ''), 'Offshore officer ' || node_id)",
        ),
        (
            "nodes-others.csv",
            "other",
            "company",
            "COALESCE(NULLIF(name, ''), 'Offshore node ' || node_id)",
        ),
    ] {
        let table = tables.get(file).unwrap();
        client.batch_execute(&format!(
            r#"INSERT INTO tmp_offshore_nodes
            SELECT node_id, '{kind}', {display}, lower(regexp_replace(btrim({display}), '\s+', ' ', 'g')), '{typ}', country_codes, countries, "sourceID",
                   jsonb_strip_nulls(jsonb_build_object('source_name','offshore','node_kind','{kind}','license','{OFFSHORE_LICENSE}','original_country_codes',NULLIF(country_codes,''),'countries',NULLIF(countries,'')) || ((to_jsonb(t) - '_seq') - 'node_id'))
            FROM {table} t WHERE node_id IS NOT NULL AND node_id <> '' ON CONFLICT (node_id) DO NOTHING;"#
        ))?;
    }
    client.batch_execute("CREATE INDEX ON tmp_offshore_nodes (country_codes)")?;
    // Drop copy tables — no longer needed, free temp space before big JOIN
    for (file, table) in tables {
        if file != "relationships.csv" {
            client.batch_execute(&format!("DROP TABLE IF EXISTS {table}"))?;
        }
    }
    let rel_table = tables.get("relationships.csv").unwrap();
    let limit_sql = limit.map(|v| format!("LIMIT {v}")).unwrap_or_default();
    client.execute(&format!(
        r#"WITH seed_nodes AS (
            SELECT n.node_id FROM tmp_offshore_nodes n WHERE EXISTS (
                SELECT 1 FROM regexp_split_to_table(upper(COALESCE(n.country_codes, '')), '\s*[,;|]\s*') AS c(code)
                WHERE code = ANY($1::text[])
            )
        ), selected AS (
            SELECT r._seq, r.node_id_start, r.node_id_end, r.rel_type, r.link, r.status, r.start_date, r.end_date, r."sourceID"
            FROM {rel_table} r
            JOIN tmp_offshore_nodes src ON src.node_id = r.node_id_start
            JOIN tmp_offshore_nodes dst ON dst.node_id = r.node_id_end
            WHERE r.rel_type IS NOT NULL AND r.rel_type <> ''
              AND (r.node_id_start IN (SELECT node_id FROM seed_nodes) OR r.node_id_end IN (SELECT node_id FROM seed_nodes))
            ORDER BY r._seq {limit_sql}
        )
        INSERT INTO tmp_offshore_selected_relationships SELECT * FROM selected;"#),
        &[&country_codes.to_vec()],
    )?;
    client.execute(
        r#"INSERT INTO tmp_offshore_selected_nodes (node_id)
        SELECT node_id_start FROM tmp_offshore_selected_relationships
        UNION SELECT node_id_end FROM tmp_offshore_selected_relationships
        ON CONFLICT DO NOTHING;"#,
        &[],
    )?;
    insert_offshore_graph(client, run_token)?;
    let selected_nodes: i64 = client
        .query_one("SELECT count(*) FROM tmp_offshore_selected_nodes", &[])?
        .get(0);
    let selected_relationships: i64 = client
        .query_one(
            "SELECT count(*) FROM tmp_offshore_selected_relationships",
            &[],
        )?
        .get(0);
    emit_offshore(
        tx,
        serde_json::json!({"phase":"normalize","stage":"normalize","selected_nodes":selected_nodes,"selected_relationships":selected_relationships}),
    )?;
    Ok(())
}

fn insert_offshore_graph(client: &mut Client, run_token: &str) -> Result<()> {
    client.execute(
        r#"WITH node_rows AS (
            SELECT 'offshore:node:' || n.node_id AS stable_key, n.* FROM tmp_offshore_nodes n JOIN tmp_offshore_selected_nodes s ON s.node_id = n.node_id
        ), inserted AS (
            INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata)
            SELECT 'offshore','public_dataset',$1,stable_key,$2,jsonb_strip_nulls(jsonb_build_object('record_type','node','node_id',node_id,'node_kind',node_kind,'sourceID',NULLIF(source_id_raw,''),'country_codes',NULLIF(country_codes,''),'countries',NULLIF(countries,''),'run_id',$3))
            FROM node_rows RETURNING id, external_id
        )
        INSERT INTO tmp_offshore_source_map SELECT 'node', external_id, id FROM inserted;"#,
        &[&OFFSHORE_SOURCE_URL, &OFFSHORE_LICENSE, &run_token],
    )?;
    client.execute(
        r#"WITH rel_rows AS (
            SELECT 'offshore:relationship:' || node_id_start || ':' || node_id_end || ':' || rel_type || ':' || seq::text AS stable_key, * FROM tmp_offshore_selected_relationships
        ), inserted AS (
            INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata)
            SELECT 'offshore','public_dataset',$1,stable_key,$2,jsonb_strip_nulls(jsonb_build_object('record_type','relationship','row_number',seq+1,'node_id_start',node_id_start,'node_id_end',node_id_end,'rel_type',rel_type,'link',NULLIF(link,''),'status',NULLIF(status,''),'start_date',NULLIF(start_date,''),'end_date',NULLIF(end_date,''),'sourceID',NULLIF(source_id_raw,''),'run_id',$3))
            FROM rel_rows RETURNING id, external_id
        )
        INSERT INTO tmp_offshore_source_map SELECT 'relationship', external_id, id FROM inserted;"#,
        &[&OFFSHORE_SOURCE_URL, &OFFSHORE_LICENSE, &run_token],
    )?;
    client.batch_execute(
        r#"INSERT INTO entities (external_id, canonical_name, display_name, entity_type, country_code, metadata, risk_score)
        SELECT 'offshore:' || n.node_id, n.canonical_name, n.display_name, n.entity_type, COALESCE(cm.iso2, 'XX'), n.metadata,
               CASE WHEN n.node_kind IN ('entity', 'intermediary') THEN 30 ELSE 15 END
        FROM tmp_offshore_nodes n JOIN tmp_offshore_selected_nodes s ON s.node_id = n.node_id
        LEFT JOIN LATERAL (SELECT NULLIF(code, '') AS iso3 FROM regexp_split_to_table(upper(COALESCE(n.country_codes, '')), '\s*[,;|]\s*') AS c(code) WHERE NULLIF(code, '') IS NOT NULL LIMIT 1) first_code ON true
        LEFT JOIN tmp_offshore_country_map cm ON cm.iso3 = first_code.iso3
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.external_id = 'offshore:' || n.node_id);
        INSERT INTO entity_identifiers (entity_id, scheme, value, country_code, source_name)
        SELECT e.id, 'ICIJ_NODE_ID', n.node_id, COALESCE(cm.iso2, 'XX'), 'offshore'
        FROM tmp_offshore_nodes n JOIN tmp_offshore_selected_nodes s ON s.node_id = n.node_id JOIN entities e ON e.external_id = 'offshore:' || n.node_id
        LEFT JOIN LATERAL (SELECT NULLIF(code, '') AS iso3 FROM regexp_split_to_table(upper(COALESCE(n.country_codes, '')), '\s*[,;|]\s*') AS c(code) WHERE NULLIF(code, '') IS NOT NULL LIMIT 1) first_code ON true
        LEFT JOIN tmp_offshore_country_map cm ON cm.iso3 = first_code.iso3
        ON CONFLICT (scheme, value, country_code) DO NOTHING;
        INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type, label, weight, confidence_score, metadata, source_id)
        SELECT src.id, dst.id, r.rel_type, NULLIF(r.link, ''), 1, 1,
               jsonb_strip_nulls(jsonb_build_object('source_name','offshore','rel_type',r.rel_type,'link',NULLIF(r.link,''),'status',NULLIF(r.status,''),'start_date',NULLIF(r.start_date,''),'end_date',NULLIF(r.end_date,''),'sourceID',NULLIF(r.source_id_raw,''))),
               sm.source_id
        FROM tmp_offshore_selected_relationships r
        JOIN entities src ON src.external_id = 'offshore:' || r.node_id_start
        JOIN entities dst ON dst.external_id = 'offshore:' || r.node_id_end
        JOIN tmp_offshore_source_map sm ON sm.kind = 'relationship' AND sm.stable_key = 'offshore:relationship:' || r.node_id_start || ':' || r.node_id_end || ':' || r.rel_type || ':' || r.seq::text
        ON CONFLICT DO NOTHING;"#,
    )?;
    Ok(())
}

#[derive(Clone)]
struct InfolobbyOptions {
    db_url: String,
    data_dir: PathBuf,
    files: Vec<String>,
    limit: Option<u64>,
    chunk_bytes: usize,
    skip_raw_records: bool,
    skip_count: bool,
}

struct InfolobbyCopyTotals {
    copied: u64,
    skipped: u64,
    extra_columns: u64,
}

fn run_infolobby_rust(opts: InfolobbyOptions, tx: Sender<Msg>) -> Result<()> {
    let selected = selected_infolobby_files(&opts.files)?;
    let mut client = Client::connect(&opts.db_url, NoTls)?;
    client.batch_execute("SET statement_timeout = 0; SET work_mem = '512MB'; SET search_path = pg_temp, public")?;
    let run_token = format!(
        "{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_nanos()
    );
    let tables: HashMap<String, String> = selected
        .iter()
        .map(|file| {
            (
                file.to_string(),
                format!(
                    "tmp_infolobby_{}_{}",
                    file.trim_end_matches(".csv").to_lowercase(),
                    run_token
                ),
            )
        })
        .collect();
    let run_id: i32 = client
        .query_one(
            "INSERT INTO ingestion_runs (source_name, status, metadata) VALUES ('infolobby', 'running', $1::text::jsonb) RETURNING id",
            &[&serde_json::json!({"mode":"rust_tui_rebuild","files":selected,"limit":opts.limit,"run_token":run_token}).to_string()],
        )?
        .get(0);

    let result = (|| -> Result<InfolobbyCopyTotals> {
        let expected = if opts.skip_count {
            0
        } else {
            count_infolobby_rows(&opts, &selected, &tx)?
        };
        cleanup_infolobby(&mut client)?;
        emit(
            &tx,
            serde_json::json!({"phase":"cleanup","stage":"cleanup","total":expected,"total_rows":expected}),
        )?;
        let totals = copy_infolobby_files(&mut client, &opts, &selected, &tables, expected, &tx)?;
        normalize_infolobby(&mut client, &tables, &run_token, opts.skip_raw_records, &tx)?;
        finish_infolobby_run(&mut client, run_id, "completed", &totals, None)?;
        emit(
            &tx,
            serde_json::json!({
                "phase":"done","stage":"done","status":"completed",
                "records_fetched":totals.copied,
                "records_processed":totals.copied,
                "records_skipped":totals.skipped,
                "total":totals.copied,
            }),
        )?;
        Ok(totals)
    })();

    if let Err(err) = result {
        let _ = finish_infolobby_run(
            &mut client,
            run_id,
            "failed",
            &InfolobbyCopyTotals {
                copied: 0,
                skipped: 0,
                extra_columns: 0,
            },
            Some(&err.to_string()),
        );
        return Err(err);
    }
    Ok(())
}

fn selected_infolobby_files(files: &[String]) -> Result<Vec<&'static str>> {
    let all = infolobby_headers()
        .into_iter()
        .map(|(name, _)| name)
        .collect::<Vec<_>>();
    if files.is_empty() {
        return Ok(all);
    }
    let known = infolobby_headers();
    let mut selected = Vec::new();
    for file in files {
        let normalized = if file.ends_with(".csv") {
            file.clone()
        } else {
            format!("{file}.csv")
        };
        let Some((name, _)) = known.iter().find(|(name, _)| **name == normalized) else {
            anyhow::bail!("CSV InfoLobby desconocido: {normalized}");
        };
        selected.push(*name);
    }
    Ok(selected)
}

fn infolobby_headers() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        (
            "audiencias.csv",
            vec![
                "uriAudiencia",
                "CodigoURI",
                "uriOrganismo",
                "organismo",
                "fechaEvento",
                "fechaRegistro",
                "fechaActualizacion",
            ],
        ),
        (
            "datosAudiencia.csv",
            vec![
                "uriAudiencia",
                "CodigoURI",
                "observaciones",
                "descripcion",
                "materia",
                "anio",
                "trimestre",
                "CUT",
            ],
        ),
        (
            "pasivos.csv",
            vec![
                "uriPasivo",
                "codigoPasivo",
                "uriPersona",
                "codigoPersona",
                "nombrePasivo",
                "organismo",
                "IDORPortal",
                "cargo",
                "inicioPasivo",
                "finPasivo",
            ],
        ),
        (
            "asistenciasPasivos.csv",
            vec![
                "codigoPasivo",
                "pasivo",
                "codigoOrganismo",
                "organismo",
                "cargo",
                "codigoAudiencia",
            ],
        ),
        (
            "activos.csv",
            vec![
                "uriActivo",
                "nombreActivo",
                "fichaActivoInfoLobby",
                "uriTipo",
                "uriPersona",
                "uriAudiencia",
                "CodigoURIPersona",
                "nombre",
                "tipoActivo",
                "uriOrganismo",
                "FechaInicio_Audiencia",
                "organismo",
                "IDORPortal",
                "anio",
                "trimestre",
            ],
        ),
        (
            "asistenciasActivos.csv",
            vec![
                "codigoActivo",
                "activo",
                "uriEmpLobby",
                "empresaLobby",
                "codigoAudiencia",
                "codigoRepresentado",
                "representado",
                "giroRepresentado",
            ],
        ),
        (
            "representaciones.csv",
            vec![
                "codigoRepresentado",
                "representado",
                "giroRepresentado",
                "codigoAudiencia",
                "personalidad",
            ],
        ),
        (
            "trabajaPara.csv",
            vec![
                "codigoEmpLobby",
                "empresaLobby",
                "codigoActivo",
                "activo",
                "tipoActivo",
                "codigoAudiencia",
            ],
        ),
        ("otrosAsistentes.csv", vec!["asistente", "codigoAudiencia"]),
        (
            "viajes.csv",
            vec![
                "codigoViaje",
                "destino",
                "pasivo",
                "codigoPasivo",
                "organismo",
                "IdOrPortal",
                "cargo",
                "fechaInicio",
                "fechaTermino",
                "descripcion",
                "costo",
                "financistas",
            ],
        ),
        (
            "donativos.csv",
            vec![
                "codigoDonativo",
                "descripcion",
                "pasivo",
                "codigoPasivo",
                "organismo",
                "IdOrPortal",
                "cargo",
                "fechaDonativo",
                "ocasion",
            ],
        ),
    ]
}

fn headers_for(file_name: &str) -> Vec<&'static str> {
    infolobby_headers()
        .into_iter()
        .find(|(name, _)| *name == file_name)
        .map(|(_, headers)| headers)
        .unwrap_or_default()
}

fn count_infolobby_rows(
    opts: &InfolobbyOptions,
    selected: &[&str],
    tx: &Sender<Msg>,
) -> Result<u64> {
    let mut total = 0;
    let mut remaining = opts.limit;
    for file_name in selected {
        if matches!(remaining, Some(0)) {
            break;
        }
        let headers = headers_for(file_name);
        let path = opts.data_dir.join(file_name);
        let mut rdr = utf16_csv_reader(&path)?;
        validate_infolobby_headers(&mut rdr, &path, &headers)?;
        let mut file_rows = 0;
        for row in rdr.records() {
            if matches!(remaining, Some(rem) if file_rows >= rem) {
                break;
            }
            let row = row?;
            if row.len() < headers.len() {
                continue;
            }
            file_rows += 1;
            if file_rows % 25_000 == 0 {
                emit(
                    tx,
                    serde_json::json!({
                        "phase":"count rows","stage":"count rows","file":file_name,
                        "counting_rows":total + file_rows,
                        "file_rows":file_rows,
                        "total_rows":opts.limit.unwrap_or(0),
                    }),
                )?;
            }
        }
        total += file_rows;
        if let Some(rem) = remaining.as_mut() {
            *rem = rem.saturating_sub(file_rows);
        }
    }
    emit(
        tx,
        serde_json::json!({"phase":"count rows","stage":"count rows","counting_rows":total,"total":total,"total_rows":total}),
    )?;
    Ok(total)
}

fn copy_infolobby_files(
    client: &mut Client,
    opts: &InfolobbyOptions,
    selected: &[&str],
    tables: &HashMap<String, String>,
    expected: u64,
    tx: &Sender<Msg>,
) -> Result<InfolobbyCopyTotals> {
    let mut totals = InfolobbyCopyTotals {
        copied: 0,
        skipped: 0,
        extra_columns: 0,
    };
    let mut remaining = opts.limit;
    for file_name in selected {
        let headers = headers_for(file_name);
        let table = tables.get(*file_name).unwrap();
        let cols = headers
            .iter()
            .map(|h| format!("\"{}\" text", h.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(", ");
        client.batch_execute(&format!(
            "CREATE TEMP TABLE {table} (_seq BIGSERIAL, {cols})"
        ))?;
        let copied = if matches!(remaining, Some(0)) {
            InfolobbyCopyTotals {
                copied: 0,
                skipped: 0,
                extra_columns: 0,
            }
        } else {
            copy_one_infolobby_file(
                client,
                &opts.data_dir.join(file_name),
                table,
                &headers,
                remaining,
                totals.copied,
                expected,
                opts.chunk_bytes,
                tx,
            )?
        };
        client.batch_execute(&format!("CREATE INDEX ON {table} ((_seq))"))?;
        totals.copied += copied.copied;
        totals.skipped += copied.skipped;
        totals.extra_columns += copied.extra_columns;
        if let Some(rem) = remaining.as_mut() {
            *rem = rem.saturating_sub(copied.copied);
        }
    }
    Ok(totals)
}

#[allow(clippy::too_many_arguments)]
fn copy_one_infolobby_file(
    client: &mut Client,
    path: &Path,
    table: &str,
    headers: &[&str],
    limit: Option<u64>,
    copied_before: u64,
    expected: u64,
    chunk_bytes: usize,
    tx: &Sender<Msg>,
) -> Result<InfolobbyCopyTotals> {
    let copy_sql = format!(
        "COPY {table} ({}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')",
        headers
            .iter()
            .map(|h| format!("\"{}\"", h.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(", ")
    );
    let mut writer = client.copy_in(&copy_sql)?;
    let mut rdr = utf16_csv_reader(path)?;
    validate_infolobby_headers(&mut rdr, path, headers)?;
    let mut totals = InfolobbyCopyTotals {
        copied: 0,
        skipped: 0,
        extra_columns: 0,
    };
    let mut buffered = 0;
    for row in rdr.records() {
        if matches!(limit, Some(lim) if totals.copied >= lim) {
            break;
        }
        let row = row?;
        if row.len() < headers.len() {
            totals.skipped += 1;
            continue;
        }
        if row.len() > headers.len() {
            totals.extra_columns += 1;
        }
        let mut line = String::new();
        for idx in 0..headers.len() {
            if idx > 0 {
                line.push('\t');
            }
            line.push_str(&copy_text_cell(row.get(idx).unwrap_or("")));
        }
        line.push('\n');
        writer.write_all(line.as_bytes())?;
        buffered += line.len();
        totals.copied += 1;
        if buffered >= chunk_bytes {
            writer.flush()?;
            buffered = 0;
            emit(
                tx,
                serde_json::json!({
                    "phase":"copy rows","stage":"copy rows","file":path.file_name().and_then(|v| v.to_str()).unwrap_or("-"),
                    "file_rows":totals.copied,
                    "records_fetched":copied_before + totals.copied,
                    "records_processed":copied_before + totals.copied,
                    "records_skipped":totals.skipped,
                    "extra_column_rows":totals.extra_columns,
                    "total":expected,
                    "total_rows":expected,
                }),
            )?;
        }
    }
    writer.finish()?;
    emit(
        tx,
        serde_json::json!({
            "phase":"copy rows","stage":"copy rows","file":path.file_name().and_then(|v| v.to_str()).unwrap_or("-"),
            "file_rows":totals.copied,
            "records_fetched":copied_before + totals.copied,
            "records_processed":copied_before + totals.copied,
            "records_skipped":totals.skipped,
            "extra_column_rows":totals.extra_columns,
            "total":expected,
            "total_rows":expected,
        }),
    )?;
    Ok(totals)
}

fn utf16_csv_reader(path: &Path) -> Result<csv::Reader<Box<dyn Read>>> {
    let file = File::open(path)?;
    let decoder = encoding_rs_io::DecodeReaderBytesBuilder::new()
        .encoding(Some(encoding_rs::UTF_16LE))
        .build(file);
    Ok(csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(Box::new(decoder) as Box<dyn Read>))
}

fn validate_infolobby_headers<R: Read>(
    rdr: &mut csv::Reader<R>,
    path: &Path,
    expected: &[&str],
) -> Result<()> {
    let actual = rdr
        .headers()?
        .iter()
        .map(|h| {
            h.trim_start_matches('\u{feff}')
                .trim()
                .trim_matches('"')
                .to_string()
        })
        .collect::<Vec<_>>();
    let expected = expected.iter().map(|h| h.to_string()).collect::<Vec<_>>();
    if actual != expected {
        anyhow::bail!(
            "Headers InfoLobby inesperados en {}: {:?} != {:?}",
            path.display(),
            actual,
            expected
        );
    }
    Ok(())
}

fn copy_text_cell(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\t', "\\t")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn emit(tx: &Sender<Msg>, payload: Value) -> Result<()> {
    emit_task(tx, TaskKind::InfoLobby, payload)
}

fn emit_offshore(tx: &Sender<Msg>, payload: Value) -> Result<()> {
    emit_task(tx, TaskKind::Offshore, payload)
}

fn emit_task(tx: &Sender<Msg>, task: TaskKind, payload: Value) -> Result<()> {
    tx.send(Msg::Progress { task, payload })?;
    Ok(())
}

fn cleanup_infolobby(client: &mut Client) -> Result<()> {
    client.batch_execute(
        r#"
        DELETE FROM relationships WHERE source_id IN (SELECT id FROM sources WHERE source_name = 'infolobby');
        DELETE FROM raw_records WHERE source_name = 'infolobby';
        DELETE FROM sources WHERE source_name = 'infolobby';
        DELETE FROM entity_identifiers WHERE source_name = 'infolobby';
        DELETE FROM entities e
        WHERE e.external_id LIKE 'infolobby:%'
          AND COALESCE(e.metadata->>'source_name', 'infolobby') = 'infolobby'
          AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.source_entity_id = e.id OR r.target_entity_id = e.id);
        "#,
    )?;
    Ok(())
}

fn finish_infolobby_run(
    client: &mut Client,
    run_id: i32,
    status: &str,
    totals: &InfolobbyCopyTotals,
    error: Option<&str>,
) -> Result<()> {
    client.execute(
        r#"
        UPDATE ingestion_runs
        SET status = $1,
            finished_at = now(),
            records_fetched = $2,
            records_processed = $3,
            records_failed = $4,
            error_message = $5,
            metadata = COALESCE(metadata, '{}'::jsonb) || $6::text::jsonb
        WHERE id = $7
        "#,
        &[
            &status,
            &(totals.copied as i32),
            &(totals.copied as i32),
            &(if error.is_some() { 1 } else { 0 }),
            &error,
            &serde_json::json!({"records_skipped":totals.skipped,"extra_column_rows":totals.extra_columns}).to_string(),
            &run_id,
        ],
    )?;
    Ok(())
}

fn normalize_infolobby(
    client: &mut Client,
    tables: &HashMap<String, String>,
    run_token: &str,
    skip_raw_records: bool,
    tx: &Sender<Msg>,
) -> Result<()> {
    create_infolobby_candidate_tables(client)?;
    client.batch_execute(sql_helpers())?;
    for (file_name, table) in tables {
        insert_sources_for_table(client, file_name, table, run_token)?;
    }
    for sql in entity_candidate_sql(tables) {
        client.batch_execute(&qualify_helpers(&sql))?;
    }
    client.batch_execute("CREATE INDEX ON tmp_infolobby_entity_candidates (key)")?;
    client.batch_execute(
        r#"
        INSERT INTO entities (external_id, canonical_name, display_name, entity_type, country_code, metadata, risk_score)
        SELECT c.key, c.canonical_name, c.display_name, c.entity_type, 'CL', c.metadata, c.risk_score
        FROM (
            SELECT DISTINCT ON (key) key, canonical_name, display_name, entity_type, metadata, risk_score
            FROM tmp_infolobby_entity_candidates
            WHERE key IS NOT NULL AND key <> ''
            ORDER BY key, risk_score DESC
        ) c
        WHERE NOT EXISTS (SELECT 1 FROM entities e WHERE e.external_id = c.key);

        UPDATE entities e
        SET display_name = c.display_name,
            canonical_name = c.canonical_name,
            entity_type = COALESCE(c.entity_type, e.entity_type),
            metadata = COALESCE(e.metadata, '{}'::jsonb) || COALESCE(c.metadata, '{}'::jsonb),
            risk_score = GREATEST(COALESCE(e.risk_score, 0), COALESCE(c.risk_score, 0)),
            updated_at = now()
        FROM (
            SELECT DISTINCT ON (key) key, canonical_name, display_name, entity_type, metadata, risk_score
            FROM tmp_infolobby_entity_candidates
            WHERE key IS NOT NULL AND key <> ''
            ORDER BY key, risk_score DESC
        ) c
        WHERE e.external_id = c.key;

        INSERT INTO entity_identifiers (entity_id, scheme, value, country_code, source_name)
        SELECT e.id, i.scheme, i.value, 'CL', 'infolobby'
        FROM (
            SELECT DISTINCT key, scheme, value
            FROM tmp_infolobby_identifier_candidates
            WHERE value IS NOT NULL AND value <> ''
        ) i
        JOIN entities e ON e.external_id = i.key
        ON CONFLICT (scheme, value, country_code) DO NOTHING;
        "#,
    )?;
    emit(
        tx,
        serde_json::json!({"phase":"normalize entities","stage":"normalize entities"}),
    )?;
    for sql in relationship_candidate_sql(tables) {
        client.batch_execute(&qualify_helpers(&sql))?;
    }
    let inserted = client.execute(
        r#"
        INSERT INTO relationships (
            source_entity_id, target_entity_id, relationship_type, label, weight,
            confidence_score, metadata, source_id
        )
        SELECT src.id, dst.id, r.relationship_type, r.label, 1, 1, r.metadata, sm.source_id
        FROM tmp_infolobby_relationship_candidates r
        JOIN entities src ON src.external_id = r.source_key
        JOIN entities dst ON dst.external_id = r.target_key
        JOIN tmp_infolobby_source_map sm ON sm.file_name = r.file_name AND sm.seq = r.seq
        ON CONFLICT DO NOTHING
        "#,
        &[],
    )?;
    emit(
        tx,
        serde_json::json!({"phase":"normalize relationships","stage":"normalize relationships","inserted_relationships":inserted}),
    )?;
    if !skip_raw_records {
        let raw_records = insert_infolobby_raw_records(client, tables)?;
        emit(
            tx,
            serde_json::json!({"phase":"raw records","stage":"raw records","inserted_raw_records":raw_records}),
        )?;
    }
    Ok(())
}

fn create_infolobby_candidate_tables(client: &mut Client) -> Result<()> {
    client.batch_execute(
        r#"
        CREATE TEMP TABLE tmp_infolobby_entity_candidates (
            key text,
            display_name text,
            canonical_name text,
            entity_type text,
            metadata jsonb,
            risk_score integer default 0
        );
        CREATE TEMP TABLE tmp_infolobby_identifier_candidates (
            key text,
            scheme text,
            value text
        );
        CREATE TEMP TABLE tmp_infolobby_relationship_candidates (
            file_name text,
            seq bigint,
            source_key text,
            target_key text,
            relationship_type text,
            label text,
            metadata jsonb
        );
        CREATE TEMP TABLE tmp_infolobby_source_map (
            file_name text,
            seq bigint,
            source_id integer
        );
        CREATE TEMP TABLE tmp_infolobby_source_rows (
            file_name text,
            seq bigint,
            external_id text
        );
        "#,
    )?;
    Ok(())
}

fn insert_sources_for_table(
    client: &mut Client,
    file_name: &str,
    table: &str,
    run_token: &str,
) -> Result<()> {
    let record_type = record_type(file_name);
    let source_expr = source_external_expr(file_name);
    let sql = format!(
        r#"
        INSERT INTO tmp_infolobby_source_rows (file_name, seq, external_id)
        SELECT '{file_name}', _seq, COALESCE({source_expr}, '{file_name}:row:' || (_seq + 1)::text)
        FROM {table};

        WITH inserted AS (
            INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata)
            SELECT 'infolobby',
                   'public_dataset',
                   '{INFOLOBBY_SOURCE_URL}',
                   external_id,
                   '{INFOLOBBY_LICENSE}',
                   jsonb_build_object(
                       'source_type', 'public_dataset',
                       'license', '{INFOLOBBY_LICENSE}',
                       'record_type', '{record_type}',
                       'file', file_name,
                       'row_number', seq + 1,
                       'run_id', '{run_token}'
                   )
            FROM tmp_infolobby_source_rows
            WHERE file_name = '{file_name}'
            RETURNING id, metadata
        )
        INSERT INTO tmp_infolobby_source_map (file_name, seq, source_id)
        SELECT metadata->>'file', (metadata->>'row_number')::bigint - 1, id
        FROM inserted;
        "#
    );
    client.batch_execute(&qualify_helpers(&sql))?;
    Ok(())
}

fn insert_infolobby_raw_records(
    client: &mut Client,
    tables: &HashMap<String, String>,
) -> Result<u64> {
    let mut total = 0;
    for (file_name, table) in tables {
        let source_expr = source_external_expr(file_name);
        let sql = format!(
            r#"
            INSERT INTO raw_records (source_name, external_id, source_url, payload_hash, payload, status, processed_at)
            SELECT 'infolobby',
                   '{file_name}:' || COALESCE({source_expr}, 'row') || ':' || (_seq + 1)::text,
                   '{INFOLOBBY_SOURCE_URL}',
                   md5('{file_name}:' || (to_jsonb(t) - '_seq')::text),
                   jsonb_build_object('_file', '{file_name}', '_row_number', _seq + 1, 'row', to_jsonb(t) - '_seq'),
                   'processed',
                   now()
            FROM {table} t
            ON CONFLICT (source_name, payload_hash) DO NOTHING;
            "#
        );
        total += client.execute(&qualify_helpers(&sql), &[])?;
    }
    Ok(total)
}

fn qualify_helpers(sql: &str) -> String {
    let mut out = sql.to_string();
    for name in [
        "clean_code",
        "blank",
        "tail",
        "canonical",
        "rut_norm",
        "stable_code",
        "stable_org_person",
        "person_key",
        "org_person_key",
        "organism_key",
        "audience_key",
        "numberish",
        "row_metadata",
    ] {
        out = qualify_helper_name(&out, name);
    }
    out
}

fn qualify_helper_name(sql: &str, name: &str) -> String {
    let needle = format!("{name}(");
    let mut out = String::with_capacity(sql.len() + 64);
    let mut pos = 0;
    while let Some(found) = sql[pos..].find(&needle) {
        let start = pos + found;
        out.push_str(&sql[pos..start]);
        let prev = sql[..start].chars().next_back();
        if matches!(prev, Some(ch) if ch.is_ascii_alphanumeric() || ch == '_' || ch == '.') {
            out.push_str(&needle);
        } else {
            out.push_str("pg_temp.");
            out.push_str(&needle);
        }
        pos = start + needle.len();
    }
    out.push_str(&sql[pos..]);
    out
}

fn record_type(file_name: &str) -> &'static str {
    match file_name {
        "audiencias.csv" => "audience",
        "datosAudiencia.csv" => "audience_details",
        "pasivos.csv" => "passive",
        "asistenciasPasivos.csv" => "passive_attendance",
        "activos.csv" => "active",
        "asistenciasActivos.csv" => "active_attendance",
        "representaciones.csv" => "representation",
        "trabajaPara.csv" => "employment",
        "otrosAsistentes.csv" => "other_attendee",
        "viajes.csv" => "trip",
        "donativos.csv" => "gift",
        _ => "record",
    }
}

fn source_external_expr(file_name: &str) -> &'static str {
    match file_name {
        "audiencias.csv" => "NULLIF(clean_code(\"CodigoURI\"), '')",
        "datosAudiencia.csv" => "NULLIF(clean_code(\"CodigoURI\"), '')",
        "pasivos.csv" => "NULLIF(clean_code(COALESCE(\"codigoPasivo\", \"codigoPersona\")), '')",
        "asistenciasPasivos.csv" => "NULLIF(clean_code(\"codigoAudiencia\"), '')",
        "activos.csv" => "NULLIF(clean_code(tail(\"uriActivo\")), '')",
        "asistenciasActivos.csv" => "NULLIF(clean_code(\"codigoAudiencia\"), '')",
        "representaciones.csv" => "NULLIF(clean_code(\"codigoAudiencia\"), '')",
        "trabajaPara.csv" => "NULLIF(clean_code(\"codigoAudiencia\"), '')",
        "otrosAsistentes.csv" => "NULLIF(clean_code(\"codigoAudiencia\"), '')",
        "viajes.csv" => "NULLIF(clean_code(\"codigoViaje\"), '')",
        "donativos.csv" => "NULLIF(clean_code(\"codigoDonativo\"), '')",
        _ => "NULL",
    }
}

fn entity_candidate_sql(tables: &HashMap<String, String>) -> Vec<String> {
    let mut sql = Vec::new();
    if let Some(table) = tables.get("audiencias.csv") {
        sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT audience_key("CodigoURI", "uriAudiencia"), 'Audiencia InfoLobby ' || clean_code(COALESCE("CodigoURI", tail("uriAudiencia"), 'unknown')),
                   canonical('Audiencia InfoLobby ' || clean_code(COALESCE("CodigoURI", tail("uriAudiencia"), 'unknown'))), 'audience',
                   jsonb_build_object('source_name','infolobby','audience_code', clean_code(COALESCE("CodigoURI", tail("uriAudiencia"), 'unknown'))), 0 FROM {table};"#));
        sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT organism_key("uriOrganismo", "organismo"), COALESCE(blank("organismo"), 'Organismo InfoLobby ' || clean_code(tail("uriOrganismo"))),
                   canonical(COALESCE(blank("organismo"), 'Organismo InfoLobby ' || clean_code(tail("uriOrganismo")))), 'public_body',
                   jsonb_build_object('source_name','infolobby','source_system','infolobby'), 0 FROM {table}
                   WHERE organism_key("uriOrganismo", "organismo") IS NOT NULL;"#));
        sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates SELECT audience_key("CodigoURI", "uriAudiencia"), 'INFOLOBBY_AUDIENCE_CODE', clean_code(COALESCE("CodigoURI", tail("uriAudiencia"))) FROM {table} WHERE clean_code(COALESCE("CodigoURI", tail("uriAudiencia"))) <> '';"#));
        sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates SELECT organism_key("uriOrganismo", "organismo"), 'INFOLOBBY_ORGANISM_CODE', clean_code(tail("uriOrganismo")) FROM {table} WHERE clean_code(tail("uriOrganismo")) <> '';"#));
    }
    if let Some(table) = tables.get("datosAudiencia.csv") {
        sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT audience_key("CodigoURI", "uriAudiencia"), 'Audiencia InfoLobby ' || clean_code(COALESCE("CodigoURI", tail("uriAudiencia"), 'unknown')),
                   canonical('Audiencia InfoLobby ' || clean_code(COALESCE("CodigoURI", tail("uriAudiencia"), 'unknown'))), 'audience',
                   jsonb_strip_nulls(jsonb_build_object('source_name','infolobby','observations', blank("observaciones"), 'description', blank("descripcion"), 'matter', blank("materia"), 'year', blank("anio"), 'quarter', blank("trimestre"), 'cut', blank("CUT"))), 0 FROM {table};"#));
    }
    for (file, code_col, name_col, role_col) in [
        (
            "pasivos.csv",
            "COALESCE(\"codigoPersona\", \"codigoPasivo\")",
            "\"nombrePasivo\"",
            "\"cargo\"",
        ),
        (
            "asistenciasPasivos.csv",
            "\"codigoPasivo\"",
            "\"pasivo\"",
            "\"cargo\"",
        ),
        ("viajes.csv", "\"codigoPasivo\"", "\"pasivo\"", "\"cargo\""),
        (
            "donativos.csv",
            "\"codigoPasivo\"",
            "\"pasivo\"",
            "\"cargo\"",
        ),
    ] {
        if let Some(table) = tables.get(file) {
            sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
                SELECT person_key('passive', {code_col}, {name_col}), COALESCE(blank({name_col}), 'Persona InfoLobby ' || stable_code({code_col}, {name_col})),
                       canonical(COALESCE(blank({name_col}), 'Persona InfoLobby ' || stable_code({code_col}, {name_col}))), 'public_official',
                       jsonb_strip_nulls(jsonb_build_object('source_name','infolobby','role', blank({role_col}))), 0 FROM {table};"#));
            sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates SELECT person_key('passive', {code_col}, {name_col}), 'INFOLOBBY_PASSIVE_CODE', clean_code({code_col}) FROM {table} WHERE clean_code({code_col}) <> '';"#));
        }
    }
    for (file, org_col) in [
        ("pasivos.csv", "\"IDORPortal\""),
        ("asistenciasPasivos.csv", "\"codigoOrganismo\""),
        ("activos.csv", "COALESCE(\"IDORPortal\", \"uriOrganismo\")"),
        ("viajes.csv", "\"IdOrPortal\""),
        ("donativos.csv", "\"IdOrPortal\""),
    ] {
        if let Some(table) = tables.get(file) {
            sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
                SELECT organism_key({org_col}, "organismo"), COALESCE(blank("organismo"), 'Organismo InfoLobby ' || clean_code(tail({org_col}))),
                       canonical(COALESCE(blank("organismo"), 'Organismo InfoLobby ' || clean_code(tail({org_col})))), 'public_body',
                       jsonb_build_object('source_name','infolobby','source_system','infolobby'), 0 FROM {table}
                WHERE organism_key({org_col}, "organismo") IS NOT NULL;"#));
            sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates SELECT organism_key({org_col}, "organismo"), 'INFOLOBBY_ORGANISM_CODE', clean_code(tail({org_col})) FROM {table} WHERE clean_code(tail({org_col})) <> '';"#));
        }
    }
    for file in [
        "asistenciasPasivos.csv",
        "activos.csv",
        "asistenciasActivos.csv",
        "representaciones.csv",
        "trabajaPara.csv",
        "otrosAsistentes.csv",
    ] {
        if let Some(table) = tables.get(file) {
            let code = if file == "activos.csv" {
                "tail(\"uriAudiencia\")"
            } else {
                "\"codigoAudiencia\""
            };
            sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
                SELECT audience_key({code}, NULL), 'Audiencia InfoLobby ' || clean_code(COALESCE({code}, 'unknown')),
                       canonical('Audiencia InfoLobby ' || clean_code(COALESCE({code}, 'unknown'))), 'audience',
                       jsonb_build_object('source_name','infolobby','audience_code', clean_code(COALESCE({code}, 'unknown'))), 0 FROM {table};"#));
            sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates SELECT audience_key({code}, NULL), 'INFOLOBBY_AUDIENCE_CODE', clean_code({code}) FROM {table} WHERE clean_code({code}) <> '';"#));
        }
    }
    if let Some(table) = tables.get("activos.csv") {
        sql.extend(active_entity_statements(
            table,
            "COALESCE(\"CodigoURIPersona\", tail(\"uriActivo\"))",
            "COALESCE(\"nombreActivo\", \"nombre\")",
            "active",
            20,
        ));
        sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates
            SELECT person_key('active', COALESCE("CodigoURIPersona", tail("uriActivo")), COALESCE("nombreActivo", "nombre")), 'INFOLOBBY_ACTIVE_URI', clean_code("uriActivo")
            FROM {table} WHERE clean_code("uriActivo") <> '';"#));
    }
    for file in ["asistenciasActivos.csv", "trabajaPara.csv"] {
        if let Some(table) = tables.get(file) {
            sql.extend(active_entity_statements(
                table,
                "\"codigoActivo\"",
                "\"activo\"",
                "active",
                20,
            ));
        }
    }
    for (file, prefix, code_col, name_col, activity_col) in [
        (
            "asistenciasActivos.csv",
            "represented",
            "\"codigoRepresentado\"",
            "\"representado\"",
            "\"giroRepresentado\"",
        ),
        (
            "asistenciasActivos.csv",
            "lobby_employer",
            "\"uriEmpLobby\"",
            "\"empresaLobby\"",
            "NULL",
        ),
        (
            "representaciones.csv",
            "represented",
            "\"codigoRepresentado\"",
            "\"representado\"",
            "\"giroRepresentado\"",
        ),
        (
            "trabajaPara.csv",
            "lobby_employer",
            "\"codigoEmpLobby\"",
            "\"empresaLobby\"",
            "NULL",
        ),
    ] {
        if let Some(table) = tables.get(file) {
            sql.extend(org_person_statements(
                table,
                prefix,
                code_col,
                name_col,
                activity_col,
            ));
        }
    }
    if let Some(table) = tables.get("otrosAsistentes.csv") {
        sql.extend(active_entity_statements(
            table,
            "\"asistente\"",
            "\"asistente\"",
            "other_attendee",
            0,
        ));
    }
    if let Some(table) = tables.get("viajes.csv") {
        sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT 'infolobby:trip:' || clean_code("codigoViaje"), 'Viaje InfoLobby ' || clean_code("codigoViaje"),
                canonical('Viaje InfoLobby ' || clean_code("codigoViaje")), 'trip',
                jsonb_strip_nulls(jsonb_build_object('source_name','infolobby','destination', blank("destino"), 'cost', numberish("costo"))),
                CASE WHEN numberish("costo") >= 1000000 THEN 35 WHEN numberish("costo") > 0 THEN 15 ELSE 0 END FROM {table};"#));
        sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates
            SELECT 'infolobby:trip:' || clean_code("codigoViaje"), 'INFOLOBBY_TRIP_CODE', clean_code("codigoViaje")
            FROM {table} WHERE clean_code("codigoViaje") <> '';"#));
        sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT org_person_key('trip_financier', financier, financier), COALESCE(blank(financier), 'Entidad InfoLobby ' || stable_org_person(financier, financier)),
                   canonical(COALESCE(blank(financier), 'Entidad InfoLobby ' || stable_org_person(financier, financier))), 'company',
                   jsonb_build_object('source_name','infolobby','source_system','infolobby'), 0
            FROM {table}, LATERAL regexp_split_to_table(COALESCE("financistas", ''), '\s+-\s+') financier
            WHERE blank(trim(both ' -' from financier)) IS NOT NULL;"#));
    }
    if let Some(table) = tables.get("donativos.csv") {
        sql.push(format!(r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT 'infolobby:gift:' || clean_code("codigoDonativo"), 'Donativo InfoLobby ' || clean_code("codigoDonativo"),
                canonical('Donativo InfoLobby ' || clean_code("codigoDonativo")), 'gift',
                jsonb_strip_nulls(jsonb_build_object('source_name','infolobby','description', blank("descripcion"), 'occasion', blank("ocasion"))), 25 FROM {table};"#));
        sql.push(format!(r#"INSERT INTO tmp_infolobby_identifier_candidates
            SELECT 'infolobby:gift:' || clean_code("codigoDonativo"), 'INFOLOBBY_GIFT_CODE', clean_code("codigoDonativo")
            FROM {table} WHERE clean_code("codigoDonativo") <> '';"#));
    }
    sql
}

fn active_entity_statements(
    table: &str,
    code_col: &str,
    name_col: &str,
    prefix: &str,
    risk: i32,
) -> Vec<String> {
    vec![
        format!(
            r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT person_key('{prefix}', {code_col}, {name_col}), COALESCE(blank({name_col}), 'Persona InfoLobby ' || stable_code({code_col}, {name_col})),
                   canonical(COALESCE(blank({name_col}), 'Persona InfoLobby ' || stable_code({code_col}, {name_col}))), 'person',
                   jsonb_build_object('source_name','infolobby'), {risk} FROM {table};"#
        ),
        format!(
            r#"INSERT INTO tmp_infolobby_identifier_candidates SELECT person_key('{prefix}', {code_col}, {name_col}), 'INFOLOBBY_{}_CODE', clean_code({code_col}) FROM {table} WHERE clean_code({code_col}) <> '';"#,
            prefix.to_uppercase()
        ),
    ]
}

fn org_person_statements(
    table: &str,
    prefix: &str,
    code_col: &str,
    name_col: &str,
    activity_col: &str,
) -> Vec<String> {
    let risk = if prefix == "represented" || prefix == "lobby_employer" {
        20
    } else {
        0
    };
    vec![
        format!(
            r#"INSERT INTO tmp_infolobby_entity_candidates
            SELECT org_person_key('{prefix}', {code_col}, {name_col}), COALESCE(blank({name_col}), 'Entidad InfoLobby ' || stable_org_person({code_col}, {name_col})),
                   canonical(COALESCE(blank({name_col}), 'Entidad InfoLobby ' || stable_org_person({code_col}, {name_col}))),
                   CASE WHEN rut_norm({code_col}) IS NOT NULL OR clean_code({code_col}) <> '' THEN 'company' ELSE 'person' END,
                   jsonb_strip_nulls(jsonb_build_object('source_name','infolobby','activity', blank({activity_col}), 'source_system','infolobby')), {risk}
            FROM {table} WHERE org_person_key('{prefix}', {code_col}, {name_col}) IS NOT NULL;"#
        ),
        format!(
            r#"INSERT INTO tmp_infolobby_identifier_candidates
            SELECT org_person_key('{prefix}', {code_col}, {name_col}), 'INFOLOBBY_{}_CODE', clean_code({code_col})
            FROM {table} WHERE clean_code({code_col}) <> '';"#,
            prefix.to_uppercase()
        ),
        format!(
            r#"INSERT INTO tmp_infolobby_identifier_candidates
            SELECT org_person_key('{prefix}', {code_col}, {name_col}), 'CL_RUT', rut_norm({code_col})
            FROM {table} WHERE rut_norm({code_col}) IS NOT NULL;"#
        ),
    ]
}

fn relationship_candidate_sql(tables: &HashMap<String, String>) -> Vec<String> {
    let mut out = Vec::new();
    let mut rel = |file_name: &str,
                   source: &str,
                   target: &str,
                   typ: &str,
                   label: &str,
                   where_clause: &str| {
        if let Some(table) = tables.get(file_name) {
            out.push(format!(r#"INSERT INTO tmp_infolobby_relationship_candidates
                SELECT '{file_name}', _seq, {source}, {target}, '{typ}', '{label}', row_metadata('{file_name}', _seq, to_jsonb(t) - '_seq')
                FROM {table} t WHERE {where_clause};"#));
        }
    };
    rel(
        "audiencias.csv",
        "organism_key(\"uriOrganismo\", \"organismo\")",
        "audience_key(\"CodigoURI\", \"uriAudiencia\")",
        "registered_lobby_audience",
        "Organismo registra audiencia",
        "organism_key(\"uriOrganismo\", \"organismo\") IS NOT NULL",
    );
    rel(
        "pasivos.csv",
        "person_key('passive', COALESCE(\"codigoPersona\", \"codigoPasivo\"), \"nombrePasivo\")",
        "organism_key(\"IDORPortal\", \"organismo\")",
        "holds_public_role",
        "Sujeto pasivo cumple rol publico",
        "organism_key(\"IDORPortal\", \"organismo\") IS NOT NULL",
    );
    rel(
        "asistenciasPasivos.csv",
        "person_key('passive', \"codigoPasivo\", \"pasivo\")",
        "audience_key(\"codigoAudiencia\", NULL)",
        "attended_audience_as_public_official",
        "Autoridad asiste a audiencia",
        "true",
    );
    rel(
        "asistenciasPasivos.csv",
        "person_key('passive', \"codigoPasivo\", \"pasivo\")",
        "organism_key(\"codigoOrganismo\", \"organismo\")",
        "holds_public_role",
        "Autoridad pertenece a organismo",
        "organism_key(\"codigoOrganismo\", \"organismo\") IS NOT NULL",
    );
    rel("activos.csv", "person_key('active', COALESCE(\"CodigoURIPersona\", tail(\"uriActivo\")), COALESCE(\"nombreActivo\", \"nombre\"))", "audience_key(tail(\"uriAudiencia\"), NULL)", "attended_lobby_audience", "Sujeto activo asiste a audiencia", "true");
    rel(
        "activos.csv",
        "organism_key(COALESCE(\"IDORPortal\", \"uriOrganismo\"), \"organismo\")",
        "audience_key(tail(\"uriAudiencia\"), NULL)",
        "registered_lobby_audience",
        "Organismo registra audiencia",
        "organism_key(COALESCE(\"IDORPortal\", \"uriOrganismo\"), \"organismo\") IS NOT NULL",
    );
    rel(
        "asistenciasActivos.csv",
        "person_key('active', \"codigoActivo\", \"activo\")",
        "audience_key(\"codigoAudiencia\", NULL)",
        "attended_lobby_audience",
        "Sujeto activo asiste a audiencia",
        "true",
    );
    rel(
        "asistenciasActivos.csv",
        "person_key('active', \"codigoActivo\", \"activo\")",
        "org_person_key('represented', \"codigoRepresentado\", \"representado\")",
        "represents_in_audience",
        "Sujeto activo representa interes",
        "org_person_key('represented', \"codigoRepresentado\", \"representado\") IS NOT NULL",
    );
    rel(
        "asistenciasActivos.csv",
        "org_person_key('represented', \"codigoRepresentado\", \"representado\")",
        "audience_key(\"codigoAudiencia\", NULL)",
        "represented_in_audience",
        "Interes representado en audiencia",
        "org_person_key('represented', \"codigoRepresentado\", \"representado\") IS NOT NULL",
    );
    rel(
        "asistenciasActivos.csv",
        "person_key('active', \"codigoActivo\", \"activo\")",
        "org_person_key('lobby_employer', \"uriEmpLobby\", \"empresaLobby\")",
        "works_for",
        "Sujeto activo trabaja para empleador",
        "org_person_key('lobby_employer', \"uriEmpLobby\", \"empresaLobby\") IS NOT NULL",
    );
    rel(
        "representaciones.csv",
        "org_person_key('represented', \"codigoRepresentado\", \"representado\")",
        "audience_key(\"codigoAudiencia\", NULL)",
        "represented_in_audience",
        "Interes representado en audiencia",
        "org_person_key('represented', \"codigoRepresentado\", \"representado\") IS NOT NULL",
    );
    rel(
        "trabajaPara.csv",
        "person_key('active', \"codigoActivo\", \"activo\")",
        "audience_key(\"codigoAudiencia\", NULL)",
        "attended_lobby_audience",
        "Sujeto activo asiste a audiencia",
        "true",
    );
    rel(
        "trabajaPara.csv",
        "person_key('active', \"codigoActivo\", \"activo\")",
        "org_person_key('lobby_employer', \"codigoEmpLobby\", \"empresaLobby\")",
        "works_for",
        "Sujeto activo trabaja para empleador",
        "org_person_key('lobby_employer', \"codigoEmpLobby\", \"empresaLobby\") IS NOT NULL",
    );
    rel(
        "otrosAsistentes.csv",
        "person_key('other_attendee', \"asistente\", \"asistente\")",
        "audience_key(\"codigoAudiencia\", NULL)",
        "attended_audience_other",
        "Asistente no oficial a audiencia",
        "true",
    );
    rel(
        "viajes.csv",
        "person_key('passive', \"codigoPasivo\", \"pasivo\")",
        "'infolobby:trip:' || clean_code(\"codigoViaje\")",
        "took_trip",
        "Autoridad registra viaje",
        "true",
    );
    rel(
        "viajes.csv",
        "person_key('passive', \"codigoPasivo\", \"pasivo\")",
        "organism_key(\"IdOrPortal\", \"organismo\")",
        "holds_public_role",
        "Autoridad pertenece a organismo",
        "organism_key(\"IdOrPortal\", \"organismo\") IS NOT NULL",
    );
    rel(
        "donativos.csv",
        "person_key('passive', \"codigoPasivo\", \"pasivo\")",
        "'infolobby:gift:' || clean_code(\"codigoDonativo\")",
        "received_gift",
        "Autoridad recibe donativo",
        "true",
    );
    rel(
        "donativos.csv",
        "person_key('passive', \"codigoPasivo\", \"pasivo\")",
        "organism_key(\"IdOrPortal\", \"organismo\")",
        "holds_public_role",
        "Autoridad pertenece a organismo",
        "organism_key(\"IdOrPortal\", \"organismo\") IS NOT NULL",
    );
    if let Some(table) = tables.get("viajes.csv") {
        out.push(format!(r#"INSERT INTO tmp_infolobby_relationship_candidates
            SELECT 'viajes.csv', _seq, org_person_key('trip_financier', financier, financier), 'infolobby:trip:' || clean_code("codigoViaje"),
                   'financed_trip', 'Entidad financia viaje', row_metadata('viajes.csv', _seq, to_jsonb(t) - '_seq')
            FROM {table} t, LATERAL regexp_split_to_table(COALESCE("financistas", ''), '\s+-\s+') financier
            WHERE blank(trim(both ' -' from financier)) IS NOT NULL;"#));
    }
    out
}

fn sql_helpers() -> &'static str {
    r#"
    CREATE OR REPLACE FUNCTION pg_temp.clean_code(value text) RETURNS text AS $$
        SELECT btrim(replace(COALESCE(value, ''), chr(9), ''))
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.blank(value text) RETURNS text AS $$
        SELECT NULLIF(pg_temp.clean_code(value), '')
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.tail(value text) RETURNS text AS $$
        SELECT CASE WHEN pg_temp.clean_code(value) LIKE '%/%' THEN regexp_replace(pg_temp.clean_code(value), '^.*/', '') ELSE pg_temp.clean_code(value) END
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.canonical(value text) RETURNS text AS $$
        SELECT lower(regexp_replace(btrim(COALESCE(value, '')), '\s+', ' ', 'g'))
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.rut_norm(value text) RETURNS text AS $$
        SELECT CASE
            WHEN length(regexp_replace(COALESCE(value, ''), '[^0-9kK]', '', 'g')) >= 2
            THEN COALESCE(NULLIF(ltrim(left(regexp_replace(COALESCE(value, ''), '[^0-9kK]', '', 'g'), -1), '0'), ''), '0') || '-' || upper(right(regexp_replace(COALESCE(value, ''), '[^0-9kK]', '', 'g'), 1))
            ELSE NULL
        END
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.stable_code(code text, name text) RETURNS text AS $$
        SELECT COALESCE(NULLIF(pg_temp.clean_code(code), ''), NULLIF(pg_temp.canonical(name), ''), 'unknown')
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.stable_org_person(code text, name text) RETURNS text AS $$
        SELECT COALESCE(pg_temp.rut_norm(code), NULLIF(pg_temp.clean_code(code), ''), NULLIF(pg_temp.canonical(name), ''))
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.person_key(prefix text, code text, name text) RETURNS text AS $$
        SELECT 'infolobby:' || prefix || ':' || pg_temp.stable_code(code, name)
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.org_person_key(prefix text, code text, name text) RETURNS text AS $$
        SELECT CASE WHEN pg_temp.stable_org_person(code, name) IS NULL THEN NULL ELSE 'infolobby:' || prefix || ':' || pg_temp.stable_org_person(code, name) END
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.organism_key(code text, name text) RETURNS text AS $$
        SELECT CASE
            WHEN NULLIF(pg_temp.clean_code(pg_temp.tail(code)), '') IS NULL AND NULLIF(pg_temp.canonical(name), '') IS NULL THEN NULL
            ELSE 'infolobby:organism:' || COALESCE(NULLIF(pg_temp.clean_code(pg_temp.tail(code)), ''), pg_temp.canonical(name))
        END
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.audience_key(code text, uri text) RETURNS text AS $$
        SELECT 'infolobby:audience:' || COALESCE(NULLIF(pg_temp.clean_code(code), ''), NULLIF(pg_temp.clean_code(pg_temp.tail(uri)), ''), 'unknown')
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.numberish(value text) RETURNS numeric AS $$
        SELECT CASE WHEN pg_temp.clean_code(value) ~ '^[0-9\.,]+$' THEN replace(replace(pg_temp.clean_code(value), '.', ''), ',', '.')::numeric ELSE NULL END
    $$ LANGUAGE sql IMMUTABLE;
    CREATE OR REPLACE FUNCTION pg_temp.row_metadata(file_name text, seq bigint, row_data jsonb) RETURNS jsonb AS $$
        SELECT jsonb_build_object('file', file_name, 'row_number', seq + 1) || row_data
    $$ LANGUAGE sql IMMUTABLE;
    "#
}

// ==================== CHILECOMPRA NATIVO EN RUST ====================

const CHILECOMPRA_LICENSE: &str = "Mercado Publico / ChileCompra";
const CHILE_LICITACIONES_URL: &str = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";
const CHILE_ORDENES_COMPRA_URL: &str = "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json";
const CHILE_ORDEN_COMPRA_URL: &str = "https://api.mercadopublico.cl/servicios/v1/publico/OrdenCompra.json";

struct ChileCompraOpts {
    db_url: String,
    ticket: String,
    daily_budget: u64,
    hydration_budget: u64,
    discover_days_back: u64,
    kind: String,
    estado: Option<String>,
    night_start: String,
    night_end: String,
    sleep_seconds: f64,
    once: bool,
    skip_night_window: bool,
    backfill_from: Option<String>,
    backfill_to: Option<String>,
    sleep_between: f64,
    max_consecutive_errors: u32,
}

#[derive(Default, Clone)]
struct PipelineStats {
    discovered: u64,
    queued: u64,
    processed: u64,
    failed: u64,
    skipped: u64,
    requests: u64,
}

fn parse_time_hhmm(s: &str) -> u32 {
    let mut parts = s.splitn(2, ':');
    let h: u32 = parts.next().and_then(|p| p.trim().parse().ok()).unwrap_or(0);
    let m: u32 = parts.next().and_then(|p| p.trim().parse().ok()).unwrap_or(0);
    h * 60 + m
}

fn current_minutes_santiago() -> u32 {
    // Approximation: Santiago UTC-4 (covers both CLST and CLT)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let local = now - 4 * 3600;
    let mins = ((local % 86400 + 86400) % 86400) / 60;
    mins as u32
}

fn today_santiago_ddmmyyyy() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let local = now - 4 * 3600;
    // Days since epoch
    let days = (local / 86400) as u32;
    // Gregorian calendar calculation from epoch (1970-01-01)
    let (y, m, d) = days_to_ymd(days);
    format!("{:02}{:02}{:04}", d, m, y)
}

fn today_santiago_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let local = now - 4 * 3600;
    let days = (local / 86400) as u32;
    let (y, m, d) = days_to_ymd(days);
    format!("{:04}-{:02}-{:02}", y, m, d)
}

fn date_from_iso(s: &str) -> Option<u32> {
    // Returns days-since-epoch for YYYY-MM-DD string
    let parts: Vec<&str> = s.splitn(3, '-').collect();
    if parts.len() != 3 { return None; }
    let y: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    let d: u32 = parts[2].parse().ok()?;
    Some(ymd_to_days(y, m, d))
}

fn days_to_ymd(days: u32) -> (u32, u32, u32) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y } as u32;
    (y, m, d)
}

fn ymd_to_days(y: u32, m: u32, d: u32) -> u32 {
    // Same algorithm, inverse
    let y = if m <= 2 { y as i64 - 1 } else { y as i64 };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u32;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era * 146097 + doe as i64 - 719468) as u32
}

fn is_night_window_chile(night_start: &str, night_end: &str) -> bool {
    return true;
}

fn seconds_until_night_start_chile(night_start: &str) -> u64 {
    let current = current_minutes_santiago() as i64;
    let start = parse_time_hhmm(night_start) as i64;
    let diff = if start > current { start - current } else { 1440 - current + start };
    (diff * 60) as u64
}

fn ticket_sha256(ticket: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(ticket.as_bytes());
    hex::encode(h.finalize())
}

fn consume_quota(client: &mut postgres::Client, ticket: &str, daily_budget: u64) -> Result<bool> {
    let hash = ticket_sha256(ticket);
    let today = today_santiago_iso();
    let row = client.query_opt(
        "SELECT id, request_count, limit_count FROM api_usage_counters \
         WHERE source_name = 'chilecompra' AND ticket_hash = $1 AND usage_date = $2::date",
        &[&hash, &today],
    )?;
    match row {
        Some(r) => {
            let id: i32 = r.get(0);
            let count: i32 = r.get(1);
            let limit: i32 = r.get(2);
            let budget = daily_budget as i32;
            if count >= limit.min(budget) {
                return Ok(false);
            }
            client.execute(
                "UPDATE api_usage_counters SET request_count = request_count + 1, limit_count = $1, updated_at = now() WHERE id = $2",
                &[&budget, &id],
            )?;
            Ok(true)
        }
        None => {
            let budget = daily_budget as i32;
            client.execute(
                "INSERT INTO api_usage_counters (source_name, ticket_hash, usage_date, request_count, limit_count) \
                 VALUES ('chilecompra', $1, $2::date, 1, $3) \
                 ON CONFLICT (source_name, ticket_hash, usage_date) DO UPDATE SET request_count = api_usage_counters.request_count + 1, updated_at = now()",
                &[&hash, &today, &budget],
            )?;
            Ok(true)
        }
    }
}

fn refund_quota(client: &mut postgres::Client, ticket: &str) -> Result<()> {
    let hash = ticket_sha256(ticket);
    let today = today_santiago_iso();
    client.execute(
        "UPDATE api_usage_counters SET request_count = GREATEST(0, request_count - 1), updated_at = now() \
         WHERE source_name = 'chilecompra' AND ticket_hash = $1 AND usage_date = $2::date",
        &[&hash, &today],
    )?;
    Ok(())
}

fn quota_available(client: &mut postgres::Client, ticket: &str, daily_budget: u64) -> Result<bool> {
    let hash = ticket_sha256(ticket);
    let today = today_santiago_iso();
    let row = client.query_opt(
        "SELECT request_count, limit_count FROM api_usage_counters          WHERE source_name = 'chilecompra' AND ticket_hash = $1 AND usage_date = $2::date",
        &[&hash, &today],
    )?;
    match row {
        Some(r) => {
            let count: i32 = r.get(0);
            let limit: i32 = r.get(1);
            Ok(count < limit.min(daily_budget as i32))
        }
        None => Ok(true),
    }
}

fn chile_get_json(url: &str, _ticket: &str) -> Result<serde_json::Value> {
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(30))
        .build();
    let mut last_err = String::new();
    for attempt in 0..4u32 {
        match agent.get(url).call() {
            Ok(resp) => {
                let body = resp.into_string()?;
                return Ok(serde_json::from_str(&body)?);
            }
            Err(ureq::Error::Status(code, _)) if [408, 429, 500, 502, 503, 504].contains(&code) => {
                last_err = format!("HTTP {code}");
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_secs_f64(1.5 * 2f64.powi(attempt as i32)));
                    continue;
                }
            }
            Err(e) => {
                last_err = e.to_string();
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_secs_f64(1.5 * 2f64.powi(attempt as i32)));
                    continue;
                }
            }
        }
    }
    anyhow::bail!("ChileCompra API falló tras 4 intentos: {last_err}")
}

fn discover_one_kind(
    client: &mut postgres::Client,
    ticket: &str,
    fecha: &str,
    kind: &str,
    estado: Option<&str>,
    daily_budget: u64,
) -> Result<(u64, u64)> {
    let (base_url, record_type) = if kind == "licitaciones" {
        (CHILE_LICITACIONES_URL, "tender")
    } else {
        (CHILE_ORDENES_COMPRA_URL, "purchase_order")
    };
    if !consume_quota(client, ticket, daily_budget)? {
        return Ok((0, 0));
    }
    let mut url = format!("{base_url}?ticket={ticket}&fecha={fecha}");
    if let Some(e) = estado {
        url.push_str(&format!("&estado={e}"));
    }
    let payload = chile_get_json(&url, ticket)?;
    let empty = vec![];
    let listado = payload.get("Listado")
        .or_else(|| payload.get("listado"))
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);
    let mut discovered = 0u64;
    let mut queued = 0u64;
    for item in listado {
        let external_id = if record_type == "tender" {
            item.get("CodigoExterno").or_else(|| item.get("Codigo"))
        } else {
            item.get("Codigo")
        }
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
        if external_id.is_empty() {
            continue;
        }
        discovered += 1;
        let priority = chile_priority(item);
        let meta = serde_json::json!({
            "status_code": item.get("CodigoEstado"),
            "status": item.get("Estado"),
            "name": item.get("Nombre"),
            "estimated_amount": item.get("MontoEstimado").or_else(|| item.get("Total")),
            "buyer": item.get("Comprador").and_then(|b| b.get("NombreOrganismo")),
            "discovery": true,
        });
        let safe_url = format!("{base_url}?ticket=***&fecha={fecha}");
        let inserted = client.execute(
            "INSERT INTO ingestion_queue (source_name, record_type, external_id, status, priority, source_url, metadata) \
             VALUES ('chilecompra', $1, $2, 'queued', $3, $4, $5::jsonb) \
             ON CONFLICT (source_name, record_type, external_id) DO UPDATE \
             SET metadata = COALESCE(ingestion_queue.metadata, '{}'::jsonb) || EXCLUDED.metadata, \
                 status = CASE WHEN ingestion_queue.status IN ('failed','skipped') THEN 'queued' ELSE ingestion_queue.status END \
             RETURNING (xmax = 0) AS inserted",
            &[&record_type, &external_id, &priority, &safe_url, &meta.to_string()],
        )?;
        if inserted > 0 {
            queued += 1;
        }
    }
    Ok((discovered, queued))
}

fn chile_priority(item: &serde_json::Value) -> i32 {
    let status = item.get("Estado").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let status_code = item.get("CodigoEstado").and_then(|v| v.as_i64()).unwrap_or(0);
    let amount = item.get("MontoEstimado")
        .or_else(|| item.get("Total"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let buyer = item.get("Comprador")
        .and_then(|b| b.get("NombreOrganismo"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let mut priority = 100i32;
    if status.contains("adjudic") || status_code == 8 { priority -= 40; }
    if amount >= 1_000_000_000.0 { priority -= 30; }
    else if amount >= 100_000_000.0 { priority -= 15; }
    for term in ["municipalidad", "salud", "hospital", "obras publicas", "gobierno regional"] {
        if buyer.contains(term) { priority -= 10; break; }
    }
    priority.max(1)
}

fn hydrate_queue(
    client: &mut postgres::Client,
    ticket: &str,
    budget: u64,
    daily_budget: u64,
    sleep_seconds: f64,
    tx: &Sender<Msg>,
    stats: &mut PipelineStats,
) -> Result<()> {
    for _ in 0..budget {
        let item = client.query_opt(
            "SELECT id, record_type, external_id, source_url, attempts FROM ingestion_queue \
             WHERE source_name = 'chilecompra' AND status = 'queued' \
             AND (next_attempt_at IS NULL OR next_attempt_at <= now()) \
             ORDER BY priority ASC, discovered_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED",
            &[],
        )?;
        let Some(item) = item else { break };
        let item_id: i32 = item.get(0);
        let record_type: String = item.get(1);
        let external_id: String = item.get(2);
        let source_url: Option<String> = item.get(3);
        let attempts: i32 = item.get(4);

        if !consume_quota(client, ticket, daily_budget)? {
            break;
        }
        client.execute(
            "UPDATE ingestion_queue SET status='processing', last_attempt_at=now(), attempts=attempts+1 WHERE id=$1",
            &[&item_id],
        )?;

        let fetch_url = if record_type == "purchase_order" {
            format!("{CHILE_ORDEN_COMPRA_URL}?ticket={ticket}&codigo={external_id}")
        } else {
            format!("{CHILE_LICITACIONES_URL}?ticket={ticket}&codigo={external_id}")
        };
        match chile_get_json(&fetch_url, ticket) {
            Ok(payload) => {
                let empty = vec![];
                let listado = payload.get("Listado")
                    .or_else(|| payload.get("listado"))
                    .and_then(|v| v.as_array())
                    .unwrap_or(&empty);
                if listado.is_empty() {
                    client.execute(
                        "UPDATE ingestion_queue SET status='skipped', error_message='API returned no records' WHERE id=$1",
                        &[&item_id],
                    )?;
                    stats.skipped += 1;
                } else {
                    let safe_url = source_url.as_deref().unwrap_or("https://api.mercadopublico.cl/");
                    for record in listado {
                        normalize_and_store_chile(client, record, &record_type, safe_url)?;
                    }
                    client.execute(
                        "UPDATE ingestion_queue SET status='processed', error_message=NULL WHERE id=$1",
                        &[&item_id],
                    )?;
                    stats.processed += 1;
                }
            }
            Err(e) => {
                let next_mins = 2i32.pow((attempts + 1).min(6) as u32).min(60);
                client.execute(
                    "UPDATE ingestion_queue SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'queued' END, \
                     error_message=$1, next_attempt_at=now() + ($2 || ' minutes')::interval WHERE id=$3",
                    &[&e.to_string(), &next_mins.to_string(), &item_id],
                )?;
                stats.failed += 1;
                refund_quota(client, ticket)?;
            }
        }
        stats.requests += 1;
        let _ = tx.send(Msg::Progress {
            task: TaskKind::Chile,
            payload: serde_json::json!({
                "phase": "hydrating",
                "status": "running",
                "processed": stats.processed,
                "failed": stats.failed,
                "skipped": stats.skipped,
                "discovered": stats.discovered,
                "queued": stats.queued,
                "requests": stats.requests,
            }),
        });
        if sleep_seconds > 0.0 {
            std::thread::sleep(std::time::Duration::from_secs_f64(sleep_seconds));
        }
    }
    Ok(())
}

fn normalize_and_store_chile(
    client: &mut postgres::Client,
    record: &serde_json::Value,
    record_type: &str,
    source_url: &str,
) -> Result<()> {
    let is_po = record_type == "purchase_order"
        || record.get("Proveedor").is_some()
        || record.get("TotalNeto").is_some()
        || record.get("CodigoLicitacion").is_some();

    if is_po {
        normalize_purchase_order(client, record, source_url)?;
    } else {
        normalize_tender(client, record, source_url)?;
    }
    Ok(())
}

fn normalize_tender(client: &mut postgres::Client, p: &serde_json::Value, source_url: &str) -> Result<()> {
    let code = p.get("CodigoExterno").or_else(|| p.get("Codigo")).and_then(|v| v.as_str()).unwrap_or("").to_string();
    let tender_key = format!("tender:{code}");
    let tender_name = p.get("Nombre").and_then(|v| v.as_str()).unwrap_or(&format!("Licitacion {code}")).to_string();
    let buyer = p.get("Comprador").cloned().unwrap_or_default();
    let amount = p.get("MontoEstimado").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let risk = chile_risk_score(amount);

    let source_id = upsert_chile_source(client, &code, source_url, "tender")?;
    let tender_id = upsert_chile_entity(client, &tender_key, &tender_name, "tender", risk,
        &serde_json::json!({"source_name":"chilecompra","status":p.get("Estado"),"status_code":p.get("CodigoEstado"),"estimated_amount":p.get("MontoEstimado"),"currency":p.get("Moneda")}),
        &[("CHILECOMPRA_TENDER_CODE".to_string(), code.clone())])?;
    let buyer_id = upsert_chile_buyer(client, &buyer)?;
    insert_chile_rel(client, buyer_id, tender_id, "issued_by", "Organismo comprador publica licitacion", source_id)?;

    // Suppliers from item adjudications
    let items = p.get("Items").and_then(|i| i.get("Listado")).and_then(|v| v.as_array());
    if let Some(items) = items {
        for item in items {
            let adj = item.get("Adjudicacion").cloned().unwrap_or_default();
            let sup_name = adj.get("NombreProveedor").and_then(|v| v.as_str());
            let sup_rut = normalize_rut_chile(adj.get("RutProveedor").and_then(|v| v.as_str()).unwrap_or(""));
            if sup_name.is_none() && sup_rut.is_none() { continue; }
            let sup_key = format!("supplier:{}", sup_rut.as_deref().unwrap_or_else(|| sup_name.unwrap_or("unknown")));
            let sup_name_str = sup_name.unwrap_or("Proveedor sin nombre").to_string();
            let sup_id = upsert_chile_entity(client, &sup_key, &sup_name_str, "company", 25,
                &serde_json::json!({"source_name":"chilecompra"}),
                &sup_rut.iter().map(|r| ("CL_RUT".to_string(), r.clone())).collect::<Vec<_>>())?;
            insert_chile_rel(client, tender_id, sup_id, "awarded_to", "Linea adjudicada a proveedor",
                source_id)?;
        }
    }
    Ok(())
}

fn normalize_purchase_order(client: &mut postgres::Client, p: &serde_json::Value, source_url: &str) -> Result<()> {
    let code = p.get("Codigo").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let po_key = format!("purchase_order:{code}");
    let po_name = p.get("Nombre").and_then(|v| v.as_str()).unwrap_or(&format!("OC {code}")).to_string();
    let buyer = p.get("Comprador").cloned().unwrap_or_default();
    let supplier = p.get("Proveedor").cloned().unwrap_or_default();
    let amount = p.get("Total").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let risk = chile_risk_score(amount);

    let source_id = upsert_chile_source(client, &code, source_url, "purchase_order")?;
    let po_id = upsert_chile_entity(client, &po_key, &po_name, "purchase_order", risk,
        &serde_json::json!({"source_name":"chilecompra","status_code":p.get("CodigoEstado"),"total":p.get("Total"),"currency":p.get("TipoMoneda"),"tender_code":p.get("CodigoLicitacion")}),
        &[("CHILECOMPRA_OC_CODE".to_string(), code.clone())])?;
    let buyer_id = upsert_chile_buyer(client, &buyer)?;
    let sup_rut = normalize_rut_chile(supplier.get("RutSucursal").and_then(|v| v.as_str()).unwrap_or(""));
    let sup_name = supplier.get("Nombre").and_then(|v| v.as_str()).unwrap_or("Proveedor").to_string();
    let sup_key = format!("supplier:{}", sup_rut.as_deref().unwrap_or(&sup_name));
    let sup_id = upsert_chile_entity(client, &sup_key, &sup_name, "company", 25,
        &serde_json::json!({"source_name":"chilecompra","commune":supplier.get("Comuna"),"region":supplier.get("Region")}),
        &sup_rut.iter().map(|r| ("CL_RUT".to_string(), r.clone())).collect::<Vec<_>>())?;
    insert_chile_rel(client, po_id, buyer_id, "issued_by", "Orden emitida por organismo", source_id)?;
    insert_chile_rel(client, po_id, sup_id, "awarded_to", "Orden de compra a proveedor", source_id)?;
    insert_chile_rel(client, buyer_id, sup_id, "purchased_from", "Organismo compra a proveedor", source_id)?;

    // Link to tender if referenced
    if let Some(tender_code) = p.get("CodigoLicitacion").and_then(|v| v.as_str()) {
        if !tender_code.is_empty() {
            let tender_key = format!("tender:{tender_code}");
            let tender_name = format!("Licitacion {tender_code}");
            let tender_id = upsert_chile_entity(client, &tender_key, &tender_name, "tender", 0,
                &serde_json::json!({"source_name":"chilecompra"}),
                &[("CHILECOMPRA_TENDER_CODE".to_string(), tender_code.to_string())])?;
            insert_chile_rel(client, po_id, tender_id, "related_to", "Orden asociada a licitacion", source_id)?;
        }
    }
    Ok(())
}

fn upsert_chile_buyer(client: &mut postgres::Client, buyer: &serde_json::Value) -> Result<i32> {
    let rut = normalize_rut_chile(buyer.get("RutUnidad").and_then(|v| v.as_str()).unwrap_or(""));
    let organism_code = buyer.get("CodigoOrganismo").and_then(|v| v.as_str()).map(|s| s.to_string());
    let name = buyer.get("NombreOrganismo").or_else(|| buyer.get("NombreUnidad"))
        .and_then(|v| v.as_str()).unwrap_or("Organismo comprador").to_string();
    let key = format!("buyer:{}", rut.as_deref().or(organism_code.as_deref()).unwrap_or(&name));
    let mut identifiers = Vec::new();
    if let Some(r) = &rut { identifiers.push(("CL_RUT".to_string(), r.clone())); }
    if let Some(c) = &organism_code { identifiers.push(("CHILECOMPRA_ORGANISM_CODE".to_string(), c.clone())); }
    upsert_chile_entity(client, &key, &name, "public_body", 0,
        &serde_json::json!({"source_name":"chilecompra","unit_name":buyer.get("NombreUnidad"),"commune":buyer.get("ComunaUnidad")}),
        &identifiers)
}

fn upsert_chile_entity(
    client: &mut postgres::Client,
    external_id: &str,
    display_name: &str,
    entity_type: &str,
    risk_score: i32,
    metadata: &serde_json::Value,
    identifiers: &[(String, String)],
) -> Result<i32> {
    let canonical = display_name.to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ");
    let row = client.query_one(
        r#"
        INSERT INTO entities (external_id, canonical_name, display_name, entity_type, country_code, metadata, risk_score)
        VALUES ($1, $2, $3, $4, 'CL', $5::jsonb, $6)
        ON CONFLICT (external_id) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            entity_type = COALESCE(EXCLUDED.entity_type, entities.entity_type),
            metadata = COALESCE(entities.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            risk_score = GREATEST(COALESCE(entities.risk_score, 0), COALESCE(EXCLUDED.risk_score, 0)),
            updated_at = now()
        RETURNING id
        "#,
        &[&external_id, &canonical, &display_name, &entity_type, &metadata.to_string(), &risk_score],
    )?;
    let entity_id: i32 = row.get(0);
    for (scheme, value) in identifiers {
        if !value.is_empty() {
            client.execute(
                "INSERT INTO entity_identifiers (entity_id, scheme, value, country_code, source_name) \
                 VALUES ($1, $2, $3, 'CL', 'chilecompra') ON CONFLICT (scheme, value, country_code) DO NOTHING",
                &[&entity_id, &scheme.as_str(), &value.as_str()],
            )?;
        }
    }
    Ok(entity_id)
}

fn upsert_chile_source(client: &mut postgres::Client, external_id: &str, source_url: &str, record_type: &str) -> Result<i32> {
    let meta = serde_json::json!({"source_type":"public_api","license":CHILECOMPRA_LICENSE,"record_type":record_type,"source_name":"chilecompra"});
    let row = client.query_one(
        "INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata) \
         VALUES ('chilecompra', 'public_api', $1, $2, $3, $4::jsonb) \
         RETURNING id",
        &[&source_url, &external_id, &CHILECOMPRA_LICENSE, &meta.to_string()],
    )?;
    Ok(row.get(0))
}

fn insert_chile_rel(
    client: &mut postgres::Client,
    src_id: i32,
    dst_id: i32,
    rel_type: &str,
    label: &str,
    source_id: i32,
) -> Result<()> {
    let meta = serde_json::json!({"source_name":"chilecompra"});
    client.execute(
        "INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type, label, weight, confidence_score, metadata, source_id) \
         VALUES ($1, $2, $3, $4, 1, 1, $5::jsonb, $6) ON CONFLICT DO NOTHING",
        &[&src_id, &dst_id, &rel_type, &label, &meta.to_string(), &source_id],
    )?;
    Ok(())
}

fn chile_risk_score(amount: f64) -> i32 {
    if amount >= 1_000_000_000.0 { 70 }
    else if amount >= 100_000_000.0 { 45 }
    else if amount > 0.0 { 20 }
    else { 0 }
}

fn normalize_rut_chile(value: &str) -> Option<String> {
    let digits: String = value.chars().filter(|c| c.is_ascii_digit() || *c == 'k' || *c == 'K').collect();
    if digits.len() < 2 { return None; }
    let (body, dv) = digits.split_at(digits.len() - 1);
    let body = body.trim_start_matches('0');
    let dv = dv.to_uppercase();
    if body.is_empty() {
        Some(format!("0-{dv}"))
    } else {
        Some(format!("{body}-{dv}"))
    }
}

fn run_chilecompra_worker(opts: ChileCompraOpts, tx: Sender<Msg>) -> Result<()> {
    let mut client = postgres::Client::connect(&opts.db_url, postgres::NoTls)?;
    client.execute("SET statement_timeout = 0", &[])?;

    // Backfill mode: iterate dates
    if opts.backfill_from.is_some() || opts.backfill_to.is_some() {
        let start_days = opts.backfill_from.as_deref()
            .and_then(|s| date_from_iso(s))
            .unwrap_or_else(|| {
                // 2020-01-01 default
                ymd_to_days(2020, 1, 1)
            });
        let end_days = opts.backfill_to.as_deref()
            .and_then(|s| date_from_iso(s))
            .unwrap_or_else(|| {
                let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
                let local = now - 4 * 3600;
                (local / 86400) as u32
            });

        let mut current = start_days;
        let mut consecutive_errors = 0u32;
        while current <= end_days {
            let (y, m, d) = days_to_ymd(current);
            let fecha = format!("{:02}{:02}{:04}", d, m, y);
            let date_iso = format!("{:04}-{:02}-{:02}", y, m, d);

            if !quota_available(&mut client, &opts.ticket, opts.daily_budget)? {
                let _ = tx.send(Msg::Progress {
                    task: TaskKind::Chile,
                    payload: serde_json::json!({"phase":"done","status":"completed",
                        "message":format!("budget agotado; reanudar con --backfill-from={date_iso}")}),
                });
                return Ok(());
            }

            let mut stats = PipelineStats::default();
            let kinds: Vec<&str> = if opts.kind == "all" { vec!["licitaciones", "ordenes_compra"] } else { vec![opts.kind.as_str()] };
            let mut had_error = false;
            for kind in &kinds {
                match discover_one_kind(&mut client, &opts.ticket, &fecha, kind, opts.estado.as_deref(), opts.daily_budget) {
                    Ok((disc, q)) => { stats.discovered += disc; stats.queued += q; }
                    Err(e) => {
                        had_error = true;
                        let _ = tx.send(Msg::Progress {
                            task: TaskKind::Chile,
                            payload: serde_json::json!({"phase":"backfill","status":"running","message":format!("{date_iso} {kind}: {e}")}),
                        });
                    }
                }
            }
            if had_error {
                consecutive_errors += 1;
                if consecutive_errors >= opts.max_consecutive_errors {
                    let _ = tx.send(Msg::Progress {
                        task: TaskKind::Chile,
                        payload: serde_json::json!({"phase":"done","status":"error",
                            "message":format!("{consecutive_errors} errores consecutivos; reanudar con --backfill-from={date_iso}")}),
                    });
                    return Ok(());
                }
            } else {
                consecutive_errors = 0;
            }
            let _ = tx.send(Msg::Progress {
                task: TaskKind::Chile,
                payload: serde_json::json!({"phase":"backfill","status":"running","message":format!("{date_iso}: {}/{} descubiertos/cola",stats.discovered,stats.queued),"discovered":stats.discovered,"queued":stats.queued}),
            });
            let _ = hydrate_queue(&mut client, &opts.ticket, opts.hydration_budget, opts.daily_budget, opts.sleep_seconds, &tx, &mut stats);
            if opts.sleep_between > 0.0 {
                std::thread::sleep(std::time::Duration::from_secs_f64(opts.sleep_between));
            }
            current += 1;
        }
        let _ = tx.send(Msg::Progress {
            task: TaskKind::Chile,
            payload: serde_json::json!({"phase":"done","status":"completed","message":"backfill completado"}),
        });
        return Ok(());
    }

    // Daemon mode: cycle
    let mut cycle = 0u64;
    let mut total = PipelineStats::default();
    loop {
        let in_window = is_night_window_chile(&opts.night_start, &opts.night_end);
        if !in_window && !opts.skip_night_window {
            let wait = seconds_until_night_start_chile(&opts.night_start).min(60);
            let _ = tx.send(Msg::Progress {
                task: TaskKind::Chile,
                payload: serde_json::json!({"phase":"waiting","status":"waiting",
                    "message":format!("fuera de ventana {}-{}; reintento en {}s (--skip-night-window para forzar)",opts.night_start,opts.night_end,wait)}),
            });
            if opts.once {
                let _ = tx.send(Msg::Progress {
                    task: TaskKind::Chile,
                    payload: serde_json::json!({"phase":"done","status":"done","message":"fuera de ventana nocturna, --chilecompra-once activo"}),
                });
                return Ok(());
            }
            std::thread::sleep(std::time::Duration::from_secs(wait));
            continue;
        }

        cycle += 1;
        let fecha = today_santiago_ddmmyyyy();
        // Adjust for days_back
        let now_days = {
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
            let local = now - 4 * 3600;
            (local / 86400) as u32
        };
        let target_days = now_days.saturating_sub(opts.discover_days_back as u32);
        let (ty, tm, td) = days_to_ymd(target_days);
        let target_fecha = format!("{:02}{:02}{:04}", td, tm, ty);

        let _ = tx.send(Msg::Progress {
            task: TaskKind::Chile,
            payload: serde_json::json!({"phase":"discovery","status":"running","message":format!("ciclo {cycle}: discovery {ty}-{tm:02}-{td:02}")}),
        });

        let kinds: Vec<&str> = if opts.kind == "all" { vec!["licitaciones", "ordenes_compra"] } else { vec![opts.kind.as_str()] };
        for kind in &kinds {
            match discover_one_kind(&mut client, &opts.ticket, &target_fecha, kind, opts.estado.as_deref(), opts.daily_budget) {
                Ok((disc, q)) => { total.discovered += disc; total.queued += q; }
                Err(e) => {
                    let _ = tx.send(Msg::Progress {
                        task: TaskKind::Chile,
                        payload: serde_json::json!({"phase":"discovery","status":"running","message":format!("ciclo {cycle} {kind}: {e}")}),
                    });
                }
            }
        }
        let _ = hydrate_queue(&mut client, &opts.ticket, opts.hydration_budget, opts.daily_budget, opts.sleep_seconds, &tx, &mut total);

        let _ = tx.send(Msg::Progress {
            task: TaskKind::Chile,
            payload: serde_json::json!({
                "phase": "cycle_done",
                "status": "running",
                "message": format!("ciclo {cycle}: +{} cola, +{} procesados", total.queued, total.processed),
                "discovered": total.discovered,
                "queued": total.queued,
                "processed": total.processed,
                "failed": total.failed,
            }),
        });

        if opts.once {
            let _ = tx.send(Msg::Progress {
                task: TaskKind::Chile,
                payload: serde_json::json!({"phase":"done","status":"completed","message":format!("ciclo {cycle} completado")}),
            });
            return Ok(());
        }
        let _ = fecha; // suppress unused warning
        std::thread::sleep(std::time::Duration::from_secs(60));
    }
}
