#![allow(dead_code)]

use tracing_subscriber::{
    fmt, fmt::format::FmtSpan, fmt::time::Uptime, layer::SubscriberExt, util::SubscriberInitExt,
    EnvFilter,
};

pub fn init_logging_with_config(
    log_file: Option<&str>,
    log_level: &str,
    append: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let filter_layer = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(log_level))
        .unwrap_or_else(|_| EnvFilter::new("info"));

    let is_json_format = std::env::var("LOG_FORMAT")
        .unwrap_or_else(|_| "text".to_string())
        .to_lowercase()
        == "json";

    if is_json_format {
        tracing_subscriber::registry()
            .with(filter_layer)
            .with(
                fmt::layer()
                    .json()
                    .with_file(true)
                    .with_line_number(true)
                    .with_target(true)
                    .with_timer(Uptime::default())
                    .with_span_events(FmtSpan::CLOSE),
            )
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter_layer)
            .with(
                fmt::layer()
                    .with_file(true)
                    .with_line_number(true)
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_thread_names(true)
                    .with_timer(Uptime::default())
                    .with_span_events(FmtSpan::CLOSE),
            )
            .init();
    }

    tracing::info!("Logging initialized with level: {}", log_level);
    if let Some(file) = log_file {
        tracing::info!("Log file: {}", file);
    }
    tracing::info!("Append mode: {}", append);

    Ok(())
}

pub fn init_database(db_path: &str) -> Result<crate::models::Database, Box<dyn std::error::Error>> {
    let db = crate::models::Database::new(db_path)?;
    db.init()?;
    Ok(db)
}
