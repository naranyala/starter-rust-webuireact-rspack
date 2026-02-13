use chrono::Local;
use lazy_static::lazy_static;
use std::fmt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Instant;
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::{
    fmt::{format, FmtContext, FormatEvent, FormatFields},
    layer::{Context, Layer},
    EnvFilter,
};

lazy_static! {
    pub static ref BUILD_PROGRESS: Mutex<BuildProgress> = Mutex::new(BuildProgress::new());
}

#[derive(Debug)]
pub struct BuildProgress {
    steps: Vec<BuildStep>,
    current_step: usize,
    start_time: Instant,
    total_steps: usize,
}

#[derive(Debug, Clone)]
pub struct BuildStep {
    pub name: String,
    pub status: StepStatus,
    pub start_time: Option<Instant>,
    pub end_time: Option<Instant>,
    pub message: String,
    pub progress_percent: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
}

impl BuildProgress {
    pub fn new() -> Self {
        Self {
            steps: Vec::new(),
            current_step: 0,
            start_time: Instant::now(),
            total_steps: 0,
        }
    }

    pub fn init_steps(&mut self, step_names: Vec<&str>) {
        self.steps = step_names
            .iter()
            .map(|s| BuildStep {
                name: s.to_string(),
                status: StepStatus::Pending,
                start_time: None,
                end_time: None,
                message: String::new(),
                progress_percent: 0.0,
            })
            .collect();
        self.total_steps = self.steps.len();
        self.current_step = 0;
    }

