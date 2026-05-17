use anyhow::Result;
use clap::{Parser, Subcommand, ValueEnum};
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
    collections::{HashMap, HashSet},
    env,
    fs::{self, File, OpenOptions},
    io::{self, BufWriter, Read, Seek, SeekFrom, Write},
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
    #[command(subcommand)]
    command: Option<Command>,
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
    #[arg(
        long,
        default_value_t = 0.1,
        help = "Segundos entre fechas durante backfill"
    )]
    sleep_between: f64,
    #[arg(
        long,
        default_value_t = 5,
        help = "Pausar backfill tras N errores consecutivos"
    )]
    max_consecutive_errors: u32,
}

#[derive(Subcommand, Debug)]
enum Command {
    FastDemo(FastDemoArgs),
    HackathonLoad(HackathonLoadArgs),
    IngestChilecompra(ChileSelectiveArgs),
    DbDiagnoseDuplicates(DbDiagnoseArgs),
}

#[derive(Copy, Clone, Debug, ValueEnum)]
enum HackathonProfile {
    Smoke,
    Demo,
    Rich,
}

#[derive(clap::Args, Debug, Clone)]
struct HackathonLoadArgs {
    #[arg(long, value_enum, default_value_t = HackathonProfile::Demo)]
    profile: HackathonProfile,
    #[arg(long)]
    dry_run: bool,
    #[arg(long)]
    skip_chile: bool,
    #[arg(long)]
    skip_infolobby: bool,
    #[arg(long)]
    skip_offshore: bool,
    #[arg(long)]
    focus: Option<String>,
    #[arg(long)]
    from: Option<String>,
    #[arg(long)]
    to: Option<String>,
    #[arg(long)]
    chile_limit: Option<u64>,
    #[arg(long)]
    infolobby_limit: Option<u64>,
    #[arg(long)]
    offshore_limit: Option<u64>,
    #[arg(long, default_value = "CHL")]
    offshore_country_code: Vec<String>,
}

#[derive(clap::Args, Debug, Clone)]
struct FastDemoArgs {
    #[arg(long, default_value = "infolobby,offshore")]
    sources: String,
    #[arg(long)]
    infolobby_dir: Option<String>,
    #[arg(long)]
    offshore_dir: Option<String>,
    #[arg(long, default_value_t = 100)]
    limit_audiences: u64,
    #[arg(long, default_value_t = 0)]
    drop_oldest_percent: u8,
    #[arg(long)]
    focus: Option<String>,
    #[arg(long)]
    audience_ids: Option<String>,
    #[arg(long, default_value_t = 1000)]
    offshore_limit: u64,
    #[arg(long)]
    offshore_country_code: Vec<String>,
    #[arg(long)]
    dry_run: bool,
    #[arg(long)]
    skip_raw: bool,
    #[arg(long, value_enum, default_value_t = RawMode::Minimal)]
    raw_mode: RawMode,
}

#[derive(clap::Args, Debug, Clone)]
struct ChileSelectiveArgs {
    #[arg(long)]
    from: Option<String>,
    #[arg(long)]
    to: Option<String>,
    #[arg(long)]
    buyer: Option<String>,
    #[arg(long)]
    keyword: Option<String>,
    #[arg(long)]
    supplier_rut: Option<String>,
    #[arg(long)]
    supplier_name: Option<String>,
    #[arg(long)]
    fast_demo: bool,
    #[arg(long)]
    dry_run: bool,
    #[arg(long, default_value_t = 50)]
    limit: u64,
    #[arg(long, default_value_t = 20)]
    max_requests: u64,
    #[arg(long, default_value_t = 1000)]
    delay_ms: u64,
    #[arg(long, default_value_t = 2)]
    retry: u32,
    #[arg(long, default_value_t = 2000)]
    backoff_ms: u64,
    #[arg(long)]
    cache: bool,
    #[arg(long)]
    no_cache: bool,
    #[arg(long, default_value = ".cache/chilecompra")]
    cache_dir: String,
    #[arg(long)]
    skip_raw: bool,
    #[arg(long, value_enum, default_value_t = RawMode::Full)]
    raw_mode: RawMode,
}

#[derive(clap::Args, Debug, Clone)]
struct DbDiagnoseArgs {
    #[arg(long)]
    fix_safe: bool,
}

#[derive(Copy, Clone, Debug, ValueEnum)]
enum RawMode {
    Minimal,
    Full,
}

#[derive(Clone)]
struct ChileRequest {
    base_url: String,
    dataset_name: &'static str,
    record_type: &'static str,
    params: Vec<(String, String)>,
    cache_key_url: String,
}

#[derive(Default)]
struct ChileSelectiveStats {
    requests_made: u64,
    cache_hits: u64,
    cache_misses: u64,
    rate_limit_waits: u64,
    records_fetched: u64,
    records_selected: u64,
    entities_upserted: u64,
    relationships_upserted: u64,
    duplicates_skipped: u64,
    failed_records: u64,
}

#[derive(Clone)]
struct ChileSelectedRecord {
    record_type: String,
    dataset_name: String,
    external_id: String,
    source_url: String,
    record: Value,
    score: i64,
}

#[derive(Clone)]
struct ChileRecommendedEntity {
    id: i32,
    display_name: String,
    entity_type: String,
}

struct ChileHttpClient {
    ticket: String,
    max_requests: u64,
    delay: Duration,
    retry: u32,
    backoff: Duration,
    cache_enabled: bool,
    cache_dir: PathBuf,
    requests_made: u64,
    cache_hits: u64,
    cache_misses: u64,
    rate_limit_waits: u64,
    last_request_at: Option<Instant>,
    agent: ureq::Agent,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
enum FastSource {
    Infolobby,
    Offshore,
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
            .or_else(|| env::var("RUST_DATABASE_URL").ok())
            .or_else(|| env::var("DATABASE_URL").ok())
            .unwrap_or_else(|| {
                "postgresql://mapapoder:mapapoder@localhost:5432/mapapoderlatam".to_string()
            }),
    );

    if let Some(command) = args.command.as_ref() {
        match command {
            Command::FastDemo(fast_args) => run_fast_demo(db_url.clone(), &backend_dir, fast_args)?,
            Command::HackathonLoad(load_args) => {
                run_hackathon_load(db_url.clone(), &backend_dir, load_args)?
            }
            Command::IngestChilecompra(chile_args) => {
                run_chilecompra_selective_cli(db_url.clone(), &backend_dir, chile_args)?
            }
            Command::DbDiagnoseDuplicates(dup_args) => {
                run_duplicate_diagnosis_cli(&db_url, dup_args.fix_safe)?
            }
        }
        return Ok(());
    }

