use rusqlite::Connection;
use serde::Deserialize;
use std::env;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tracing::{info, Level};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

// Import the build logger and event bus (these are defined at the crate root)
pub use crate::build_logger::{BuildLogEntry, BuildLogger, TimedBuildLogger};
pub use crate::event_bus::{
    emit_build_completed, emit_build_progress, emit_build_started, emit_counter_increment,
    emit_counter_reset, emit_counter_value_changed, emit_custom, emit_event,
    emit_system_info_request, emit_users_fetched, emit_webui_connected, emit_webui_ready, Event,
    EventBus, EventType, WebUIEventBridge, GLOBAL_EVENT_BUS,
};

// Consolidated core functionality
// Combines: config, logging, database, and other infrastructure modules

#[derive(Debug, Deserialize)]
pub struct AppConfig {
    pub app: AppSettings,
    pub database: DatabaseSettings,
    pub window: WindowSettings,
    pub logging: LoggingSettings,
}

#[derive(Debug, Deserialize)]
pub struct AppSettings {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Deserialize)]
pub struct DatabaseSettings {
    pub path: String,
    pub create_sample_data: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct WindowSettings {
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct LoggingSettings {
    pub level: String,
    pub file: String,
    pub append: Option<bool>,
    pub format: Option<String>,     // Added format option
    pub max_file_size: Option<u64>, // Added max file size for rotation
    pub max_files: Option<usize>,   // Added max number of files for rotation
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            app: AppSettings {
                name: String::from("Rust WebUI Application"),
                version: String::from("1.0.0"),
            },
            database: DatabaseSettings {
                path: String::from("app.db"),
                create_sample_data: Some(true),
            },
            window: WindowSettings {
                title: String::from("Rust WebUI Application"),
            },
            logging: LoggingSettings {
                level: String::from("info"),
                file: String::from("application.log"),
                append: Some(true),
                format: Some(String::from("text")), // Default to text format
                max_file_size: Some(10 * 1024 * 1024), // 10MB default
                max_files: Some(5),                 // Keep 5 rotated files
            },
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        // Try to find config file
        let config_paths = [
            "app.config.toml",
            "config/app.config.toml",
            "./app.config.toml",
            "./config/app.config.toml",
        ];

        let mut config_content = None;
        let mut config_path = String::new();

        for path in &config_paths {
            if Path::new(path).exists() {
                config_content = Some(fs::read_to_string(path)?);
                config_path = path.to_string();
                break;
            }
        }

        // Also check APP_CONFIG environment variable
        if config_content.is_none() {
            if let Ok(env_path) = env::var("APP_CONFIG") {
                if Path::new(&env_path).exists() {
                    config_content = Some(fs::read_to_string(&env_path)?);
                    config_path = env_path;
                }
            }
        }

        // Try to parse TOML if config found
        if let Some(content) = config_content {
            match toml::from_str(&content) {
                Ok(config) => {
                    println!("Loaded configuration from: {}", config_path);
                    return Ok(config);
                }
                Err(e) => {
                    eprintln!("Warning: Failed to parse config file: {}", e);
                    eprintln!("Using default configuration");
                }
            }
        }

        // Return default config if no config file found or parsing failed
        Ok(AppConfig::default())
    }

    pub fn get_app_name(&self) -> &str {
        &self.app.name
    }

    pub fn get_version(&self) -> &str {
        &self.app.version
    }

    pub fn get_db_path(&self) -> &str {
        &self.database.path
    }

    pub fn should_create_sample_data(&self) -> bool {
        self.database.create_sample_data.unwrap_or(true)
    }

    pub fn get_window_title(&self) -> &str {
        &self.window.title
    }

    pub fn get_log_level(&self) -> &str {
        &self.logging.level
    }

    pub fn get_log_file(&self) -> &str {
        &self.logging.file
    }

    pub fn is_append_log(&self) -> bool {
        self.logging.append.unwrap_or(true)
    }

    pub fn get_log_format(&self) -> &str {
        self.logging.format.as_deref().unwrap_or("text")
    }

    pub fn get_max_file_size(&self) -> u64 {
        self.logging.max_file_size.unwrap_or(10 * 1024 * 1024)
    }

    pub fn get_max_files(&self) -> usize {
        self.logging.max_files.unwrap_or(5)
    }
}

pub fn init_logging_with_config(
    log_file: Option<&str>,
    log_level: &str,
    append: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    // Build the filter layer
    let filter_layer = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(log_level))
        .unwrap_or_else(|_| EnvFilter::new("info"));

    // Determine if we should use JSON format
    let is_json_format = std::env::var("LOG_FORMAT")
        .unwrap_or_else(|_| "text".to_string())
        .to_lowercase()
        == "json";

    if is_json_format {
        // Initialize JSON logging
        tracing_subscriber::registry()
            .with(filter_layer)
            .with(
                fmt::layer()
                    .json()
                    .with_file(true)
                    .with_line_number(true)
                    .with_target(true),
            )
            .init();
    } else {
        // Initialize regular logging
        tracing_subscriber::registry()
            .with(filter_layer)
            .with(
                fmt::layer()
                    .with_file(true)
                    .with_line_number(true)
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_thread_names(true),
            )
            .init();
    }

    // Log initialization info
    tracing::info!("Logging initialized with level: {}", log_level);
    if let Some(file) = log_file {
        tracing::info!("Log file: {}", file);
    }
    tracing::info!("Append mode: {}", append);

    Ok(())
}

pub struct Database {
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;

        // Enable WAL mode for better concurrency
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;

        Ok(Database {
            connection: Arc::new(Mutex::new(conn)),
        })
    }

    // Getter for the connection (needed for event bus integration)
    pub fn get_connection(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.connection)
    }

    pub fn init(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT NOT NULL
            )",
            [],
        )?;

        info!("Database schema initialized");
        Ok(())
    }

    pub fn insert_sample_data(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.connection.lock().unwrap();

        // Insert sample users if table is empty
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;

        if count == 0 {
            let sample_users = [
                ("John Doe", "john@example.com", "admin"),
                ("Jane Smith", "jane@example.com", "editor"),
                ("Bob Johnson", "bob@example.com", "user"),
                ("Alice Brown", "alice@example.com", "user"),
            ];

            for (name, email, role) in &sample_users {
                conn.execute(
                    "INSERT INTO users (name, email, role) VALUES (?1, ?2, ?3)",
                    rusqlite::params![name, email, role],
                )?;
            }

            info!("Sample data inserted into database");
        }

        Ok(())
    }
}
