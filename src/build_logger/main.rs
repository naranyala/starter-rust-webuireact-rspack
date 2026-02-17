pub mod display;
pub mod progress;

pub use display::{print_progress_bar, print_step_completed, print_step_failed, ProgressBar};
pub use progress::{BuildProgress, BuildStep, StepStatus};

use chrono::Local;
use lazy_static::lazy_static;
use std::fmt;
use std::path::PathBuf;
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

pub struct TimedBuildLogger {
    start_time: Instant,
    pub logs: Vec<BuildLogEntry>,
}

#[derive(Debug, Clone)]
pub struct BuildLogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

impl TimedBuildLogger {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            logs: Vec::new(),
        }
    }

    pub fn elapsed_ms(&self) -> u64 {
        self.start_time.elapsed().as_millis() as u64
    }

    pub fn log(&mut self, level: &str, target: &str, message: &str) {
        self.logs.push(BuildLogEntry {
            timestamp: Local::now().format("%H:%M:%S%.3f").to_string(),
            level: level.to_string(),
            target: target.to_string(),
            message: message.to_string(),
        });
    }
}

impl Default for TimedBuildLogger {
    fn default() -> Self {
        Self::new()
    }
}

pub struct Logger {
    log_dir: PathBuf,
    use_colors: bool,
    json_output: bool,
}

impl Logger {
    pub fn new(log_dir: PathBuf) -> Self {
        Self {
            log_dir,
            use_colors: true,
            json_output: false,
        }
    }

    pub fn with_colors(mut self, use_colors: bool) -> Self {
        self.use_colors = use_colors;
        self
    }

    pub fn with_json(mut self, json: bool) -> Self {
        self.json_output = json;
        self
    }

    pub fn init(&self) {
        let dir = &self.log_dir;
        let use_colors = self.use_colors;
        let json_output = self.json_output;

        if !dir.exists() {
            let _ = std::fs::create_dir_all(dir);
        }

        let filter = EnvFilter::try_from_default_env()
            .or_else(|_| EnvFilter::try_new("info"))
            .unwrap_or_else(|_| EnvFilter::new("info"));

        if json_output {
            tracing_subscriber::registry()
                .with(filter)
                .with(tracing_subscriber::fmt::layer().json())
                .init();
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
        let message = format!(
            "[{}] [{:>5}] [{}] {}",
            timestamp, level, target, visitor.message
        );
        if *level == Level::ERROR || *level == Level::WARN {
            eprintln!("{}", message);
        } else {
            println!("{}", message);
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
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        }
    }
}