    if args.once {
        let stats = collect_stats(&db_url).unwrap_or_default();
        print_stats(&stats);
        return Ok(());
    }
    if args.run_infolobby {
        let (tx, _rx) = mpsc::channel();
        run_infolobby_rust(
            InfolobbyOptions {
                db_url: db_url.clone(),
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
                cleanup: true,
                idempotent_sources: false,
                fast_demo_relationships: false,
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
                db_url: db_url.clone(),
                data_dir: args
                    .offshore_data_dir
                    .clone()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| backend_dir.join("data/offshore")),
                limit: args.offshore_limit,
                country_codes: normalize_offshore_country_codes(&args.offshore_country_code),
                cleanup: true,
                idempotent_sources: false,
                mode: "rust_tui_rebuild".to_string(),
            },
            tx,
        )?;
        println!("Offshore Rust completado");
        return Ok(());
    }

    println!("Mapa Poder Latam data CLI");
    println!();
    println!("Comandos principales:");
    println!("  cargo run -- hackathon-load --profile demo");
    println!("  cargo run -- hackathon-load --profile smoke --dry-run");
    println!("  cargo run -- ingest-chilecompra --fast-demo --limit 50");
    println!("  cargo run -- ingest-chilecompra --fast-demo --dry-run");
    println!("  cargo run -- db-diagnose-duplicates");
    println!("  cargo run -- db-diagnose-duplicates --fix-safe");
    println!();
    println!("Compatibilidad TUI: usa --run-infolobby, --run-offshore o --chilecompra-once para workers existentes.");
    println!("Estado actual:");
    let stats = collect_stats(&db_url).unwrap_or_default();
    print_stats(&stats);
    return Ok(());

    #[allow(unreachable_code)]
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
        cleanup: true,
        idempotent_sources: false,
        fast_demo_relationships: false,
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
        cleanup: true,
        idempotent_sources: false,
        mode: "rust_tui_rebuild".to_string(),
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
            app.chile.message =
                "CHILECOMPRA_TICKET no configurado — define la variable de entorno".to_string();
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
    thread::spawn(move || match run_chilecompra_worker(opts, tx.clone()) {
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
            if app.chile.status == "completed"
                || app.chile.status == "error"
                || app.chile.status == "done"
            {
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
    cleanup: bool,
    idempotent_sources: bool,
    mode: String,
}

#[derive(Default, Clone)]
struct OffshoreRunSummary {
    nodes_selected: u64,
    relationships_selected: u64,
    entities_upserted: u64,
    relationships_upserted: u64,
}

#[derive(Default, Clone)]
struct InfolobbyRunSummary {
    audiences_selected: u64,
    rows_copied: u64,
    entities_upserted: u64,
    relationships_upserted: u64,
}

#[derive(Default)]
struct FastDemoSummary {
    infolobby: Option<InfolobbyRunSummary>,
    offshore: Option<OffshoreRunSummary>,
    recommendations: Vec<DemoRecommendation>,
}

struct DemoRecommendation {
    id: i32,
    display_name: String,
    entity_type: String,
    degree: i64,
}

#[derive(Default)]
struct NormalizeStats {
    entities_upserted: u64,
    relationships_upserted: u64,
}

#[derive(Default)]
struct InfolobbyFastSelection {
    audience_ids: HashSet<String>,
    passive_codes: HashSet<String>,
}

#[derive(Clone)]
struct InfolobbyTailRecord {
    code: String,
    organism: String,
    date: String,
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

fn parse_fast_sources(value: &str) -> Result<Vec<FastSource>> {
    let mut out = Vec::new();
    for raw in value.split(',') {
        let source = match raw.trim().to_ascii_lowercase().as_str() {
            "infolobby" => FastSource::Infolobby,
            "offshore" => FastSource::Offshore,
            "" => continue,
            other => anyhow::bail!("Fuente fast-demo desconocida: {other}"),
        };
        if !out.contains(&source) {
            out.push(source);
        }
    }
    if out.is_empty() {
        anyhow::bail!("--sources debe incluir infolobby, offshore o ambos");
    }
    Ok(out)
}

fn run_hackathon_load(db_url: String, backend_dir: &Path, args: &HackathonLoadArgs) -> Result<()> {
    let (default_infolobby, default_offshore, default_chile, default_requests) = match args.profile
    {
        HackathonProfile::Smoke => (30, 50, 10, 8),
        HackathonProfile::Demo => (200, 500, 30, 20),
        HackathonProfile::Rich => (500, 2_000, 60, 40),
    };
    let infolobby_limit = args.infolobby_limit.unwrap_or(default_infolobby);
    let offshore_limit = args.offshore_limit.unwrap_or(default_offshore);
    let chile_limit = args.chile_limit.unwrap_or(default_chile);

    println!("Hackathon load: {:?}", args.profile);
    println!(
        "Plan: infolobby={} offshore={} chile={} dry_run={}",
        if args.skip_infolobby {
            0
        } else {
            infolobby_limit
        },
        if args.skip_offshore {
            0
        } else {
            offshore_limit
        },
        if args.skip_chile { 0 } else { chile_limit },
        args.dry_run
    );

    let mut sources = Vec::new();
    if !args.skip_infolobby {
        sources.push("infolobby");
    }
    if !args.skip_offshore {
        sources.push("offshore");
    }
    if !sources.is_empty() {
        run_fast_demo(
            db_url.clone(),
            backend_dir,
            &FastDemoArgs {
                sources: sources.join(","),
                infolobby_dir: None,
                offshore_dir: None,
                limit_audiences: infolobby_limit,
                drop_oldest_percent: 70,
                focus: args.focus.clone(),
                audience_ids: None,
                offshore_limit,
                offshore_country_code: args.offshore_country_code.clone(),
                dry_run: args.dry_run,
                skip_raw: true,
                raw_mode: RawMode::Minimal,
            },
        )?;
    }

    if args.skip_chile {
        return Ok(());
    }
    if env::var("CHILECOMPRA_TICKET")
        .ok()
        .map(|v| v.trim().is_empty())
        .unwrap_or(true)
    {
        eprintln!("ChileCompra skipped: CHILECOMPRA_TICKET no configurado.");
        return Ok(());
    }
    run_chilecompra_selective_cli(
        db_url,
        backend_dir,
        &ChileSelectiveArgs {
            from: args.from.clone(),
            to: args.to.clone(),
            buyer: None,
            keyword: args.focus.clone(),
            supplier_rut: None,
            supplier_name: None,
            fast_demo: true,
            dry_run: args.dry_run,
            limit: chile_limit,
            max_requests: default_requests,
            delay_ms: 500,
            retry: 2,
            backoff_ms: 1_500,
            cache: true,
            no_cache: false,
            cache_dir: ".cache/chilecompra".to_string(),
            skip_raw: true,
            raw_mode: RawMode::Minimal,
        },
    )
}

fn run_fast_demo(db_url: String, backend_dir: &Path, args: &FastDemoArgs) -> Result<()> {
    let sources = parse_fast_sources(&args.sources)?;
    let mut summary = FastDemoSummary::default();
    let mut source_errors = Vec::new();
    let (tx, _rx) = mpsc::channel();

    for source in sources {
        match source {
            FastSource::Infolobby => {
                let infolobby_dir = args
                    .infolobby_dir
                    .clone()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| backend_dir.join("data/infolobby"));
                let result = run_infolobby_fast_demo(
                    FastInfolobbyOptions {
                        db_url: db_url.clone(),
                        data_dir: infolobby_dir,
                        limit_audiences: args.limit_audiences,
                        drop_oldest_percent: args.drop_oldest_percent,
                        focus: args.focus.clone(),
                        audience_ids: args.audience_ids.clone(),
                        skip_raw_records: args.skip_raw
                            || matches!(args.raw_mode, RawMode::Minimal),
                        dry_run: args.dry_run,
                    },
                    tx.clone(),
                );
                match result {
                    Ok(infolobby) => summary.infolobby = Some(infolobby),
                    Err(err) if is_fatal_fast_demo_error(&err) => return Err(err),
                    Err(err) => source_errors.push(format!("InfoLobby failed: {err}")),
                }
            }
            FastSource::Offshore => {
                let offshore_dir = args
                    .offshore_dir
                    .clone()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| backend_dir.join("data/offshore"));
                if args.dry_run {
                    summary.offshore = Some(OffshoreRunSummary {
                        relationships_selected: args.offshore_limit,
                        ..OffshoreRunSummary::default()
                    });
                    continue;
                }
                let result = run_offshore_rust(
                    OffshoreOptions {
                        db_url: db_url.clone(),
                        data_dir: offshore_dir,
                        limit: Some(args.offshore_limit),
                        country_codes: normalize_offshore_country_codes(
                            &args.offshore_country_code,
                        ),
                        cleanup: false,
                        idempotent_sources: true,
                        mode: "fast_demo".to_string(),
                    },
                    tx.clone(),
                );
                match result {
                    Ok(offshore) => summary.offshore = Some(offshore),
                    Err(err) if is_fatal_fast_demo_error(&err) => return Err(err),
                    Err(err) => {
                        source_errors.push(format!("Offshore failed: {}", pg_error_detail(&err)))
                    }
                }
            }
        }
    }

    if summary.infolobby.is_none() && summary.offshore.is_none() && !source_errors.is_empty() {
        anyhow::bail!("{}", source_errors.join("; "));
    }

    if !args.dry_run {
        summary.recommendations = collect_demo_recommendations(&db_url)?;
    }
    print_fast_demo_summary(&summary);
    for error in source_errors {
        eprintln!("{error}");
    }
    Ok(())
}

fn is_fatal_fast_demo_error(err: &anyhow::Error) -> bool {
    err.chain()
        .any(|cause| cause.downcast_ref::<postgres::Error>().is_some())
}

struct FastInfolobbyOptions {
    db_url: String,
    data_dir: PathBuf,
    limit_audiences: u64,
    drop_oldest_percent: u8,
    focus: Option<String>,
    audience_ids: Option<String>,
    skip_raw_records: bool,
    dry_run: bool,
}

const FAST_INFOLOBBY_FILES: &[&str] = &[
    "audiencias.csv",
    "activos.csv",
    "pasivos.csv",
    "asistenciasActivos.csv",
    "asistenciasPasivos.csv",
    "datosAudiencia.csv",
    "representaciones.csv",
    "trabajaPara.csv",
];

fn run_infolobby_fast_demo(
    opts: FastInfolobbyOptions,
    tx: Sender<Msg>,
) -> Result<InfolobbyRunSummary> {
    if opts.drop_oldest_percent > 0
        && opts.skip_raw_records
        && opts.focus.is_none()
        && opts.audience_ids.is_none()
    {
        return run_infolobby_tail_demo(opts, tx);
    }
    let mut selection = select_fast_infolobby_audiences(&opts)?;
    retain_recent_infolobby_selection(&opts, &mut selection)?;
    gather_fast_infolobby_linked_codes(&opts.data_dir, &mut selection)?;
    let audience_count = selection.audience_ids.len() as u64;
    if audience_count == 0 {
        anyhow::bail!("No se encontraron audiencias InfoLobby para fast-demo");
    }
    if opts.dry_run {
        println!(
            "InfoLobby dry-run: {} audiencias seleccionadas, {} codigos pasivos vinculados",
            audience_count,
            selection.passive_codes.len()
        );
        return Ok(InfolobbyRunSummary {
            audiences_selected: audience_count,
            ..InfolobbyRunSummary::default()
        });
    }

    let mut client = Client::connect(&opts.db_url, NoTls)?;
    client.batch_execute(
        "SET statement_timeout = 0; SET work_mem = '512MB'; SET search_path = pg_temp, public",
    )?;
    let run_token = format!(
        "fast_{}",
        SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos()
    );
    let selected = FAST_INFOLOBBY_FILES.to_vec();
    let tables: HashMap<String, String> = selected
        .iter()
        .map(|file| {
            (
                file.to_string(),
                format!(
                    "tmp_infolobby_fast_{}_{}",
                    file.trim_end_matches(".csv").to_lowercase(),
                    run_token
                ),
            )
        })
        .collect();
    let run_id: i32 = client
        .query_one(
            "INSERT INTO ingestion_runs (source_name, status, metadata) VALUES ('infolobby', 'running', $1::text::jsonb) RETURNING id",
            &[&serde_json::json!({"mode":"fast_demo","audiences_selected":audience_count,"focus":opts.focus,"run_token":run_token}).to_string()],
        )?
        .get(0);

    let result = (|| -> Result<(InfolobbyCopyTotals, NormalizeStats)> {
        client.batch_execute("BEGIN")?;
        let totals =
            copy_fast_infolobby_files(&mut client, &opts, &selection, &selected, &tables, &tx)?;
        let stats = normalize_infolobby(
            &mut client,
            &tables,
            &run_token,
            opts.skip_raw_records,
            true,
            true,
            &tx,
        )?;
        client.batch_execute("COMMIT")?;
        Ok((totals, stats))
    })();

    match result {
        Ok((totals, stats)) => {
            finish_infolobby_run(&mut client, run_id, "completed", &totals, None)?;
            Ok(InfolobbyRunSummary {
                audiences_selected: audience_count,
                rows_copied: totals.copied,
                entities_upserted: stats.entities_upserted,
                relationships_upserted: stats.relationships_upserted,
            })
        }
        Err(err) => {
            let _ = client.batch_execute("ROLLBACK");
            let empty = InfolobbyCopyTotals {
                copied: 0,
                skipped: 0,
                extra_columns: 0,
            };
            let _ = finish_infolobby_run(
                &mut client,
                run_id,
                "failed",
                &empty,
                Some(&err.to_string()),
            );
            Err(err)
        }
    }
}

fn select_fast_infolobby_audiences(opts: &FastInfolobbyOptions) -> Result<InfolobbyFastSelection> {
    let mut selection = InfolobbyFastSelection::default();
    let percent = opts.drop_oldest_percent.min(95) as usize;
    let limit = if percent > 0 {
        ((opts.limit_audiences.max(1) as usize) * 100 / (100 - percent))
            .max(opts.limit_audiences as usize + 1)
    } else {
        opts.limit_audiences.max(1) as usize
    };
    if let Some(ids) = &opts.audience_ids {
        for id in ids.split([',', ';', ' ', '\n', '\t']) {
            let clean = clean_code_rs(id);
            if !clean.is_empty() {
                selection.audience_ids.insert(clean);
            }
            if selection.audience_ids.len() >= limit {
                break;
            }
        }
        return Ok(selection);
    }
    if opts.drop_oldest_percent > 0 && opts.focus.is_none() {
        select_recent_infolobby_audiences(
            &opts.data_dir,
            opts.limit_audiences.max(1) as usize,
            &mut selection.audience_ids,
        )?;
        if !selection.audience_ids.is_empty() {
            return Ok(selection);
        }
    }
    if let Some(focus) = &opts.focus {
        let needle = focus.trim().to_ascii_lowercase();
        if !needle.is_empty() {
            for file_name in FAST_INFOLOBBY_FILES {
                if selection.audience_ids.len() >= limit {
                    break;
                }
                scan_infolobby_for_focus(
                    &opts.data_dir.join(file_name),
                    file_name,
                    &needle,
                    limit,
                    &mut selection.audience_ids,
                )?;
            }
            if !selection.audience_ids.is_empty() {
                return Ok(selection);
            }
        }
    }
    select_connected_infolobby_sample(&opts.data_dir, limit, &mut selection.audience_ids)?;
    Ok(selection)
}

fn select_recent_infolobby_audiences(
    data_dir: &Path,
    limit: usize,
    audience_ids: &mut HashSet<String>,
) -> Result<()> {
    for rec in read_recent_infolobby_tail_records(data_dir, limit)? {
        audience_ids.insert(rec.code);
    }
    Ok(())
}

fn read_recent_infolobby_tail_records(
    data_dir: &Path,
    limit: usize,
) -> Result<Vec<InfolobbyTailRecord>> {
    let path = data_dir.join("audiencias.csv");
    let mut file = File::open(&path)?;
    let len = file.metadata()?.len();
    let tail_bytes = 32_u64 * 1024 * 1024;
    let mut start = len.saturating_sub(tail_bytes);
    if start % 2 != 0 {
        start += 1;
    }
    file.seek(SeekFrom::Start(start))?;
    let mut bytes = Vec::with_capacity((len - start).min(tail_bytes) as usize);
    file.read_to_end(&mut bytes)?;
    let (decoded, _, _) = encoding_rs::UTF_16LE.decode(&bytes);
    let mut text = decoded.into_owned();
    if start > 0 {
        if let Some(pos) = text.find('\n') {
            text = text[pos + 1..].to_string();
        }
    }
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(text.as_bytes());
    let mut rows = Vec::with_capacity(limit.saturating_mul(4).max(100));
    for row in rdr.records() {
        let row = row?;
        let code = row.get(1).map(clean_code_rs).unwrap_or_default();
        if code.is_empty() || code == "CodigoURI" {
            continue;
        }
        let date = row.get(4).unwrap_or("").to_string();
        let organism = row.get(3).unwrap_or("").trim().to_string();
        if !date.is_empty() {
            rows.push((
                date.clone(),
                InfolobbyTailRecord {
                    code,
                    organism,
                    date,
                },
            ));
        }
    }
    rows.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(rows.into_iter().take(limit).map(|(_, rec)| rec).collect())
}

fn run_infolobby_tail_demo(
    opts: FastInfolobbyOptions,
    _tx: Sender<Msg>,
) -> Result<InfolobbyRunSummary> {
    let records =
        read_recent_infolobby_tail_records(&opts.data_dir, opts.limit_audiences.max(1) as usize)?;
    if opts.dry_run {
        println!(
            "InfoLobby tail dry-run: {} audiencias recientes desde audiencias.csv",
            records.len()
        );
        return Ok(InfolobbyRunSummary {
            audiences_selected: records.len() as u64,
            ..InfolobbyRunSummary::default()
        });
    }
    let mut client = Client::connect(&opts.db_url, NoTls)?;
    client.batch_execute("SET statement_timeout = 0")?;
    let run_id: i32 = client
        .query_one(
            "INSERT INTO ingestion_runs (source_name, status, metadata) VALUES ('infolobby', 'running', $1::text::jsonb) RETURNING id",
            &[&serde_json::json!({"mode":"tail_fast_demo","limit":opts.limit_audiences,"drop_oldest_percent":opts.drop_oldest_percent}).to_string()],
        )?
        .get(0);
    let result = (|| -> Result<InfolobbyRunSummary> {
        client.batch_execute("BEGIN")?;
        let mut entities = 0u64;
        let mut rels = 0u64;
        for rec in &records {
            if rec.organism.trim().is_empty() || rec.code.trim().is_empty() {
                continue;
            }
            let source_id = upsert_infolobby_tail_source(&mut client, rec)?;
            let body_id = upsert_simple_entity(
                &mut client,
                &format!("infolobby:public_body:{}", canonicalize(&rec.organism)),
                &rec.organism,
                "public_body",
                &serde_json::json!({"source_name":"infolobby","source_mode":"tail_fast_demo"}),
            )?;
            let aud_id = upsert_simple_entity(
                &mut client,
                &format!("infolobby:audience:{}", rec.code),
                &format!("Audiencia InfoLobby {}", rec.code),
                "audience",
                &serde_json::json!({"source_name":"infolobby","source_mode":"tail_fast_demo","audience_code":rec.code,"date":rec.date}),
            )?;
            insert_simple_relationship(
                &mut client,
                body_id,
                aud_id,
                "held_audience",
                "Organismo registra audiencia",
                source_id,
                &serde_json::json!({"source_name":"infolobby","source_mode":"tail_fast_demo","audience_code":rec.code,"date":rec.date}),
            )?;
            entities += 2;
            rels += 1;
        }
        client.batch_execute("COMMIT")?;
        Ok(InfolobbyRunSummary {
            audiences_selected: records.len() as u64,
            rows_copied: records.len() as u64,
            entities_upserted: entities,
            relationships_upserted: rels,
        })
    })();
    match result {
        Ok(summary) => {
            finish_simple_run(
                &mut client,
                run_id,
                "completed",
                summary.rows_copied,
                summary.audiences_selected,
                None,
            )?;
            Ok(summary)
        }
        Err(err) => {
            let _ = client.batch_execute("ROLLBACK");
            let _ = finish_simple_run(&mut client, run_id, "failed", 0, 0, Some(&err.to_string()));
            Err(err)
        }
    }
}

fn upsert_infolobby_tail_source(client: &mut Client, rec: &InfolobbyTailRecord) -> Result<i32> {
    let external_id = format!("infolobby:audience:{}", rec.code);
    if let Some(row) = client.query_opt(
        "SELECT id FROM sources WHERE source_name='infolobby' AND external_id=$1 ORDER BY id LIMIT 1",
        &[&external_id],
    )? {
        return Ok(row.get(0));
    }
    let meta = serde_json::json!({
        "source_mode":"tail_fast_demo",
        "dataset":"audiencias",
        "audience_code": rec.code,
        "date": rec.date,
    });
    Ok(client
        .query_one(
            "INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata) VALUES ('infolobby', 'public_dataset', $1, $2, $3, $4::text::jsonb) RETURNING id",
            &[&INFOLOBBY_SOURCE_URL, &external_id, &INFOLOBBY_LICENSE, &meta.to_string()],
        )?
        .get(0))
}

fn upsert_simple_entity(
    client: &mut Client,
    external_id: &str,
    display_name: &str,
    entity_type: &str,
    metadata: &Value,
) -> Result<i32> {
    let canonical = canonicalize(display_name);
    if let Some(row) = client.query_opt(
        "SELECT id FROM entities WHERE external_id=$1 ORDER BY id LIMIT 1",
        &[&external_id],
    )? {
        let id: i32 = row.get(0);
        client.execute(
            "UPDATE entities SET display_name=$1, canonical_name=$2, metadata=COALESCE(metadata, '{}'::jsonb) || $3::text::jsonb, updated_at=now() WHERE id=$4",
            &[&display_name, &canonical, &metadata.to_string(), &id],
        )?;
        return Ok(id);
    }
    Ok(client
        .query_one(
            "INSERT INTO entities (external_id, canonical_name, display_name, entity_type, country_code, metadata, risk_score) VALUES ($1, $2, $3, $4, 'CL', $5::text::jsonb, 0) RETURNING id",
            &[&external_id, &canonical, &display_name, &entity_type, &metadata.to_string()],
        )?
        .get(0))
}

fn insert_simple_relationship(
    client: &mut Client,
    src: i32,
    dst: i32,
    typ: &str,
    label: &str,
    source_id: i32,
    metadata: &Value,
) -> Result<()> {
    client.execute(
        "INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type, label, weight, confidence_score, metadata, source_id) VALUES ($1, $2, $3, $4, 1, 1, $5::text::jsonb, $6) ON CONFLICT DO NOTHING",
        &[&src, &dst, &typ, &label, &metadata.to_string(), &source_id],
    )?;
    Ok(())
}

fn canonicalize(value: &str) -> String {
    value
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn retain_recent_infolobby_selection(
    opts: &FastInfolobbyOptions,
    selection: &mut InfolobbyFastSelection,
) -> Result<()> {
    let percent = opts.drop_oldest_percent.min(95);
    if percent == 0 || selection.audience_ids.len() <= opts.limit_audiences as usize {
        return Ok(());
    }
    let path = opts.data_dir.join("audiencias.csv");
    let headers = headers_for("audiencias.csv");
    let mut rdr = utf16_csv_reader(&path)?;
    validate_infolobby_headers(&mut rdr, &path, &headers)?;
    let mut dated = Vec::new();
    for row in rdr.records() {
        let row = row?;
        let Some(code) = audience_code_from_row("audiencias.csv", &headers, &row) else {
            continue;
        };
        if !selection.audience_ids.contains(&code) {
            continue;
        }
        let date = csv_value(&headers, &row, "fechaEvento").to_string();
        dated.push((date, code));
    }
    if dated.is_empty() {
        return Ok(());
    }
    dated.sort_by(|a, b| b.0.cmp(&a.0));
    let keep = (opts.limit_audiences.max(1) as usize).min(dated.len());
    let keep_ids: HashSet<String> = dated.into_iter().take(keep).map(|(_, code)| code).collect();
    selection
        .audience_ids
        .retain(|code| keep_ids.contains(code));
    Ok(())
}

fn scan_infolobby_for_focus(
    path: &Path,
    file_name: &str,
    needle: &str,
    limit: usize,
    audience_ids: &mut HashSet<String>,
) -> Result<()> {
    let headers = headers_for(file_name);
    let mut rdr = utf16_csv_reader(path)?;
    validate_infolobby_headers(&mut rdr, path, &headers)?;
    for row in rdr.records() {
        let row = row?;
        if row
            .iter()
            .any(|cell| cell.to_ascii_lowercase().contains(needle))
        {
            if let Some(code) = audience_code_from_row(file_name, &headers, &row) {
                audience_ids.insert(code);
            }
        }
        if audience_ids.len() >= limit {
            break;
        }
    }
    Ok(())
}

fn select_connected_infolobby_sample(
    data_dir: &Path,
    limit: usize,
    audience_ids: &mut HashSet<String>,
) -> Result<()> {
    let mut active_audiences = HashSet::new();
    scan_audience_codes(
        &data_dir.join("asistenciasActivos.csv"),
        "asistenciasActivos.csv",
        limit.saturating_mul(200).max(1_000),
        &mut active_audiences,
    )?;
    let headers = headers_for("asistenciasPasivos.csv");
    let path = data_dir.join("asistenciasPasivos.csv");
    let mut rdr = utf16_csv_reader(&path)?;
    validate_infolobby_headers(&mut rdr, &path, &headers)?;
    for row in rdr.records() {
        let row = row?;
        if let Some(code) = audience_code_from_row("asistenciasPasivos.csv", &headers, &row) {
            if active_audiences.contains(&code) {
                audience_ids.insert(code);
            }
        }
        if audience_ids.len() >= limit {
            return Ok(());
        }
    }
    for code in active_audiences {
        audience_ids.insert(code);
        if audience_ids.len() >= limit {
            return Ok(());
        }
    }
    scan_audience_codes(
        &data_dir.join("audiencias.csv"),
        "audiencias.csv",
        limit,
        audience_ids,
    )?;
    Ok(())
}

fn scan_audience_codes(
    path: &Path,
    file_name: &str,
    limit: usize,
    out: &mut HashSet<String>,
) -> Result<()> {
    let headers = headers_for(file_name);
    let mut rdr = utf16_csv_reader(path)?;
    validate_infolobby_headers(&mut rdr, path, &headers)?;
    for row in rdr.records() {
        let row = row?;
        if let Some(code) = audience_code_from_row(file_name, &headers, &row) {
            out.insert(code);
        }
        if out.len() >= limit {
            break;
        }
    }
    Ok(())
}

fn gather_fast_infolobby_linked_codes(
    data_dir: &Path,
    selection: &mut InfolobbyFastSelection,
) -> Result<()> {
    let headers = headers_for("asistenciasPasivos.csv");
    let path = data_dir.join("asistenciasPasivos.csv");
    let mut rdr = utf16_csv_reader(&path)?;
    validate_infolobby_headers(&mut rdr, &path, &headers)?;
    for row in rdr.records() {
        let row = row?;
        let Some(audience) = audience_code_from_row("asistenciasPasivos.csv", &headers, &row)
        else {
            continue;
        };
        if selection.audience_ids.contains(&audience) {
            for name in ["codigoPasivo", "pasivo"] {
                let value = clean_code_rs(csv_value(&headers, &row, name));
                if !value.is_empty() {
                    selection.passive_codes.insert(value);
                }
            }
        }
    }
    Ok(())
}

fn copy_fast_infolobby_files(
    client: &mut Client,
    opts: &FastInfolobbyOptions,
    selection: &InfolobbyFastSelection,
    selected: &[&str],
    tables: &HashMap<String, String>,
    tx: &Sender<Msg>,
) -> Result<InfolobbyCopyTotals> {
    let mut totals = InfolobbyCopyTotals {
        copied: 0,
        skipped: 0,
        extra_columns: 0,
    };
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
        let copied = copy_filtered_infolobby_file(
            client,
            &opts.data_dir.join(file_name),
            file_name,
            table,
            &headers,
            selection,
            tx,
        )?;
        client.batch_execute(&format!("CREATE INDEX ON {table} ((_seq))"))?;
        totals.copied += copied.copied;
        totals.skipped += copied.skipped;
        totals.extra_columns += copied.extra_columns;
    }
    Ok(totals)
}

fn copy_filtered_infolobby_file(
    client: &mut Client,
    path: &Path,
    file_name: &str,
    table: &str,
    headers: &[&str],
    selection: &InfolobbyFastSelection,
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
    for row in rdr.records() {
        let row = row?;
        if row.len() < headers.len() {
            totals.skipped += 1;
            continue;
        }
        if !fast_infolobby_row_matches(file_name, headers, &row, selection) {
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
        totals.copied += 1;
    }
    writer.finish()?;
    emit(
        tx,
        serde_json::json!({
            "phase":"copy fast rows","stage":"copy fast rows","file":file_name,
            "file_rows":totals.copied,
            "records_processed":totals.copied,
            "records_skipped":totals.skipped,
        }),
    )?;
    Ok(totals)
}

fn fast_infolobby_row_matches(
    file_name: &str,
    headers: &[&str],
    row: &csv::StringRecord,
    selection: &InfolobbyFastSelection,
) -> bool {
    if file_name == "pasivos.csv" {
        return ["codigoPasivo", "codigoPersona", "nombrePasivo"]
            .iter()
            .map(|name| clean_code_rs(csv_value(headers, row, name)))
            .any(|value| !value.is_empty() && selection.passive_codes.contains(&value));
    }
    audience_code_from_row(file_name, headers, row)
        .map(|code| selection.audience_ids.contains(&code))
        .unwrap_or(false)
}

fn audience_code_from_row(
    file_name: &str,
    headers: &[&str],
    row: &csv::StringRecord,
) -> Option<String> {
    let raw = match file_name {
        "audiencias.csv" | "datosAudiencia.csv" => {
            let code = clean_code_rs(csv_value(headers, row, "CodigoURI"));
            if code.is_empty() {
                tail_rs(csv_value(headers, row, "uriAudiencia"))
            } else {
                code
            }
        }
        "activos.csv" => tail_rs(csv_value(headers, row, "uriAudiencia")),
        _ => clean_code_rs(csv_value(headers, row, "codigoAudiencia")),
    };
    if raw.is_empty() {
        None
    } else {
        Some(raw)
    }
}

fn csv_value<'a>(headers: &[&str], row: &'a csv::StringRecord, name: &str) -> &'a str {
    headers
        .iter()
        .position(|header| *header == name)
        .and_then(|idx| row.get(idx))
        .unwrap_or("")
}