    pub fn start_step(&mut self, name: &str) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.status = StepStatus::InProgress;
            step.start_time = Some(Instant::now());
        }
    }

    pub fn complete_step(&mut self, name: &str, message: &str) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.status = StepStatus::Completed;
            step.end_time = Some(Instant::now());
            step.message = message.to_string();
            step.progress_percent = 100.0;
            self.current_step += 1;
        }
    }

    pub fn fail_step(&mut self, name: &str, message: &str) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.status = StepStatus::Failed;
            step.end_time = Some(Instant::now());
            step.message = message.to_string();
            self.current_step += 1;
        }
    }

    pub fn update_progress(&mut self, name: &str, percent: f32) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.progress_percent = percent;
        }
    }

    pub fn get_overall_progress(&self) -> f32 {
        if self.total_steps == 0 {
            return 0.0;
        }
        let completed = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Completed)
            .count();
        let in_progress = if let Some(current) = self
            .steps
            .iter()
            .find(|s| s.status == StepStatus::InProgress)
        {
            current.progress_percent as usize
        } else {
            0
        };
        ((completed * 100) + in_progress) as f32 / self.total_steps as f32
    }

    pub fn get_elapsed_time(&self) -> std::time::Duration {
        self.start_time.elapsed()
    }

    pub fn get_summary(&self) -> BuildSummary {
        let completed = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Completed)
            .count();
        let failed = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Failed)
            .count();
        let skipped = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Skipped)
            .count();

        BuildSummary {
            total_steps: self.total_steps,
            completed,
            failed,
            skipped,
            total_time_ms: self.start_time.elapsed().as_millis(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct BuildSummary {
    pub total_steps: usize,
    pub completed: usize,
    pub failed: usize,
    pub skipped: usize,
    pub total_time_ms: u128,
}

pub struct BuildLogger {
    log_dir: PathBuf,
    console_writer: ConsoleWriter,
    stats: BuildStats,
}

#[derive(Debug)]
pub struct BuildStats {
    pub total_logs: AtomicU64,
    pub error_count: AtomicU64,
    pub warn_count: AtomicU64,
    pub info_count: AtomicU64,
    pub debug_count: AtomicU64,
}

impl BuildStats {
    pub fn new() -> Self {
        Self {
            total_logs: AtomicU64::new(0),
            error_count: AtomicU64::new(0),
            warn_count: AtomicU64::new(0),
            info_count: AtomicU64::new(0),
            debug_count: AtomicU64::new(0),
        }
    }

    pub fn increment(&self, level: &Level) {
        self.total_logs.fetch_add(1, Ordering::Relaxed);
        match *level {
            Level::ERROR => {
                self.error_count.fetch_add(1, Ordering::Relaxed);
            }
            Level::WARN => {
                self.warn_count.fetch_add(1, Ordering::Relaxed);
            }
            Level::INFO => {
                self.info_count.fetch_add(1, Ordering::Relaxed);
            }
            Level::DEBUG | Level::TRACE => {
                self.debug_count.fetch_add(1, Ordering::Relaxed);
            }
            _ => {}
        }
    }

    pub fn get_summary(&self) -> LogSummary {
        LogSummary {
            total: self.total_logs.load(Ordering::Relaxed),
            errors: self.error_count.load(Ordering::Relaxed),
            warnings: self.warn_count.load(Ordering::Relaxed),
            info: self.info_count.load(Ordering::Relaxed),
            debug: self.debug_count.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Clone)]
pub struct LogSummary {
    pub total: u64,
    pub errors: u64,
    pub warnings: u64,
    pub info: u64,
    pub debug: u64,
}

pub struct ConsoleWriter {
    use_colors: bool,
}

impl ConsoleWriter {
    pub fn new(use_colors: bool) -> Self {
        Self { use_colors }
    }

    pub fn write_colored(&self, level: &Level, message: &str) -> String {
        if !self.use_colors {
            return message.to_string();
        }

        let color_code = match *level {
            Level::ERROR => "\x1b[31m",
            Level::WARN => "\x1b[33m",
            Level::INFO => "\x1b[32m",
            Level::DEBUG => "\x1b[36m",
            Level::TRACE => "\x1b[90m",
            _ => "\x1b[0m",
        };
        let reset = "\x1b[0m";

        format!("{}{}{}", color_code, message, reset)
    }
}

impl BuildLogger {
    pub fn init() {
        Self::init_with_config(None, None, true, false);
    }

    pub fn init_with_config(
        log_dir: Option<&str>,
        log_level: Option<&str>,
        use_colors: bool,
        json_output: bool,
    ) {
        use tracing_subscriber::prelude::__tracing_subscriber_SubscriberExt;
        use tracing_subscriber::util::SubscriberInitExt;

        let dir = log_dir
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("logs"));

        let filter = EnvFilter::try_from_default_env()
            .or_else(|_| EnvFilter::try_new(log_level.unwrap_or("info")))
            .unwrap_or_else(|_| EnvFilter::new("info"));

        if json_output {
            std::fs::create_dir_all(&dir).ok();
            let file_appender = tracing_appender::rolling::daily(&dir, "build.log");
            let (non_blocking_writer, guard) = tracing_appender::non_blocking(file_appender);

            tracing_subscriber::registry()
                .with(filter)
                .with(
                    tracing_subscriber::fmt::layer()
                        .json()
                        .with_writer(non_blocking_writer)
                        .with_ansi(false),
                )
                .with(BuildLayer::new(use_colors))
                .with(
                    tracing_subscriber::fmt::layer().event_format(BuildFormatter::new(use_colors)),
                )
                .init();

            Box::leak(Box::new(guard));
        } else {
            tracing_subscriber::registry()
                .with(filter)
                .with(BuildLayer::new(use_colors))
                .with(
                    tracing_subscriber::fmt::layer().event_format(BuildFormatter::new(use_colors)),
                )
                .init();
        }

        tracing::info!(
            "Build logger initialized: dir={:?}, colors={}, json={}",
            dir,
            use_colors,
            json_output
        );
    }
}

struct BuildLayer {
    use_colors: bool,
}

impl BuildLayer {
    pub fn new(use_colors: bool) -> Self {
        Self { use_colors }
    }
}

impl<S> Layer<S> for BuildLayer
where
    S: Subscriber,
{
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let mut visitor = BuildEventVisitor {
            message: String::new(),
        };
        event.record(&mut visitor);

        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let level = event.metadata().level();
        let target = event.metadata().target();

        let console_writer = ConsoleWriter::new(self.use_colors);
        let message = format!(
            "[{}] [{:>5}] [{}] {}",
            timestamp, level, target, visitor.message
        );

        if *level == Level::ERROR || *level == Level::WARN {
            eprintln!("{}", console_writer.write_colored(level, &message));
        } else {
            println!("{}", console_writer.write_colored(level, &message));
        }
    }
}

struct BuildFormatter {
    use_colors: bool,
}

impl BuildFormatter {
    pub fn new(use_colors: bool) -> Self {
        Self { use_colors }
    }
}

impl<S, N> FormatEvent<S, N> for BuildFormatter
where
    S: Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
    N: for<'a> FormatFields<'a> + 'static,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        mut writer: format::Writer<'_>,
        event: &Event<'_>,
    ) -> fmt::Result {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let level = event.metadata().level();

        write!(writer, "[{}] [{:>5}] ", timestamp, level)?;

        ctx.field_format().format_fields(writer.by_ref(), event)?;

        Ok(())
    }
}

