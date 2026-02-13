use std::fmt;
use std::sync::Mutex;
use lazy_static::lazy_static;
use chrono::Local;
use tracing::{Event, Subscriber};
use tracing_subscriber::{
    layer::{Context, Layer},
    fmt::{format, FmtContext, FormatEvent, FormatFields},
};
use std::io::Write;

/// Build-specific logger with enhanced formatting for build operations
pub struct BuildLogger;

impl BuildLogger {
    pub fn init() {
        use tracing_subscriber::prelude::__tracing_subscriber_SubscriberExt;
        use tracing_subscriber::util::SubscriberInitExt;
        tracing_subscriber::registry()
            .with(BuildLayer)
            .with(
                tracing_subscriber::fmt::layer()
                    .event_format(BuildFormatter),
            )
            .init();
    }
}

/// Custom layer for build-specific logging
struct BuildLayer;

impl<S> Layer<S> for BuildLayer
where
    S: Subscriber,
{
    fn on_event(
        &self,
        event: &Event<'_>,
        _ctx: Context<'_, S>,
    ) {
        let mut visitor = BuildEventVisitor {
            message: String::new(),
        };
        event.record(&mut visitor);
        
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let level = event.metadata().level();
        let target = event.metadata().target();
        
        println!("[{}] [{:>5}] [{}] {}", timestamp, level, target, visitor.message);
    }
}

/// Custom formatter for build events
struct BuildFormatter;

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

/// Visitor to extract message from event
struct BuildEventVisitor {
    message: String,
}

impl tracing::field::Visit for BuildEventVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{:?}", value);
        } else {
            self.message.push_str(&format!(" {}={:?}", field.name(), value));
        }
    }
}

/// Macro for build-specific logging with additional context
#[macro_export]
macro_rules! build_log {
    (target: $target:expr, $lvl:expr, $($arg:tt)+) => ({
        tracing::event!(target: $target, $lvl, $($arg)+)
    });
    ($lvl:expr, $($arg:tt)+) => ({
        tracing::event!($lvl, $($arg)+)
    });
}

/// Convenience macros for different log levels
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

/// Structured build log entry
#[derive(Debug, Clone)]
pub struct BuildLogEntry {
    pub timestamp: String,
    pub level: tracing::Level,
    pub module: String,
    pub message: String,
    pub duration_ms: Option<u128>,
    pub context: Vec<(String, String)>,
}

impl BuildLogEntry {
    pub fn new(level: tracing::Level, module: String, message: String) -> Self {
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
        use serde_json;
        
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
        let mut result = format!("[{}] [{:>5}] [{}] {}", 
            self.timestamp, 
            self.level, 
            self.module, 
            self.message
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

/// Build logger with timing capabilities
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
        let entry = BuildLogEntry::new(
            tracing::Level::INFO,
            self.module.clone(),
            message.to_string(),
        ).with_duration(self.start_time.elapsed().as_millis());
        
        println!("{}", entry.to_text());
    }
    
    pub fn warn(&self, message: &str) {
        let entry = BuildLogEntry::new(
            tracing::Level::WARN,
            self.module.clone(),
            message.to_string(),
        ).with_duration(self.start_time.elapsed().as_millis());
        
        eprintln!("{}", entry.to_text());
    }
    
    pub fn error(&self, message: &str) {
        let entry = BuildLogEntry::new(
            tracing::Level::ERROR,
            self.module.clone(),
            message.to_string(),
        ).with_duration(self.start_time.elapsed().as_millis());
        
        eprintln!("{}", entry.to_text());
    }
    
    pub fn elapsed(&self) -> std::time::Duration {
        self.start_time.elapsed()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_log_entry() {
        let entry = BuildLogEntry::new(
            tracing::Level::INFO,
            "test_module".to_string(),
            "test message".to_string(),
        )
        .with_duration(100)
        .with_context("key", "value");

        assert!(entry.to_text().contains("test message"));
        assert!(entry.to_json().contains("test message"));
    }
}