fn clean_code_rs(value: &str) -> String {
    value.replace('\t', "").trim().to_string()
}

fn tail_rs(value: &str) -> String {
    let clean = clean_code_rs(value);
    clean
        .rsplit('/')
        .next()
        .map(str::to_string)
        .unwrap_or(clean)
}

fn collect_demo_recommendations(db_url: &str) -> Result<Vec<DemoRecommendation>> {
    let mut client = Client::connect(db_url, NoTls)?;
    let rows = client.query(
        r#"
        SELECT e.id, e.display_name, e.entity_type, count(r.id)::bigint AS degree
        FROM entities e
        LEFT JOIN relationships r ON r.source_entity_id = e.id OR r.target_entity_id = e.id
        WHERE e.external_id LIKE 'infolobby:%'
           OR e.external_id LIKE 'offshore:%'
           OR e.metadata->>'source_name' IN ('infolobby', 'offshore')
        GROUP BY e.id, e.display_name, e.entity_type, e.risk_score
        HAVING count(r.id) > 0
        ORDER BY degree DESC,
                 CASE e.entity_type WHEN 'public_body' THEN 0 WHEN 'audience' THEN 1 WHEN 'company' THEN 2 WHEN 'person' THEN 3 ELSE 4 END,
                 e.risk_score DESC,
                 e.display_name
        LIMIT 8
        "#,
        &[],
    )?;
    Ok(rows
        .into_iter()
        .map(|row| DemoRecommendation {
            id: row.get(0),
            display_name: row.get(1),
            entity_type: row.get(2),
            degree: row.get(3),
        })
        .collect())
}

fn print_fast_demo_summary(summary: &FastDemoSummary) {
    println!("Fast demo completed\n");
    if let Some(info) = &summary.infolobby {
        println!("InfoLobby:");
        println!("  audiences selected: {}", info.audiences_selected);
        println!("  rows copied: {}", info.rows_copied);
        println!("  entities upserted: {}", info.entities_upserted);
        println!("  relationships upserted: {}", info.relationships_upserted);
        println!();
    }
    if let Some(offshore) = &summary.offshore {
        println!("Offshore:");
        println!("  nodes selected: {}", offshore.nodes_selected);
        println!(
            "  relationships selected: {}",
            offshore.relationships_selected
        );
        println!("  entities upserted: {}", offshore.entities_upserted);
        println!(
            "  relationships upserted: {}",
            offshore.relationships_upserted
        );
        println!();
    }
    if !summary.recommendations.is_empty() {
        println!("Try these entities in the frontend/backend:");
        for (idx, rec) in summary.recommendations.iter().enumerate() {
            println!(
                "{}. {} ({}, degree {})",
                idx + 1,
                rec.display_name,
                rec.entity_type,
                rec.degree
            );
            println!("   search: /api/search?q={}", urlish(&rec.display_name));
            println!("   graph: /api/graph/{}?depth=2", rec.id);
        }
    }
}