struct BuildEventVisitor {
    message: String,
}

impl tracing::field::Visit for BuildEventVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{:?}", value);
        } else {
            self.message
                .push_str(&format!(" {}={:?}", field.name(), value));
        }
    }
}

#[macro_export]
macro_rules! build_log {
    (target: $target:expr, $lvl:expr, $($arg:tt)+) => ({
        tracing::event!(target: $target, $lvl, $($arg)+)
    });
    ($lvl:expr, $($arg:tt)+) => ({
        tracing::event!($lvl, $($arg)+)
    });
}

#[macro_export]
macro_rules! build_trace {
    (target: $target:expr, $($arg:tt)+) => (build_log!(target: $target, tracing::Level::TRACE, $($arg)+));
    ($($arg:tt)+) => (build_log!(tracing::Level::TRACE, $($arg)+));
}

#[macro_export]
macro_rules! build_debug {
    (target: $target:expr, $($arg:tt)+) => (build_log!(target: $target, tracing::Level::DEBUG, $($arg)+));
    ($($arg:tt)+) => (build_log!(tracing::Level::DEBUG, $($arg)+));
}

#[macro_export]
macro_rules! build_info {
    (target: $target:expr, $($arg:tt)+) => (build_log!(target: $target, tracing::Level::INFO, $($arg)+));
    ($($arg:tt)+) => (build_log!(tracing::Level::INFO, $($arg)+));
}

#[macro_export]
macro_rules! build_warn {
    (target: $target:expr, $($arg:tt)+) => (build_log!(target: $target, tracing::Level::WARN, $($arg)+));
    ($($arg:tt)+) => (build_log!(tracing::Level::WARN, $($arg)+));
}

#[macro_export]
macro_rules! build_error {
    (target: $target:expr, $($arg:tt)+) => (build_log!(target: $target, tracing::Level::ERROR, $($arg)+));
    ($($arg:tt)+) => (build_log!(tracing::Level::ERROR, $($arg)+));
}

#[derive(Debug, Clone)]
pub struct BuildLogEntry {
    pub timestamp: String,
    pub level: Level,
    pub module: String,
    pub message: String,
    pub duration_ms: Option<u128>,
    pub context: Vec<(String, String)>,
}

impl BuildLogEntry {
    pub fn new(level: Level, module: String, message: String) -> Self {
        Self {
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string(),
            level,
            module,
            message,
            duration_ms: None,
            context: Vec::new(),
        }
    }

    pub fn with_duration(mut self, duration_ms: u128) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_context<K, V>(mut self, key: K, value: V) -> Self
    where
        K: Into<String>,
        V: Into<String>,
    {
        self.context.push((key.into(), value.into()));
        self
    }

    pub fn to_json(&self) -> String {
        let json_obj = serde_json::json!({
            "timestamp": self.timestamp,
            "level": self.level.as_str(),
            "module": self.module,
            "message": self.message,
            "duration_ms": self.duration_ms,
            "context": self.context.iter().map(|(k, v)| (k, v)).collect::<Vec<_>>()
        });

        serde_json::to_string(&json_obj).unwrap_or_else(|_| String::from(""))
    }

    pub fn to_text(&self) -> String {
        let mut result = format!(
            "[{}] [{:>5}] [{}] {}",
            self.timestamp, self.level, self.module, self.message
        );

        if let Some(duration) = self.duration_ms {
            result.push_str(&format!(" ({}ms)", duration));
        }

        for (key, value) in &self.context {
            result.push_str(&format!(" {}:{}", key, value));
        }

        result
    }
}

pub struct TimedBuildLogger {
    start_time: std::time::Instant,
    module: String,
}

impl TimedBuildLogger {
    pub fn new(module: &str) -> Self {
        Self {
            start_time: std::time::Instant::now(),
            module: module.to_string(),
        }
    }