fn urlish(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => {
                vec![byte as char]
            }
            b' ' => vec!['%', '2', '0'],
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

fn pg_error_detail(err: &anyhow::Error) -> String {
    for cause in err.chain() {
        if let Some(pg) = cause.downcast_ref::<postgres::Error>() {
            if let Some(db) = pg.as_db_error() {
                let mut msg = format!("{}: {}", db.severity(), db.message());
                if let Some(d) = db.detail() {
                    msg.push_str(&format!(" | detail: {d}"));
                }
                if let Some(h) = db.hint() {
                    msg.push_str(&format!(" | hint: {h}"));
                }
                return msg;
            }
        }
    }
    err.to_string()
}

fn run_chilecompra_selective_cli(
    db_url: String,
    backend_dir: &Path,
    args: &ChileSelectiveArgs,
) -> Result<()> {
    let ticket = env::var("CHILECOMPRA_TICKET")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            anyhow::anyhow!(
                "CHILECOMPRA_TICKET no configurado. Define la variable sin hardcodearla."
            )
        })?;
    let base_url = env::var("CHILECOMPRA_BASE_URL").unwrap_or_default();
    let effective_cache = !args.no_cache;
    let cache_dir = {
        let raw = PathBuf::from(&args.cache_dir);
        if raw.is_absolute() {
            raw
        } else {
            backend_dir.parent().unwrap_or(backend_dir).join(raw)
        }
    };
    let limit = args.limit.clamp(1, 500);
    let (from, to) = chile_selective_date_window(args)?;
    let requests = build_chile_discovery_requests(args, &from, &to, &base_url);
    let filters = chile_filter_summary(args, &from, &to, limit);

    println!("ChileCompra Selective Loader");
    println!("Filters: {filters}");
    println!(
        "Rate limit: max_requests={} delay_ms={} retry={} backoff_ms={} cache={} cache_dir={}",
        args.max_requests,
        args.delay_ms.max(1),
        args.retry,
        args.backoff_ms,
        effective_cache,
        cache_dir.display()
    );

    if args.dry_run {
        print_chile_dry_run(&requests, args, effective_cache, &cache_dir, &filters);
        return Ok(());
    }

    let mut http = ChileHttpClient::new(
        ticket,
        args.max_requests.max(1),
        args.delay_ms.max(1),
        args.retry,
        args.backoff_ms,
        effective_cache,
        cache_dir,
    )?;
    let mut stats = ChileSelectiveStats::default();
    let mut candidates = Vec::new();

    for req in &requests {
        if http.requests_made >= http.max_requests {
            break;
        }
        match http.get_json(req) {
            Ok(payload) => {
                let listed = payload
                    .get("Listado")
                    .or_else(|| payload.get("listado"))
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                stats.records_fetched += listed.len() as u64;
                for item in listed {
                    if let Some(selected) = chile_record_candidate(req, item, args) {
                        candidates.push(selected);
                    }
                }
            }
            Err(err) => {
                stats.failed_records += 1;
                eprintln!("ChileCompra discovery error: {err}");
                if is_chile_auth_error(&err.to_string()) {
                    anyhow::bail!("ChileCompra rechazo autenticacion/autorizacion (401/403). Revisa CHILECOMPRA_TICKET.");
                }
            }
        }
        if candidates.len() as u64 >= limit.saturating_mul(3) {
            break;
        }
    }

    candidates.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.external_id.cmp(&b.external_id))
    });
    candidates.dedup_by(|a, b| a.record_type == b.record_type && a.external_id == b.external_id);
    candidates.truncate(limit as usize);

    let detail_budget = http.max_requests.saturating_sub(http.requests_made);
    let details_to_fetch = candidates.len().min(detail_budget as usize);
    let mut selected = Vec::new();
    for candidate in candidates.into_iter().take(details_to_fetch) {
        let detail_req = chile_detail_request(&candidate, &base_url);
        match http.get_json(&detail_req) {
            Ok(payload) => {
                let listed = payload
                    .get("Listado")
                    .or_else(|| payload.get("listado"))
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                if listed.is_empty() {
                    selected.push(candidate);
                    continue;
                }
                for item in listed {
                    if let Some(mut detail) = chile_record_candidate(&detail_req, item, args) {
                        detail.source_url = detail_req.cache_key_url.clone();
                        selected.push(detail);
                    }
                }
            }
            Err(err) => {
                stats.failed_records += 1;
                eprintln!(
                    "ChileCompra detail error for {}: {err}",
                    candidate.external_id
                );
                if err.to_string().contains("max_requests") {
                    break;
                }
                selected.push(candidate);
            }
        }
        if selected.len() as u64 >= limit {
            break;
        }
    }
    selected.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.external_id.cmp(&b.external_id))
    });
    selected.dedup_by(|a, b| a.record_type == b.record_type && a.external_id == b.external_id);
    selected.retain(|r| chile_has_graph_value(r, args.fast_demo));
    selected.truncate(limit as usize);

    stats.requests_made = http.requests_made;
    stats.cache_hits = http.cache_hits;
    stats.cache_misses = http.cache_misses;
    stats.rate_limit_waits = http.rate_limit_waits;
    stats.records_selected = selected.len() as u64;

    let mut client = Client::connect(&db_url, NoTls)?;
    client.batch_execute("SET statement_timeout = 0")?;
    let run_id: i32 = client
        .query_one(
            "INSERT INTO ingestion_runs (source_name, status, metadata) VALUES ('chilecompra', 'running', $1::text::jsonb) RETURNING id",
            &[&serde_json::json!({"mode":"selective_api","filters":filters,"limit":limit,"cache":effective_cache}).to_string()],
        )?
        .get(0);
    let persist_result = (|| -> Result<()> {
        client.batch_execute("BEGIN")?;
        for selected_record in &selected {
            let before = chile_count_graph_rows(&mut client)?;
            if !args.skip_raw && matches!(args.raw_mode, RawMode::Full) {
                upsert_chile_raw_record(&mut client, selected_record)?;
            }
            normalize_and_store_chile(
                &mut client,
                &selected_record.record,
                &selected_record.record_type,
                &selected_record.source_url,
            )?;
            let after = chile_count_graph_rows(&mut client)?;
            stats.entities_upserted += after.0.saturating_sub(before.0);
            stats.relationships_upserted += after.1.saturating_sub(before.1);
            if after == before {
                stats.duplicates_skipped += 1;
            }
        }
        client.batch_execute("COMMIT")?;
        Ok(())
    })();
    match persist_result {
        Ok(()) => finish_simple_run(
            &mut client,
            run_id,
            "completed",
            stats.records_fetched,
            stats.records_selected,
            None,
        )?,
        Err(err) => {
            let _ = client.batch_execute("ROLLBACK");
            let _ = finish_simple_run(
                &mut client,
                run_id,
                "failed",
                stats.records_fetched,
                stats.records_selected,
                Some(&err.to_string()),
            );
            return Err(err);
        }
    }

    let recommendations = collect_chile_recommendations(&db_url)?;
    print_chile_ingestion_summary(&stats, &recommendations);
    Ok(())
}

fn chile_selective_date_window(args: &ChileSelectiveArgs) -> Result<(String, String)> {
    let today_days =
        date_from_iso(&today_santiago_iso()).unwrap_or_else(|| ymd_to_days(2026, 5, 17));
    let default_span = if args.fast_demo { 5 } else { 14 };
    let from_days = args
        .from
        .as_deref()
        .and_then(date_from_iso)
        .unwrap_or_else(|| today_days.saturating_sub(default_span));
    let to_days = args
        .to
        .as_deref()
        .and_then(date_from_iso)
        .unwrap_or(today_days);
    if from_days > to_days {
        anyhow::bail!("Rango de fechas invalido: --from debe ser <= --to");
    }
    let max_span = if args.fast_demo { 7 } else { 62 };
    if to_days.saturating_sub(from_days) > max_span {
        anyhow::bail!("Rango demasiado amplio para carga selectiva: usa hasta {max_span} dias");
    }
    Ok((days_to_iso(from_days), days_to_iso(to_days)))
}

fn days_to_iso(days: u32) -> String {
    let (y, m, d) = days_to_ymd(days);
    format!("{y:04}-{m:02}-{d:02}")
}

fn iso_to_ddmmyyyy(value: &str) -> Result<String> {
    let days = date_from_iso(value).ok_or_else(|| anyhow::anyhow!("Fecha invalida: {value}"))?;
    let (y, m, d) = days_to_ymd(days);
    Ok(format!("{d:02}{m:02}{y:04}"))
}

fn build_chile_discovery_requests(
    args: &ChileSelectiveArgs,
    from: &str,
    to: &str,
    base_url_override: &str,
) -> Vec<ChileRequest> {
    let from_days = date_from_iso(from).unwrap();
    let to_days = date_from_iso(to).unwrap();
    let lic_url = chile_base_url(base_url_override, CHILE_LICITACIONES_URL);
    let oc_url = chile_base_url(base_url_override, CHILE_ORDENES_COMPRA_URL);
    let mut requests = Vec::new();
    for day in from_days..=to_days {
        let iso = days_to_iso(day);
        let fecha = iso_to_ddmmyyyy(&iso).unwrap_or_default();
        requests.push(ChileRequest::new(
            lic_url.clone(),
            "tenders",
            "tender",
            vec![("fecha".to_string(), fecha.clone())],
        ));
        requests.push(ChileRequest::new(
            oc_url.clone(),
            "purchase_orders",
            "purchase_order",
            vec![("fecha".to_string(), fecha)],
        ));
    }
    if args.fast_demo {
        requests.truncate(args.max_requests.min(6) as usize);
    }
    requests
}

fn chile_base_url(override_base: &str, default_url: &str) -> String {
    if override_base.trim().is_empty() {
        default_url.to_string()
    } else {
        let suffix = default_url
            .rsplit_once("/servicios/")
            .map(|(_, tail)| format!("/servicios/{tail}"))
            .unwrap_or_else(|| default_url.to_string());
        format!("{}{}", override_base.trim().trim_end_matches('/'), suffix)
    }
}

impl ChileRequest {
    fn new(
        base_url: impl Into<String>,
        dataset_name: &'static str,
        record_type: &'static str,
        params: Vec<(String, String)>,
    ) -> Self {
        let base_url = base_url.into();
        let cache_key_url = safe_chile_url(&base_url, &params);
        Self {
            base_url,
            dataset_name,
            record_type,
            params,
            cache_key_url,
        }
    }

    fn actual_url(&self, ticket: &str) -> String {
        let mut params = self.params.clone();
        params.push(("ticket".to_string(), ticket.to_string()));
        format!("{}?{}", self.base_url, encode_params(&params))
    }
}

fn safe_chile_url(base_url: &str, params: &[(String, String)]) -> String {
    let mut safe = params.to_vec();
    safe.push(("ticket".to_string(), "***".to_string()));
    format!("{base_url}?{}", encode_params(&safe))
}

fn encode_params(params: &[(String, String)]) -> String {
    params
        .iter()
        .map(|(k, v)| format!("{}={}", urlish(k), urlish(v)))
        .collect::<Vec<_>>()
        .join("&")
}

impl ChileHttpClient {
    fn new(
        ticket: String,
        max_requests: u64,
        delay_ms: u64,
        retry: u32,
        backoff_ms: u64,
        cache_enabled: bool,
        cache_dir: PathBuf,
    ) -> Result<Self> {
        if cache_enabled {
            fs::create_dir_all(&cache_dir)?;
        }
        Ok(Self {
            ticket,
            max_requests,
            delay: Duration::from_millis(delay_ms.max(1)),
            retry,
            backoff: Duration::from_millis(backoff_ms),
            cache_enabled,
            cache_dir,
            requests_made: 0,
            cache_hits: 0,
            cache_misses: 0,
            rate_limit_waits: 0,
            last_request_at: None,
            agent: ureq::AgentBuilder::new()
                .timeout(Duration::from_secs(30))
                .build(),
        })
    }

    fn get_json(&mut self, req: &ChileRequest) -> Result<Value> {
        if self.cache_enabled {
            if let Some(payload) = self.read_cache(req)? {
                self.cache_hits += 1;
                println!("CACHE HIT {}", req.cache_key_url);
                return Ok(payload);
            }
            self.cache_misses += 1;
            println!("CACHE MISS {}", req.cache_key_url);
        }
        if self.requests_made >= self.max_requests {
            anyhow::bail!("max_requests alcanzado ({})", self.max_requests);
        }
        self.wait_delay();
        let url = req.actual_url(&self.ticket);
        println!("API REQUEST {}", req.cache_key_url);
        let mut last_err = String::new();
        for attempt in 0..=self.retry {
            self.requests_made += 1;
            match self.agent.get(&url).call() {
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp.into_string()?;
                    let payload: Value = serde_json::from_str(&body)?;
                    if self.cache_enabled {
                        self.write_cache(req, status, &payload)?;
                    }
                    self.last_request_at = Some(Instant::now());
                    return Ok(payload);
                }
                Err(ureq::Error::Status(code, resp)) => {
                    if code == 401 || code == 403 {
                        anyhow::bail!("HTTP {code}: ticket invalido o sin permisos");
                    }
                    let body = resp.into_string().unwrap_or_default();
                    last_err = format!(
                        "HTTP {code}: {}",
                        body.chars().take(160).collect::<String>()
                    );
                    if (code == 429 || (500..600).contains(&code)) && attempt < self.retry {
                        self.rate_limit_waits += 1;
                        let factor = if code == 429 { 2 } else { 1 };
                        std::thread::sleep(self.backoff * factor);
                        continue;
                    }
                    break;
                }
                Err(err) => {
                    last_err = err.to_string();
                    if attempt < self.retry {
                        self.rate_limit_waits += 1;
                        std::thread::sleep(self.backoff);
                        continue;
                    }
                    break;
                }
            }
        }
        self.last_request_at = Some(Instant::now());
        anyhow::bail!("ChileCompra API fallo: {last_err}")
    }

    fn wait_delay(&mut self) {
        if let Some(last) = self.last_request_at {
            let elapsed = last.elapsed();
            if elapsed < self.delay {
                self.rate_limit_waits += 1;
                std::thread::sleep(self.delay - elapsed);
            }
        }
    }

    fn cache_path(&self, req: &ChileRequest) -> PathBuf {
        self.cache_dir
            .join(format!("{}.json", sha256_hex(req.cache_key_url.as_bytes())))
    }

    fn read_cache(&self, req: &ChileRequest) -> Result<Option<Value>> {
        let path = self.cache_path(req);
        if !path.is_file() {
            return Ok(None);
        }
        let mut text = String::new();
        File::open(path)?.read_to_string(&mut text)?;
        let envelope: Value = serde_json::from_str(&text)?;
        Ok(envelope.get("payload").cloned())
    }

    fn write_cache(&self, req: &ChileRequest, status_code: u16, payload: &Value) -> Result<()> {
        let envelope = serde_json::json!({
            "request_url": req.cache_key_url,
            "params": req.params,
            "fetched_at": unix_ts(),
            "status_code": status_code,
            "payload_hash": json_sha256(payload),
            "payload": payload,
        });
        let path = self.cache_path(req);
        fs::write(path, serde_json::to_vec_pretty(&envelope)?)?;
        Ok(())
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}

fn json_sha256(value: &Value) -> String {
    sha256_hex(serde_json::to_string(value).unwrap_or_default().as_bytes())
}

fn unix_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn chile_record_candidate(
    req: &ChileRequest,
    item: Value,
    args: &ChileSelectiveArgs,
) -> Option<ChileSelectedRecord> {
    let external_id = chile_external_id(&item, req.record_type)?;
    if !record_matches_filters(&item, args) {
        return None;
    }
    let score = chile_select_score(&item, args);
    Some(ChileSelectedRecord {
        record_type: req.record_type.to_string(),
        dataset_name: req.dataset_name.to_string(),
        external_id,
        source_url: req.cache_key_url.clone(),
        record: item,
        score,
    })
}

fn chile_external_id(item: &Value, record_type: &str) -> Option<String> {
    let value = if record_type == "purchase_order" {
        item.get("Codigo").or_else(|| item.get("CodigoExterno"))
    } else {
        item.get("CodigoExterno").or_else(|| item.get("Codigo"))
    }
    .and_then(Value::as_str)
    .unwrap_or("")
    .trim()
    .to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn record_matches_filters(item: &Value, args: &ChileSelectiveArgs) -> bool {
    if let Some(buyer) = &args.buyer {
        if !json_text_contains(item.get("Comprador").unwrap_or(&Value::Null), buyer) {
            return false;
        }
    }
    if let Some(keyword) = &args.keyword {
        let haystack = format!(
            "{} {} {}",
            item.get("Nombre").and_then(Value::as_str).unwrap_or(""),
            item.get("Descripcion")
                .and_then(Value::as_str)
                .unwrap_or(""),
            item.get("Items").map(Value::to_string).unwrap_or_default()
        );
        if !contains_folded(&haystack, keyword) {
            return false;
        }
    }
    if let Some(rut) = &args.supplier_rut {
        let wanted = normalize_rut_chile(rut).unwrap_or_else(|| rut.trim().to_string());
        if !contains_folded(&item.to_string(), &wanted) {
            return false;
        }
    }
    if let Some(name) = &args.supplier_name {
        let supplier_text = format!(
            "{} {}",
            item.get("Proveedor")
                .map(Value::to_string)
                .unwrap_or_default(),
            item.get("Items").map(Value::to_string).unwrap_or_default()
        );
        if !contains_folded(&supplier_text, name) {
            return false;
        }
    }
    true
}

fn json_text_contains(value: &Value, needle: &str) -> bool {
    contains_folded(&value.to_string(), needle)
}

fn contains_folded(value: &str, needle: &str) -> bool {
    value.to_lowercase().contains(&needle.to_lowercase())
}

fn chile_select_score(item: &Value, args: &ChileSelectiveArgs) -> i64 {
    let mut score = 0i64;
    let amount = chile_amount(item) as i64;
    score += (amount / 1_000_000).min(2_000);
    let status = item
        .get("Estado")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_lowercase();
    let status_code = item
        .get("CodigoEstado")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    if status.contains("adjudic") || status_code == 8 {
        score += 600;
    }
    if !chile_buyer_name(item).is_empty() {
        score += 250;
    }
    if chile_supplier_name(item).is_some() || chile_supplier_rut(item).is_some() {
        score += 450;
    }
    if chile_record_date(item).is_some() {
        score += 100;
    }
    if args
        .keyword
        .as_ref()
        .is_some_and(|k| contains_folded(&item.to_string(), k))
    {
        score += 300;
    }
    score
}

fn chile_has_graph_value(record: &ChileSelectedRecord, fast_demo: bool) -> bool {
    if !fast_demo {
        return true;
    }
    !record.external_id.is_empty()
        && !chile_buyer_name(&record.record).is_empty()
        && (chile_supplier_name(&record.record).is_some()
            || chile_supplier_rut(&record.record).is_some())
        && (chile_amount(&record.record) > 0.0)
}

fn chile_detail_request(candidate: &ChileSelectedRecord, base_url_override: &str) -> ChileRequest {
    let is_purchase_order = candidate.record_type == "purchase_order";
    let base = if is_purchase_order {
        chile_base_url(base_url_override, CHILE_ORDEN_COMPRA_URL)
    } else {
        chile_base_url(base_url_override, CHILE_LICITACIONES_URL)
    };
    ChileRequest::new(
        base,
        if is_purchase_order {
            "oc_detail"
        } else {
            "tender_detail"
        },
        if is_purchase_order {
            "purchase_order"
        } else {
            "tender"
        },
        vec![("codigo".to_string(), candidate.external_id.clone())],
    )
}

fn chile_amount(item: &Value) -> f64 {
    for key in ["MontoEstimado", "Total", "TotalNeto"] {
        if let Some(v) = item.get(key).and_then(Value::as_f64) {
            return v;
        }
        if let Some(v) = item
            .get(key)
            .and_then(Value::as_str)
            .and_then(|s| s.parse().ok())
        {
            return v;
        }
    }
    0.0
}

fn chile_buyer_name(item: &Value) -> String {
    item.get("Comprador")
        .and_then(|b| b.get("NombreOrganismo").or_else(|| b.get("NombreUnidad")))
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

fn chile_supplier_name(item: &Value) -> Option<String> {
    if let Some(name) = item
        .get("Proveedor")
        .and_then(|s| s.get("Nombre"))
        .and_then(Value::as_str)
    {
        if !name.trim().is_empty() {
            return Some(name.trim().to_string());
        }
    }
    item.get("Items")
        .and_then(|i| i.get("Listado"))
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().find_map(|item| {
                item.get("Adjudicacion")
                    .and_then(|a| a.get("NombreProveedor"))
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(str::to_string)
            })
        })
}

fn chile_supplier_rut(item: &Value) -> Option<String> {
    if let Some(rut) = item
        .get("Proveedor")
        .and_then(|s| s.get("RutSucursal").or_else(|| s.get("RutProveedor")))
        .and_then(Value::as_str)
        .and_then(normalize_rut_chile)
    {
        return Some(rut);
    }
    item.get("Items")
        .and_then(|i| i.get("Listado"))
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().find_map(|item| {
                item.get("Adjudicacion")
                    .and_then(|a| a.get("RutProveedor"))
                    .and_then(Value::as_str)
                    .and_then(normalize_rut_chile)
            })
        })
}

fn chile_record_date(item: &Value) -> Option<String> {
    item.get("Fechas").and_then(|f| {
        for key in ["FechaCreacion", "FechaEnvio", "FechaAdjudicacion"] {
            if let Some(v) = f.get(key).and_then(Value::as_str) {
                return Some(v.to_string());
            }
        }
        None
    })
}

fn upsert_chile_raw_record(client: &mut Client, record: &ChileSelectedRecord) -> Result<()> {
    let payload = serde_json::json!({
        "_record_type": record.record_type,
        "_dataset_name": record.dataset_name,
        "_source_mode": "selective_api",
        "record": record.record,
    });
    let hash = json_sha256(&payload);
    client.execute(
        "INSERT INTO raw_records (source_name, external_id, source_url, payload_hash, payload, status, processed_at) \
         VALUES ('chilecompra', $1, $2, $3, $4::text::jsonb, 'processed', now()) \
         ON CONFLICT (source_name, payload_hash) DO UPDATE SET status='processed', processed_at=now()",
        &[&record.external_id, &record.source_url, &hash, &payload.to_string()],
    )?;
    Ok(())
}

fn chile_count_graph_rows(client: &mut Client) -> Result<(u64, u64)> {
    let entities: i64 = client
        .query_one("SELECT count(*)::bigint FROM entities WHERE metadata->>'source_name' = 'chilecompra' OR external_id LIKE 'tender:%' OR external_id LIKE 'purchase_order:%' OR external_id LIKE 'buyer:%' OR external_id LIKE 'supplier:%'", &[])?
        .get(0);
    let rels: i64 = client
        .query_one(
            "SELECT count(*)::bigint FROM relationships WHERE metadata->>'source_name' = 'chilecompra'",
            &[],
        )?
        .get(0);
    Ok((entities.max(0) as u64, rels.max(0) as u64))
}

fn collect_chile_recommendations(db_url: &str) -> Result<Vec<ChileRecommendedEntity>> {
    let mut client = Client::connect(db_url, NoTls)?;
    let rows = client.query(
        r#"
        SELECT e.id, e.display_name, e.entity_type, count(r.id)::bigint AS degree
        FROM entities e
        JOIN relationships r ON r.source_entity_id = e.id OR r.target_entity_id = e.id
        WHERE e.metadata->>'source_name' = 'chilecompra'
           OR e.external_id LIKE 'tender:%'
           OR e.external_id LIKE 'purchase_order:%'
           OR e.external_id LIKE 'buyer:%'
           OR e.external_id LIKE 'supplier:%'
        GROUP BY e.id, e.display_name, e.entity_type
        ORDER BY CASE e.entity_type WHEN 'public_body' THEN 0 WHEN 'company' THEN 1 WHEN 'purchase_order' THEN 2 WHEN 'tender' THEN 3 ELSE 4 END,
                 degree DESC,
                 e.display_name
        LIMIT 8
        "#,
        &[],
    )?;
    Ok(rows
        .into_iter()
        .map(|row| ChileRecommendedEntity {
            id: row.get(0),
            display_name: row.get(1),
            entity_type: row.get(2),
        })
        .collect())
}

fn print_chile_ingestion_summary(
    stats: &ChileSelectiveStats,
    recommendations: &[ChileRecommendedEntity],
) {
    println!();
    println!("ChileCompra selective ingestion completed.");
    println!();
    println!("Requests made: {}", stats.requests_made);
    println!("Cache hits: {}", stats.cache_hits);
    println!("Cache misses: {}", stats.cache_misses);
    println!("Rate limit waits: {}", stats.rate_limit_waits);
    println!("Records fetched: {}", stats.records_fetched);
    println!("Records selected: {}", stats.records_selected);
    println!("Entities upserted: {}", stats.entities_upserted);
    println!("Relationships upserted: {}", stats.relationships_upserted);
    println!("Duplicates skipped: {}", stats.duplicates_skipped);
    println!("Failed records: {}", stats.failed_records);
    println!();
    println!("Recommended entities to test:");
    if recommendations.is_empty() {
        println!("No connected ChileCompra entities found yet.");
    }
    for (idx, rec) in recommendations.iter().take(3).enumerate() {
        println!("{}. {}", idx + 1, rec.display_name);
        println!("   id: {}", rec.id);
        println!("   type: {}", rec.entity_type);
        println!(
            "   graph: http://localhost:3001/api/graph/{}?depth=2",
            rec.id
        );
    }
}

fn print_chile_dry_run(
    requests: &[ChileRequest],
    args: &ChileSelectiveArgs,
    cache: bool,
    cache_dir: &Path,
    filters: &str,
) {
    let request_cap = requests.len().min(args.max_requests as usize);
    println!();
    println!("ChileCompra selective dry-run.");
    println!("Endpoints consultaria:");
    for req in requests.iter().take(request_cap.min(10)) {
        println!("- {}", req.cache_key_url);
    }
    if request_cap > 10 {
        println!("- ... {} endpoints mas", request_cap - 10);
    }
    println!("Requests maximas: {}", args.max_requests);
    println!("Requests estimadas discovery: {}", request_cap);
    println!(
        "Requests estimadas detalle: hasta {}",
        args.limit.min(args.max_requests)
    );
    println!("Filtros: {filters}");
    println!("Estimacion entidades/relaciones: {} registros seleccionados podrian crear ~{} entidades y ~{} relaciones", args.limit, args.limit * 3, args.limit * 4);
    println!("Usaria cache: {cache} ({})", cache_dir.display());
}

fn chile_filter_summary(args: &ChileSelectiveArgs, from: &str, to: &str, limit: u64) -> String {
    let mut parts = vec![
        format!("from={from}"),
        format!("to={to}"),
        format!("limit={limit}"),
    ];
    if args.fast_demo {
        parts.push("fast_demo=true".to_string());
    }
    if let Some(v) = &args.buyer {
        parts.push(format!("buyer={v}"));
    }
    if let Some(v) = &args.keyword {
        parts.push(format!("keyword={v}"));
    }
    if let Some(v) = &args.supplier_rut {
        parts.push(format!("supplier_rut={v}"));
    }
    if let Some(v) = &args.supplier_name {
        parts.push(format!("supplier_name={v}"));
    }
    parts.join(", ")
}

fn is_chile_auth_error(value: &str) -> bool {
    value.contains("401") || value.contains("403")
}

fn run_duplicate_diagnosis_cli(db_url: &str, fix_safe: bool) -> Result<()> {
    let mut client = Client::connect(db_url, NoTls)?;
    let mut fixes = Vec::new();
    if fix_safe {
        fixes.push(format!(
            "entity_identifiers exact rows removed: {}",
            delete_duplicate_entity_identifiers_same_entity(&mut client)?
        ));
        fixes.push(format!(
            "relationships exact rows removed: {}",
            delete_duplicate_relationships_exact(&mut client)?
        ));
        fixes.push(format!(
            "raw_records exact rows removed: {}",
            delete_duplicate_raw_records_exact(&mut client)?
        ));
    }
    println!("Duplicate diagnosis completed.");
    println!();
    print_entity_identifier_duplicates(&mut client)?;
    print_entity_name_duplicates(&mut client)?;
    print_relationship_duplicates(&mut client)?;
    print_raw_record_duplicates(&mut client)?;
    print_source_duplicates(&mut client)?;
    if fix_safe {
        println!();
        println!("Fix-safe applied:");
        for fix in fixes {
            println!("- {fix}");
        }
    }
    println!();
    println!("Recommended actions:");
    println!("1. Keep unique index on entity_identifiers(scheme, value, country_code)");
    println!("2. Prefer upsert_entity_by_identifier() before name fallback");
    println!("3. Merge duplicate entities manually or with a reviewed migration; --fix-safe does not merge ambiguous entities");
    Ok(())
}

fn print_entity_identifier_duplicates(client: &mut Client) -> Result<()> {
    println!("Entity identifier duplicates:");
    let rows = client.query(
        "SELECT scheme, value, country_code, count(*)::bigint, array_agg(entity_id ORDER BY entity_id)::text \
         FROM entity_identifiers GROUP BY scheme, value, country_code HAVING count(*) > 1 \
         ORDER BY count(*) DESC, scheme, value LIMIT 20",
        &[],
    )?;
    if rows.is_empty() {
        println!("- none");
    }
    for row in rows {
        println!(
            "- {} / {} / {}: {} entities {}",
            row.get::<_, String>(0),
            row.get::<_, String>(1),
            row.get::<_, String>(2),
            row.get::<_, i64>(3),
            row.get::<_, String>(4)
        );
    }
    println!();
    Ok(())
}

fn print_entity_name_duplicates(client: &mut Client) -> Result<()> {
    println!("Entity name duplicates:");
    let rows = client.query(
        "SELECT canonical_name, entity_type, country_code, count(*)::bigint, array_agg(id ORDER BY id)::text \
         FROM entities GROUP BY canonical_name, entity_type, country_code HAVING count(*) > 1 \
         ORDER BY count(*) DESC, canonical_name LIMIT 20",
        &[],
    )?;
    if rows.is_empty() {
        println!("- none");
    }
    for row in rows {
        println!(
            "- \"{}\" / {} / {}: {} entities {}",
            row.get::<_, String>(0),
            row.get::<_, String>(1),
            row.get::<_, String>(2),
            row.get::<_, i64>(3),
            row.get::<_, String>(4)
        );
    }
    println!();
    Ok(())
}