    pub fn info(&self, message: &str) {
        let entry = BuildLogEntry::new(Level::INFO, self.module.clone(), message.to_string())
            .with_duration(self.start_time.elapsed().as_millis());

        println!("{}", entry.to_text());
    }

    pub fn warn(&self, message: &str) {
        let entry = BuildLogEntry::new(Level::WARN, self.module.clone(), message.to_string())
            .with_duration(self.start_time.elapsed().as_millis());

        eprintln!("{}", entry.to_text());
    }

    pub fn error(&self, message: &str) {
        let entry = BuildLogEntry::new(Level::ERROR, self.module.clone(), message.to_string())
            .with_duration(self.start_time.elapsed().as_millis());

        eprintln!("{}", entry.to_text());
    }

    pub fn elapsed(&self) -> std::time::Duration {
        self.start_time.elapsed()
    }
}

pub struct ProgressLogger {
    name: String,
    start_time: Instant,
    total_items: usize,
    completed_items: AtomicU64,
}

impl ProgressLogger {
    pub fn new(name: &str, total_items: usize) -> Self {
        Self {
            name: name.to_string(),
            start_time: Instant::now(),
            total_items,
            completed_items: AtomicU64::new(0),
        }
    }

    pub fn increment(&self, count: usize) {
        let completed = self
            .completed_items
            .fetch_add(count as u64, Ordering::Relaxed)
            + count as u64;
        let progress = if self.total_items > 0 {
            (completed as f32 / self.total_items as f32) * 100.0
        } else {
            0.0
        };

        let elapsed = self.start_time.elapsed().as_secs_f32();
        let rate = if completed > 0 {
            completed as f32 / elapsed
        } else {
            0.0
        };
        let remaining = if rate > 0.0 {
            ((self.total_items - completed as usize) as f32 / rate) as u64
        } else {
            0
        };

        tracing::info!(
            target: "progress",
            "[{}] Progress: {:.1}% ({}/{}) | Rate: {:.1}/s | ETA: {}s",
            self.name,
            progress,
            completed,
            self.total_items,
            rate,
            remaining
        );
    }

    pub fn complete(&self) {
        let total = self.completed_items.load(Ordering::Relaxed);
        let elapsed = self.start_time.elapsed().as_secs_f32();

        tracing::info!(
            target: "progress",
            "[{}] Completed: {} items in {:.2}s (avg: {:.3}s/item)",
            self.name,
            total,
            elapsed,
            if total > 0 { elapsed / total as f32 } else { 0.0 }
        );
    }
}

pub fn init_build_progress(steps: Vec<&str>) {
    let step_count = steps.len();
    let mut progress = BUILD_PROGRESS.lock().unwrap();
    progress.init_steps(steps);
    tracing::info!("Build progress initialized with {} steps", step_count);
}

pub fn start_build_step(name: &str) {
    let mut progress = BUILD_PROGRESS.lock().unwrap();
    progress.start_step(name);
    tracing::info!("Starting build step: {}", name);
}

pub fn complete_build_step(name: &str, message: &str) {
    let mut progress = BUILD_PROGRESS.lock().unwrap();
    progress.complete_step(name, message);
    let summary = progress.get_summary();
    tracing::info!(
        "Completed build step: {} ({}) | Overall progress: {:.1}% | Total time: {}ms",
        name,
        message,
        progress.get_overall_progress(),
        summary.total_time_ms
    );
}

pub fn fail_build_step(name: &str, error: &str) {
    let mut progress = BUILD_PROGRESS.lock().unwrap();
    progress.fail_step(name, error);
    tracing::error!("Failed build step: {} | Error: {}", name, error);
}

pub fn get_build_summary() -> BuildSummary {
    let progress = BUILD_PROGRESS.lock().unwrap();
    progress.get_summary()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_log_entry() {
        let entry = BuildLogEntry::new(
            Level::INFO,
            "test_module".to_string(),
            "test message".to_string(),
        )
        .with_duration(100)
        .with_context("key", "value");

        assert!(entry.to_text().contains("test message"));
        assert!(entry.to_json().contains("test message"));
    }

    #[test]
    fn test_progress_logger() {
        let progress = ProgressLogger::new("test", 10);
        progress.increment(5);
        progress.increment(5);
        progress.complete();
    }
}