fn print_relationship_duplicates(client: &mut Client) -> Result<()> {
    println!("Relationship duplicates:");
    let rows = client.query(
        r#"
        SELECT source_entity_id, target_entity_id, relationship_type, source_id,
               COALESCE(metadata->>'external_id', metadata->>'infolobby_audience_id', metadata->>'chilecompra_code', metadata->>'external_code', ''),
               count(*)::bigint,
               array_agg(id ORDER BY id)::text
        FROM relationships
        GROUP BY source_entity_id, target_entity_id, relationship_type, source_id,
                 COALESCE(metadata->>'external_id', metadata->>'infolobby_audience_id', metadata->>'chilecompra_code', metadata->>'external_code', '')
        HAVING count(*) > 1
        ORDER BY count(*) DESC
        LIMIT 20
        "#,
        &[],
    )?;
    if rows.is_empty() {
        println!("- none");
    }
    for row in rows {
        println!(
            "- source={} target={} type={} source_id={:?} external={} count={} ids={}",
            row.get::<_, i32>(0),
            row.get::<_, i32>(1),
            row.get::<_, String>(2),
            row.get::<_, Option<i32>>(3),
            row.get::<_, String>(4),
            row.get::<_, i64>(5),
            row.get::<_, String>(6)
        );
    }
    println!();
    Ok(())
}

fn print_raw_record_duplicates(client: &mut Client) -> Result<()> {
    println!("Raw record duplicates:");
    let rows = client.query(
        "SELECT source_name, COALESCE(payload->>'_dataset_name', payload->>'dataset_name', ''), COALESCE(external_id, ''), payload_hash, count(*)::bigint, array_agg(id ORDER BY id)::text \
         FROM raw_records GROUP BY source_name, COALESCE(payload->>'_dataset_name', payload->>'dataset_name', ''), COALESCE(external_id, ''), payload_hash \
         HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 20",
        &[],
    )?;
    if rows.is_empty() {
        println!("- none");
    }
    for row in rows {
        println!(
            "- {} / {} / {} / {} count={} ids={}",
            row.get::<_, String>(0),
            row.get::<_, String>(1),
            row.get::<_, String>(2),
            row.get::<_, String>(3),
            row.get::<_, i64>(4),
            row.get::<_, String>(5)
        );
    }
    println!();
    Ok(())
}

fn print_source_duplicates(client: &mut Client) -> Result<()> {
    println!("Source duplicates:");
    client
        .batch_execute("SET statement_timeout = '2500ms'")
        .ok();
    let rows = match client.query(
        "WITH grouped AS ( \
            SELECT source_name, external_id, count(*)::bigint AS n, min(id) AS first_id \
            FROM sources \
            WHERE source_name IN ('chilecompra', 'infolobby', 'offshore') AND external_id IS NOT NULL AND external_id <> '' \
            GROUP BY source_name, external_id HAVING count(*) > 1 \
            ORDER BY count(*) DESC LIMIT 20 \
         ) \
         SELECT g.source_name, COALESCE(s.source_url, ''), g.external_id, g.n, \
                (SELECT array_agg(id ORDER BY id)::text FROM (SELECT id FROM sources sx WHERE sx.source_name=g.source_name AND sx.external_id=g.external_id ORDER BY id LIMIT 200) limited_ids) \
         FROM grouped g JOIN sources s ON s.id = g.first_id",
        &[],
    ) {
        Ok(rows) => rows,
        Err(err) => {
            println!(
                "- skipped: sources duplicate scan exceeded safe demo budget or failed: {}",
                pg_error_detail(&err.into())
            );
            println!("- suggested index: sources(source_name, external_id)");
            client.batch_execute("SET statement_timeout = 0").ok();
            return Ok(());
        }
    };
    if rows.is_empty() {
        println!("- none");
    }
    for row in rows {
        println!(
            "- {} / {} / {} count={} ids={}",
            row.get::<_, String>(0),
            trunc(&row.get::<_, String>(1), 80),
            row.get::<_, String>(2),
            row.get::<_, i64>(3),
            row.get::<_, String>(4)
        );
    }
    client.batch_execute("SET statement_timeout = 0").ok();
    Ok(())
}

fn delete_duplicate_entity_identifiers_same_entity(client: &mut Client) -> Result<u64> {
    let n = client.execute(
        r#"
        DELETE FROM entity_identifiers d
        USING entity_identifiers keep
        WHERE d.id > keep.id
          AND d.entity_id = keep.entity_id
          AND d.scheme = keep.scheme
          AND d.value = keep.value
          AND d.country_code = keep.country_code
        "#,
        &[],
    )?;
    Ok(n)
}

fn delete_duplicate_relationships_exact(client: &mut Client) -> Result<u64> {
    let n = client.execute(
        r#"
        DELETE FROM relationships d
        USING relationships keep
        WHERE d.id > keep.id
          AND d.source_entity_id = keep.source_entity_id
          AND d.target_entity_id = keep.target_entity_id
          AND d.relationship_type = keep.relationship_type
          AND d.source_id IS NOT DISTINCT FROM keep.source_id
          AND d.metadata = keep.metadata
        "#,
        &[],
    )?;
    Ok(n)
}

fn delete_duplicate_raw_records_exact(client: &mut Client) -> Result<u64> {
    let n = client.execute(
        r#"
        DELETE FROM raw_records d
        USING raw_records keep
        WHERE d.id > keep.id
          AND d.source_name = keep.source_name
          AND d.payload_hash = keep.payload_hash
          AND COALESCE(d.external_id, '') = COALESCE(keep.external_id, '')
          AND d.payload = keep.payload
        "#,
        &[],
    )?;
    Ok(n)
}

fn run_offshore_rust(opts: OffshoreOptions, tx: Sender<Msg>) -> Result<OffshoreRunSummary> {
    let run_token = uuid::Uuid::new_v4().to_string().replace('-', "_");
    let mut client = Client::connect(&opts.db_url, NoTls)?;
    client.batch_execute(
        "SET statement_timeout = 0; SET work_mem = '512MB'; SET search_path = pg_temp, public;",
    )?;
    let run_id: i32 = client
        .query_one(
            "INSERT INTO ingestion_runs (source_name, status, metadata) VALUES ('offshore', 'running', $1::text::jsonb) RETURNING id",
            &[&serde_json::json!({"mode":opts.mode,"country_codes":opts.country_codes,"limit":opts.limit,"run_token":run_token,"cleanup":opts.cleanup}).to_string()],
        )?
        .get(0);
    let result = (|| -> Result<(u64, OffshoreRunSummary)> {
        if opts.cleanup {
            cleanup_offshore(&mut client)?;
            emit_offshore(
                &tx,
                serde_json::json!({"phase":"cleanup","stage":"cleanup"}),
            )?;
        }
        let (tables, copied) = if opts.limit.is_some() {
            copy_offshore_csvs_selective(
                &mut client,
                &opts.data_dir,
                &opts.country_codes,
                opts.limit,
                &tx,
            )?
        } else {
            copy_offshore_csvs(&mut client, &opts.data_dir, &tx)?
        };
        let stats = normalize_offshore_sql(
            &mut client,
            &tables,
            &opts.country_codes,
            opts.limit,
            &run_token,
            opts.idempotent_sources,
            &tx,
        )?;
        finish_simple_run(
            &mut client,
            run_id,
            "completed",
            copied,
            stats.relationships_selected,
            None,
        )?;
        emit_offshore(
            &tx,
            serde_json::json!({"phase":"done","stage":"done","status":"completed","records_fetched":copied,"records_processed":stats.relationships_selected,"total":stats.relationships_selected}),
        )?;
        Ok((copied, stats))
    })();
    match result {
        Ok((_, stats)) => Ok(stats),
        Err(err) => {
            let _ = finish_simple_run(&mut client, run_id, "failed", 0, 0, Some(&err.to_string()));
            Err(err)
        }
    }
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

fn copy_offshore_csvs_selective(
    client: &mut Client,
    data_dir: &Path,
    country_codes: &[String],
    limit: Option<u64>,
    tx: &Sender<Msg>,
) -> Result<(HashMap<String, String>, u64)> {
    let run_token = uuid::Uuid::new_v4().to_string().replace('-', "_");
    let mut tables = HashMap::new();
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
        client.batch_execute(&format!("CREATE TEMP TABLE {table} (_seq bigint, {cols})"))?;
        tables.insert(file_name.to_string(), table);
    }

    let seed_nodes = collect_offshore_seed_nodes(data_dir, country_codes)?;
    let rel_headers = headers_for_offshore("relationships.csv");
    let relationships = select_offshore_relationship_rows(
        &data_dir.join("relationships.csv"),
        &rel_headers,
        &seed_nodes,
        limit.unwrap_or(1_000),
    )?;
    let mut selected_nodes = HashSet::new();
    for (_, row) in &relationships {
        selected_nodes.insert(csv_value(&rel_headers, row, "node_id_start").to_string());
        selected_nodes.insert(csv_value(&rel_headers, row, "node_id_end").to_string());
    }

    let rel_table = tables.get("relationships.csv").unwrap();
    let mut total = copy_selected_utf8_csv_text(
        client,
        rel_table,
        &rel_headers,
        relationships.iter().map(|(seq, row)| (*seq, row)),
    )?;
    client.batch_execute(&format!(
        "CREATE INDEX ON {rel_table} (node_id_start); CREATE INDEX ON {rel_table} (node_id_end)"
    ))?;
    emit_offshore(
        tx,
        serde_json::json!({"phase":"copy selected rows","stage":"copy selected rows","file":"relationships.csv","file_rows":relationships.len(),"records_fetched":total,"records_processed":total,"total_rows":total}),
    )?;

    for (file_name, headers) in offshore_headers()
        .into_iter()
        .filter(|(file_name, _)| *file_name != "relationships.csv")
    {
        let table = tables.get(file_name).unwrap();
        let copied = copy_offshore_node_subset(
            client,
            &data_dir.join(file_name),
            table,
            &headers,
            &selected_nodes,
        )?;
        total += copied;
        client.batch_execute(&format!("CREATE INDEX ON {table} (node_id)"))?;
        emit_offshore(
            tx,
            serde_json::json!({"phase":"copy selected rows","stage":"copy selected rows","file":file_name,"file_rows":copied,"records_fetched":total,"records_processed":total,"total_rows":total}),
        )?;
    }
    Ok((tables, total))
}

fn headers_for_offshore(file_name: &str) -> Vec<&'static str> {
    offshore_headers()
        .into_iter()
        .find(|(name, _)| *name == file_name)
        .map(|(_, headers)| headers)
        .unwrap_or_default()
}

fn collect_offshore_seed_nodes(
    data_dir: &Path,
    country_codes: &[String],
) -> Result<HashSet<String>> {
    let wanted = country_codes
        .iter()
        .map(|v| v.trim().to_uppercase())
        .filter(|v| !v.is_empty())
        .collect::<HashSet<_>>();
    let mut seed_nodes = HashSet::new();
    for (file_name, headers) in offshore_headers()
        .into_iter()
        .filter(|(file_name, _)| *file_name != "relationships.csv")
    {
        let path = data_dir.join(file_name);
        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_path(&path)?;
        validate_infolobby_headers(&mut rdr, &path, &headers)?;
        for row in rdr.records() {
            let row = row?;
            let node_id = csv_value(&headers, &row, "node_id");
            if node_id.is_empty() {
                continue;
            }
            if offshore_country_matches(csv_value(&headers, &row, "country_codes"), &wanted) {
                seed_nodes.insert(node_id.to_string());
            }
        }
    }
    Ok(seed_nodes)
}

fn select_offshore_relationship_rows(
    path: &Path,
    headers: &[&str],
    seed_nodes: &HashSet<String>,
    limit: u64,
) -> Result<Vec<(u64, csv::StringRecord)>> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(path)?;
    validate_infolobby_headers(&mut rdr, path, headers)?;
    let mut selected = Vec::new();
    for (idx, row) in rdr.records().enumerate() {
        if selected.len() as u64 >= limit {
            break;
        }
        let row = row?;
        let start = csv_value(headers, &row, "node_id_start");
        let end = csv_value(headers, &row, "node_id_end");
        if seed_nodes.contains(start) || seed_nodes.contains(end) {
            selected.push((idx as u64 + 1, row));
        }
    }
    Ok(selected)
}

fn copy_offshore_node_subset(
    client: &mut Client,
    path: &Path,
    table: &str,
    headers: &[&str],
    selected_nodes: &HashSet<String>,
) -> Result<u64> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(path)?;
    validate_infolobby_headers(&mut rdr, path, headers)?;
    let mut rows = Vec::new();
    for (idx, row) in rdr.records().enumerate() {
        let row = row?;
        if selected_nodes.contains(csv_value(headers, &row, "node_id")) {
            rows.push((idx as u64 + 1, row));
        }
    }
    copy_selected_utf8_csv_text(
        client,
        table,
        headers,
        rows.iter().map(|(seq, row)| (*seq, row)),
    )
}

fn copy_selected_utf8_csv_text<'a, I>(
    client: &mut Client,
    table: &str,
    headers: &[&str],
    rows: I,
) -> Result<u64>
where
    I: IntoIterator<Item = (u64, &'a csv::StringRecord)>,
{
    let copy_sql = format!(
        "COPY {table} (_seq, {}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')",
        headers
            .iter()
            .map(|h| format!("\"{}\"", h.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(", ")
    );
    let mut writer = client.copy_in(&copy_sql)?;
    let mut copied = 0;
    for (seq, row) in rows {
        let mut line = seq.to_string();
        for idx in 0..headers.len() {
            line.push('\t');
            line.push_str(&copy_text_cell(row.get(idx).unwrap_or("")));
        }
        line.push('\n');
        writer.write_all(line.as_bytes())?;
        copied += 1;
    }
    writer.finish()?;
    Ok(copied)
}

fn offshore_country_matches(value: &str, wanted: &HashSet<String>) -> bool {
    value
        .split([',', ';', '|'])
        .map(|v| v.trim().to_uppercase())
        .any(|code| !code.is_empty() && wanted.contains(&code))
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
    idempotent_sources: bool,
    tx: &Sender<Msg>,
) -> Result<OffshoreRunSummary> {
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
    insert_offshore_graph(client, run_token, idempotent_sources)?;
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
    Ok(OffshoreRunSummary {
        nodes_selected: selected_nodes as u64,
        relationships_selected: selected_relationships as u64,
        entities_upserted: selected_nodes as u64,
        relationships_upserted: selected_relationships as u64,
    })
}

fn insert_offshore_graph(
    client: &mut Client,
    run_token: &str,
    idempotent_sources: bool,
) -> Result<()> {
    if idempotent_sources {
        return insert_offshore_graph_idempotent(client, run_token);
    }
    client.execute(
        r#"WITH node_rows AS (
            SELECT 'offshore:node:' || n.node_id AS stable_key, n.* FROM tmp_offshore_nodes n JOIN tmp_offshore_selected_nodes s ON s.node_id = n.node_id
        ), inserted AS (
            INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata)
            SELECT 'offshore','public_dataset',$1,stable_key,$2,jsonb_strip_nulls(jsonb_build_object('record_type','node','node_id',node_id,'node_kind',node_kind,'sourceID',NULLIF(source_id_raw,''),'country_codes',NULLIF(country_codes,''),'countries',NULLIF(countries,''),'run_id',$3::text))
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
            SELECT 'offshore','public_dataset',$1,stable_key,$2,jsonb_strip_nulls(jsonb_build_object('record_type','relationship','row_number',seq+1,'node_id_start',node_id_start,'node_id_end',node_id_end,'rel_type',rel_type,'link',NULLIF(link,''),'status',NULLIF(status,''),'start_date',NULLIF(start_date,''),'end_date',NULLIF(end_date,''),'sourceID',NULLIF(source_id_raw,''),'run_id',$3::text))
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

fn insert_offshore_graph_idempotent(client: &mut Client, run_token: &str) -> Result<()> {
    client.execute(
        r#"WITH node_rows AS (
            SELECT 'offshore:node:' || n.node_id AS stable_key, n.* FROM tmp_offshore_nodes n JOIN tmp_offshore_selected_nodes s ON s.node_id = n.node_id
        ), existing AS (
            SELECT DISTINCT ON (s.external_id) s.external_id, s.id
            FROM sources s JOIN node_rows n ON n.stable_key = s.external_id
            WHERE s.source_name = 'offshore'
            ORDER BY s.external_id, s.id
        ), missing AS (
            INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata)
            SELECT 'offshore','public_dataset',$1,n.stable_key,$2,jsonb_strip_nulls(jsonb_build_object('record_type','node','node_id',node_id,'node_kind',node_kind,'sourceID',NULLIF(source_id_raw,''),'country_codes',NULLIF(country_codes,''),'countries',NULLIF(countries,''),'run_id',$3::text))
            FROM node_rows n
            WHERE NOT EXISTS (SELECT 1 FROM existing e WHERE e.external_id = n.stable_key)
            RETURNING id, external_id
        ), source_ids AS (
            SELECT external_id, id FROM existing
            UNION ALL
            SELECT external_id, id FROM missing
        )
        INSERT INTO tmp_offshore_source_map
        SELECT 'node', external_id, id FROM source_ids;"#,
        &[&OFFSHORE_SOURCE_URL, &OFFSHORE_LICENSE, &run_token],
    )?;
    client.execute(
        r#"WITH rel_rows AS (
            SELECT 'offshore:relationship:' || node_id_start || ':' || node_id_end || ':' || rel_type || ':' || seq::text AS stable_key, * FROM tmp_offshore_selected_relationships
        ), existing AS (
            SELECT DISTINCT ON (s.external_id) s.external_id, s.id
            FROM sources s JOIN rel_rows r ON r.stable_key = s.external_id
            WHERE s.source_name = 'offshore'
            ORDER BY s.external_id, s.id
        ), missing AS (
            INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata)
            SELECT 'offshore','public_dataset',$1,r.stable_key,$2,jsonb_strip_nulls(jsonb_build_object('record_type','relationship','row_number',seq+1,'node_id_start',node_id_start,'node_id_end',node_id_end,'rel_type',rel_type,'link',NULLIF(link,''),'status',NULLIF(status,''),'start_date',NULLIF(start_date,''),'end_date',NULLIF(end_date,''),'sourceID',NULLIF(source_id_raw,''),'run_id',$3::text))
            FROM rel_rows r
            WHERE NOT EXISTS (SELECT 1 FROM existing e WHERE e.external_id = r.stable_key)
            RETURNING id, external_id
        ), source_ids AS (
            SELECT external_id, id FROM existing
            UNION ALL
            SELECT external_id, id FROM missing
        )
        INSERT INTO tmp_offshore_source_map
        SELECT 'relationship', external_id, id FROM source_ids;"#,
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
        UPDATE entities e
        SET display_name = n.display_name,
            canonical_name = n.canonical_name,
            entity_type = n.entity_type,
            metadata = COALESCE(e.metadata, '{}'::jsonb) || COALESCE(n.metadata, '{}'::jsonb),
            risk_score = GREATEST(COALESCE(e.risk_score, 0), CASE WHEN n.node_kind IN ('entity', 'intermediary') THEN 30 ELSE 15 END),
            updated_at = now()
        FROM tmp_offshore_nodes n JOIN tmp_offshore_selected_nodes s ON s.node_id = n.node_id
        WHERE e.external_id = 'offshore:' || n.node_id;
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
    cleanup: bool,
    idempotent_sources: bool,
    fast_demo_relationships: bool,
}

struct InfolobbyCopyTotals {
    copied: u64,
    skipped: u64,
    extra_columns: u64,
}

fn run_infolobby_rust(opts: InfolobbyOptions, tx: Sender<Msg>) -> Result<InfolobbyRunSummary> {
    let selected = selected_infolobby_files(&opts.files)?;
    let mut client = Client::connect(&opts.db_url, NoTls)?;
    client.batch_execute(
        "SET statement_timeout = 0; SET work_mem = '512MB'; SET search_path = pg_temp, public",
    )?;
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

    let result = (|| -> Result<(InfolobbyCopyTotals, NormalizeStats)> {
        let expected = if opts.skip_count {
            0
        } else {
            count_infolobby_rows(&opts, &selected, &tx)?
        };
        if opts.cleanup {
            cleanup_infolobby(&mut client)?;
            emit(
                &tx,
                serde_json::json!({"phase":"cleanup","stage":"cleanup","total":expected,"total_rows":expected}),
            )?;
        }
        let totals = copy_infolobby_files(&mut client, &opts, &selected, &tables, expected, &tx)?;
        let stats = normalize_infolobby(
            &mut client,
            &tables,
            &run_token,
            opts.skip_raw_records,
            opts.idempotent_sources,
            opts.fast_demo_relationships,
            &tx,
        )?;
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
        Ok((totals, stats))
    })();

    match result {
        Ok((totals, stats)) => Ok(InfolobbyRunSummary {
            audiences_selected: opts.limit.unwrap_or(0),
            rows_copied: totals.copied,
            entities_upserted: stats.entities_upserted,
            relationships_upserted: stats.relationships_upserted,
        }),
        Err(err) => {
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
            Err(err)
        }
    }
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
    idempotent_sources: bool,
    fast_demo_relationships: bool,
    tx: &Sender<Msg>,
) -> Result<NormalizeStats> {
    create_infolobby_candidate_tables(client)?;
    client.batch_execute(sql_helpers())?;
    for (file_name, table) in tables {
        insert_sources_for_table(client, file_name, table, run_token, idempotent_sources)?;
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
    if fast_demo_relationships {
        add_infolobby_fast_demo_relationships(client, tables)?;
    }
    let entities_upserted: i64 = client
        .query_one(
            "SELECT count(DISTINCT key) FROM tmp_infolobby_entity_candidates WHERE key IS NOT NULL AND key <> ''",
            &[],
        )?
        .get(0);
    if fast_demo_relationships {
        client.batch_execute(
            r#"
            UPDATE tmp_infolobby_relationship_candidates
            SET relationship_type = CASE relationship_type
                    WHEN 'attended_lobby_audience' THEN 'attended'
                    WHEN 'attended_audience_as_public_official' THEN 'attended'
                    WHEN 'attended_audience_other' THEN 'attended'
                    WHEN 'registered_lobby_audience' THEN 'registered_by'
                    WHEN 'represents_in_audience' THEN 'represented'
                    WHEN 'represented_in_audience' THEN 'represented_in'
                    WHEN 'works_for' THEN 'employed_by'
                    WHEN 'holds_public_role' THEN 'employed_by'
                    ELSE relationship_type
                END,
                label = CASE relationship_type
                    WHEN 'attended_lobby_audience' THEN 'Asiste a audiencia'
                    WHEN 'attended_audience_as_public_official' THEN 'Asiste a audiencia'
                    WHEN 'attended_audience_other' THEN 'Asiste a audiencia'
                    WHEN 'registered_lobby_audience' THEN 'Registrada por'
                    WHEN 'represents_in_audience' THEN 'Representa'
                    WHEN 'represented_in_audience' THEN 'Representado en audiencia'
                    WHEN 'works_for' THEN 'Trabaja para'
                    WHEN 'holds_public_role' THEN 'Empleado por'
                    ELSE label
                END
            "#,
        )?;
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
        return Ok(NormalizeStats {
            entities_upserted: entities_upserted as u64,
            relationships_upserted: inserted,
        });
    }
    Ok(NormalizeStats {
        entities_upserted: entities_upserted as u64,
        relationships_upserted: inserted,
    })
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
    idempotent: bool,
) -> Result<()> {
    let record_type = record_type(file_name);
    let source_expr = source_external_expr(file_name);
    let sql = if idempotent {
        format!(
            r#"
        INSERT INTO tmp_infolobby_source_rows (file_name, seq, external_id)
        SELECT '{file_name}', _seq, COALESCE({source_expr}, '{file_name}:row:' || (_seq + 1)::text)
        FROM {table};

        WITH row_keys AS (
            SELECT DISTINCT ON (external_id) external_id, file_name, seq
            FROM tmp_infolobby_source_rows
            WHERE file_name = '{file_name}'
            ORDER BY external_id, seq
        ), existing AS (
            SELECT DISTINCT ON (s.external_id) s.external_id, s.id
            FROM sources s JOIN row_keys r ON r.external_id = s.external_id
            WHERE s.source_name = 'infolobby'
            ORDER BY s.external_id, s.id
        ), missing AS (
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
            FROM row_keys r
            WHERE NOT EXISTS (SELECT 1 FROM existing e WHERE e.external_id = r.external_id)
            RETURNING id, external_id
        ), source_ids AS (
            SELECT external_id, id FROM existing
            UNION ALL
            SELECT external_id, id FROM missing
        )
        INSERT INTO tmp_infolobby_source_map (file_name, seq, source_id)
        SELECT r.file_name, r.seq, s.id
        FROM tmp_infolobby_source_rows r
        JOIN source_ids s ON s.external_id = r.external_id
        WHERE r.file_name = '{file_name}';
        "#
        )
    } else {
        format!(
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
        )
    };
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

fn add_infolobby_fast_demo_relationships(
    client: &mut Client,
    tables: &HashMap<String, String>,
) -> Result<()> {
    let Some(active_table) = tables.get("asistenciasActivos.csv") else {
        return Ok(());
    };
    let Some(passive_table) = tables.get("asistenciasPasivos.csv") else {
        return Ok(());
    };
    let sql = format!(
        r#"
        INSERT INTO tmp_infolobby_relationship_candidates
        SELECT 'asistenciasActivos.csv',
               a._seq,
               person_key('active', a."codigoActivo", a."activo"),
               person_key('passive', p."codigoPasivo", p."pasivo"),
               'met_with',
               'Se reunio con',
               row_metadata('asistenciasActivos.csv', a._seq, jsonb_build_object(
                   'codigoAudiencia', a."codigoAudiencia",
                   'activo', a."activo",
                   'pasivo', p."pasivo",
                   'organismo', p."organismo"
               ))
        FROM {active_table} a
        JOIN {passive_table} p ON clean_code(a."codigoAudiencia") = clean_code(p."codigoAudiencia")
        WHERE clean_code(a."codigoAudiencia") <> ''
          AND person_key('active', a."codigoActivo", a."activo") IS NOT NULL
          AND person_key('passive', p."codigoPasivo", p."pasivo") IS NOT NULL;
        "#
    );
    client.batch_execute(&qualify_helpers(&sql))?;
    Ok(())
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
const CHILE_LICITACIONES_URL: &str =
    "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";
const CHILE_ORDENES_COMPRA_URL: &str =
    "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json";
const CHILE_ORDEN_COMPRA_URL: &str =
    "https://api.mercadopublico.cl/servicios/v1/publico/OrdenCompra.json";

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
    let h: u32 = parts
        .next()
        .and_then(|p| p.trim().parse().ok())
        .unwrap_or(0);
    let m: u32 = parts
        .next()
        .and_then(|p| p.trim().parse().ok())
        .unwrap_or(0);
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
    if parts.len() != 3 {
        return None;
    }
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

fn is_night_window_chile(_night_start: &str, _night_end: &str) -> bool {
    return true;
}

fn seconds_until_night_start_chile(night_start: &str) -> u64 {
    let current = current_minutes_santiago() as i64;
    let start = parse_time_hhmm(night_start) as i64;
    let diff = if start > current {
        start - current
    } else {
        1440 - current + start
    };
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
                    std::thread::sleep(std::time::Duration::from_secs_f64(
                        1.5 * 2f64.powi(attempt as i32),
                    ));
                    continue;
                }
            }
            Err(e) => {
                last_err = e.to_string();
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_secs_f64(
                        1.5 * 2f64.powi(attempt as i32),
                    ));
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
    let listado = payload
        .get("Listado")
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
    let status = item
        .get("Estado")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let status_code = item
        .get("CodigoEstado")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let amount = item
        .get("MontoEstimado")
        .or_else(|| item.get("Total"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let buyer = item
        .get("Comprador")
        .and_then(|b| b.get("NombreOrganismo"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let mut priority = 100i32;
    if status.contains("adjudic") || status_code == 8 {
        priority -= 40;
    }
    if amount >= 1_000_000_000.0 {
        priority -= 30;
    } else if amount >= 100_000_000.0 {
        priority -= 15;
    }
    for term in [
        "municipalidad",
        "salud",
        "hospital",
        "obras publicas",
        "gobierno regional",
    ] {
        if buyer.contains(term) {
            priority -= 10;
            break;
        }
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
                let listado = payload
                    .get("Listado")
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
                    let safe_url = source_url
                        .as_deref()
                        .unwrap_or("https://api.mercadopublico.cl/");
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

fn normalize_tender(
    client: &mut postgres::Client,
    p: &serde_json::Value,
    source_url: &str,
) -> Result<()> {
    let code = p
        .get("CodigoExterno")
        .or_else(|| p.get("Codigo"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let tender_key = format!("tender:{code}");
    let tender_name = p
        .get("Nombre")
        .and_then(|v| v.as_str())
        .unwrap_or(&format!("Licitacion {code}"))
        .to_string();
    let buyer = p.get("Comprador").cloned().unwrap_or_default();
    let amount = p
        .get("MontoEstimado")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let risk = chile_risk_score(amount);

    let source_id = upsert_chile_source(client, &code, source_url, "tender")?;
    let tender_id = upsert_chile_entity(
        client,
        &tender_key,
        &tender_name,
        "tender",
        risk,
        &serde_json::json!({"source_name":"chilecompra","status":p.get("Estado"),"status_code":p.get("CodigoEstado"),"estimated_amount":p.get("MontoEstimado"),"currency":p.get("Moneda")}),
        &[("CHILECOMPRA_TENDER_CODE".to_string(), code.clone())],
    )?;
    let buyer_id = upsert_chile_buyer(client, &buyer)?;
    insert_chile_rel(
        client,
        buyer_id,
        tender_id,
        "issued",
        "Organismo comprador publica licitacion",
        source_id,
    )?;

    // Suppliers from item adjudications
    let items = p
        .get("Items")
        .and_then(|i| i.get("Listado"))
        .and_then(|v| v.as_array());
    if let Some(items) = items {
        for item in items {
            let adj = item.get("Adjudicacion").cloned().unwrap_or_default();
            let sup_name = adj.get("NombreProveedor").and_then(|v| v.as_str());
            let sup_rut = normalize_rut_chile(
                adj.get("RutProveedor")
                    .and_then(|v| v.as_str())
                    .unwrap_or(""),
            );
            if sup_name.is_none() && sup_rut.is_none() {
                continue;
            }
            let sup_key = format!(
                "supplier:{}",
                sup_rut
                    .as_deref()
                    .unwrap_or_else(|| sup_name.unwrap_or("unknown"))
            );
            let sup_name_str = sup_name.unwrap_or("Proveedor sin nombre").to_string();
            let sup_id = upsert_chile_entity(
                client,
                &sup_key,
                &sup_name_str,
                "company",
                25,
                &serde_json::json!({"source_name":"chilecompra"}),
                &sup_rut
                    .iter()
                    .map(|r| ("CL_RUT".to_string(), r.clone()))
                    .collect::<Vec<_>>(),
            )?;
            insert_chile_rel(
                client,
                tender_id,
                sup_id,
                "awarded_to",
                "Linea adjudicada a proveedor",
                source_id,
            )?;
        }
    }
    Ok(())
}

fn normalize_purchase_order(
    client: &mut postgres::Client,
    p: &serde_json::Value,
    source_url: &str,
) -> Result<()> {
    let code = p
        .get("Codigo")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let po_key = format!("purchase_order:{code}");
    let po_name = p
        .get("Nombre")
        .and_then(|v| v.as_str())
        .unwrap_or(&format!("OC {code}"))
        .to_string();
    let buyer = p.get("Comprador").cloned().unwrap_or_default();
    let supplier = p.get("Proveedor").cloned().unwrap_or_default();
    let amount = p.get("Total").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let risk = chile_risk_score(amount);

    let source_id = upsert_chile_source(client, &code, source_url, "purchase_order")?;
    let po_id = upsert_chile_entity(
        client,
        &po_key,
        &po_name,
        "purchase_order",
        risk,
        &serde_json::json!({"source_name":"chilecompra","status_code":p.get("CodigoEstado"),"total":p.get("Total"),"currency":p.get("TipoMoneda"),"tender_code":p.get("CodigoLicitacion")}),
        &[("CHILECOMPRA_OC_CODE".to_string(), code.clone())],
    )?;
    let buyer_id = upsert_chile_buyer(client, &buyer)?;
    let sup_rut = normalize_rut_chile(
        supplier
            .get("RutSucursal")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
    );
    let sup_name = supplier
        .get("Nombre")
        .and_then(|v| v.as_str())
        .unwrap_or("Proveedor")
        .to_string();
    let sup_key = format!("supplier:{}", sup_rut.as_deref().unwrap_or(&sup_name));
    let sup_id = upsert_chile_entity(
        client,
        &sup_key,
        &sup_name,
        "company",
        25,
        &serde_json::json!({"source_name":"chilecompra","commune":supplier.get("Comuna"),"region":supplier.get("Region")}),
        &sup_rut
            .iter()
            .map(|r| ("CL_RUT".to_string(), r.clone()))
            .collect::<Vec<_>>(),
    )?;
    insert_chile_rel(
        client,
        buyer_id,
        po_id,
        "issued",
        "Orden emitida por organismo",
        source_id,
    )?;
    insert_chile_rel(
        client,
        po_id,
        sup_id,
        "awarded_to",
        "Orden de compra a proveedor",
        source_id,
    )?;
    insert_chile_rel(
        client,
        buyer_id,
        sup_id,
        "purchased_from",
        "Organismo compra a proveedor",
        source_id,
    )?;

    // Link to tender if referenced
    if let Some(tender_code) = p.get("CodigoLicitacion").and_then(|v| v.as_str()) {
        if !tender_code.is_empty() {
            let tender_key = format!("tender:{tender_code}");
            let tender_name = format!("Licitacion {tender_code}");
            let tender_id = upsert_chile_entity(
                client,
                &tender_key,
                &tender_name,
                "tender",
                0,
                &serde_json::json!({"source_name":"chilecompra"}),
                &[(
                    "CHILECOMPRA_TENDER_CODE".to_string(),
                    tender_code.to_string(),
                )],
            )?;
            insert_chile_rel(
                client,
                po_id,
                tender_id,
                "related_to",
                "Orden asociada a licitacion",
                source_id,
            )?;
        }
    }
    Ok(())
}

fn upsert_chile_buyer(client: &mut postgres::Client, buyer: &serde_json::Value) -> Result<i32> {
    let rut = normalize_rut_chile(
        buyer
            .get("RutUnidad")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
    );
    let organism_code = buyer
        .get("CodigoOrganismo")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let name = buyer
        .get("NombreOrganismo")
        .or_else(|| buyer.get("NombreUnidad"))
        .and_then(|v| v.as_str())
        .unwrap_or("Organismo comprador")
        .to_string();
    let key = format!(
        "buyer:{}",
        rut.as_deref().or(organism_code.as_deref()).unwrap_or(&name)
    );
    let mut identifiers = Vec::new();
    if let Some(r) = &rut {
        identifiers.push(("CL_RUT".to_string(), r.clone()));
    }
    if let Some(c) = &organism_code {
        identifiers.push(("CHILECOMPRA_ORGANISM_CODE".to_string(), c.clone()));
    }
    upsert_chile_entity(
        client,
        &key,
        &name,
        "public_body",
        0,
        &serde_json::json!({"source_name":"chilecompra","unit_name":buyer.get("NombreUnidad"),"commune":buyer.get("ComunaUnidad")}),
        &identifiers,
    )
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
    let canonical = display_name
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let mut entity_id = None;
    for (scheme, value) in identifiers {
        if value.is_empty() {
            continue;
        }
        if let Some(row) = client.query_opt(
            "SELECT entity_id FROM entity_identifiers WHERE scheme=$1 AND value=$2 AND country_code='CL' ORDER BY id LIMIT 1",
            &[&scheme.as_str(), &value.as_str()],
        )? {
            entity_id = Some(row.get::<_, i32>(0));
            break;
        }
    }
    if entity_id.is_none() && !external_id.trim().is_empty() {
        entity_id = client
            .query_opt(
                "SELECT id FROM entities WHERE external_id=$1 ORDER BY id LIMIT 1",
                &[&external_id],
            )?
            .map(|row| row.get::<_, i32>(0));
    }
    if entity_id.is_none() && !canonical.is_empty() {
        entity_id = client
            .query_opt(
                "SELECT id FROM entities WHERE canonical_name=$1 AND entity_type=$2 AND country_code='CL' ORDER BY id LIMIT 1",
                &[&canonical, &entity_type],
            )?
            .map(|row| row.get::<_, i32>(0));
    }
    let entity_id = if let Some(id) = entity_id {
        client.execute(
            "UPDATE entities SET display_name=$1, canonical_name=$2, entity_type=$3, metadata=COALESCE(metadata, '{}'::jsonb) || $4::text::jsonb, risk_score=GREATEST(COALESCE(risk_score, 0), $5), updated_at=now() WHERE id=$6",
            &[&display_name, &canonical, &entity_type, &metadata.to_string(), &risk_score, &id],
        )?;
        id
    } else {
        client
            .query_one(
                "INSERT INTO entities (external_id, canonical_name, display_name, entity_type, country_code, metadata, risk_score) VALUES ($1, $2, $3, $4, 'CL', $5::text::jsonb, $6) RETURNING id",
                &[&external_id, &canonical, &display_name, &entity_type, &metadata.to_string(), &risk_score],
            )?
            .get(0)
    };
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

fn upsert_chile_source(
    client: &mut postgres::Client,
    external_id: &str,
    source_url: &str,
    record_type: &str,
) -> Result<i32> {
    let meta = serde_json::json!({
        "institution":"ChileCompra / Mercado Publico",
        "source_mode":"selective_api",
        "source_type":"api",
        "license":CHILECOMPRA_LICENSE,
        "record_type":record_type,
        "source_name":"chilecompra",
        "fetched_at": unix_ts(),
    });
    if let Some(row) = client.query_opt(
        "SELECT id FROM sources WHERE source_name='chilecompra' AND external_id=$1 AND metadata->>'record_type'=$2 ORDER BY id LIMIT 1",
        &[&external_id, &record_type],
    )? {
        let id: i32 = row.get(0);
        client.execute(
            "UPDATE sources SET source_url=$1, fetched_at=now(), metadata=COALESCE(metadata, '{}'::jsonb) || $2::text::jsonb WHERE id=$3",
            &[&source_url, &meta.to_string(), &id],
        )?;
        return Ok(id);
    }
    let row = client.query_one(
        "INSERT INTO sources (source_name, source_type, source_url, external_id, license, metadata) \
         VALUES ('chilecompra', 'api', $1, $2, $3, $4::text::jsonb) RETURNING id",
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
    let external_code: Option<String> = client
        .query_opt("SELECT external_id FROM sources WHERE id=$1", &[&source_id])?
        .map(|row| row.get(0));
    let meta = serde_json::json!({
        "source":"chilecompra",
        "source_name":"chilecompra",
        "source_mode":"selective_api",
        "external_code": external_code,
        "chilecompra_code": external_code,
    });
    client.execute(
        "INSERT INTO relationships (source_entity_id, target_entity_id, relationship_type, label, weight, confidence_score, metadata, source_id) \
         VALUES ($1, $2, $3, $4, 1, 1, $5::text::jsonb, $6) ON CONFLICT DO NOTHING",
        &[&src_id, &dst_id, &rel_type, &label, &meta.to_string(), &source_id],
    )?;
    Ok(())
}

fn chile_risk_score(amount: f64) -> i32 {
    if amount >= 1_000_000_000.0 {
        70
    } else if amount >= 100_000_000.0 {
        45
    } else if amount > 0.0 {
        20
    } else {
        0
    }
}

fn normalize_rut_chile(value: &str) -> Option<String> {
    let digits: String = value
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == 'k' || *c == 'K')
        .collect();
    if digits.len() < 2 {
        return None;
    }
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
        let start_days = opts
            .backfill_from
            .as_deref()
            .and_then(|s| date_from_iso(s))
            .unwrap_or_else(|| {
                // 2020-01-01 default
                ymd_to_days(2020, 1, 1)
            });
        let end_days = opts
            .backfill_to
            .as_deref()
            .and_then(|s| date_from_iso(s))
            .unwrap_or_else(|| {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;
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
            let kinds: Vec<&str> = if opts.kind == "all" {
                vec!["licitaciones", "ordenes_compra"]
            } else {
                vec![opts.kind.as_str()]
            };
            let mut had_error = false;
            for kind in &kinds {
                match discover_one_kind(
                    &mut client,
                    &opts.ticket,
                    &fecha,
                    kind,
                    opts.estado.as_deref(),
                    opts.daily_budget,
                ) {
                    Ok((disc, q)) => {
                        stats.discovered += disc;
                        stats.queued += q;
                    }
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
            let _ = hydrate_queue(
                &mut client,
                &opts.ticket,
                opts.hydration_budget,
                opts.daily_budget,
                opts.sleep_seconds,
                &tx,
                &mut stats,
            );
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
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
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

        let kinds: Vec<&str> = if opts.kind == "all" {
            vec!["licitaciones", "ordenes_compra"]
        } else {
            vec![opts.kind.as_str()]
        };
        for kind in &kinds {
            match discover_one_kind(
                &mut client,
                &opts.ticket,
                &target_fecha,
                kind,
                opts.estado.as_deref(),
                opts.daily_budget,
            ) {
                Ok((disc, q)) => {
                    total.discovered += disc;
                    total.queued += q;
                }
                Err(e) => {
                    let _ = tx.send(Msg::Progress {
                        task: TaskKind::Chile,
                        payload: serde_json::json!({"phase":"discovery","status":"running","message":format!("ciclo {cycle} {kind}: {e}")}),
                    });
                }
            }
        }
        let _ = hydrate_queue(
            &mut client,
            &opts.ticket,
            opts.hydration_budget,
            opts.daily_budget,
            opts.sleep_seconds,
            &tx,
            &mut total,
        );

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
