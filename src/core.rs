use log::{info, LevelFilter};
use rusqlite::Connection;
use serde::Deserialize;
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::{Arc, Mutex};

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
}

pub struct Logger;

impl Logger {
    pub fn new() -> Self {
        Self
    }
}

impl log::Log for Logger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= log::max_level() && metadata.level() <= log::STATIC_MAX_LEVEL
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
            let level = record.level();
            let target = record.target();
            let message = record.args();

            // Print to console
            println!("[{}] {} [{}] {}", timestamp, level, target, message);

            // Write to log file
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open("application.log")
            {
                writeln!(file, "[{}] {} [{}] {}", timestamp, level, target, message).ok();
            }
        }
    }

    fn flush(&self) {}
}

pub fn init_logging_with_config(
    log_file: Option<&str>,
    log_level: &str,
    _append: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    log::set_boxed_logger(Box::new(Logger::new()))?;

    // Determine log level from config or environment variable
    let level = if let Ok(env_level) = std::env::var("RUST_LOG").as_deref() {
        match env_level {
            "debug" => LevelFilter::Debug,
            "info" => LevelFilter::Info,
            "warn" => LevelFilter::Warn,
            "error" => LevelFilter::Error,
            _ => LevelFilter::Info,
        }
    } else {
        match log_level {
            "debug" => LevelFilter::Debug,
            "info" => LevelFilter::Info,
            "warn" => LevelFilter::Warn,
            "error" => LevelFilter::Error,
            _ => LevelFilter::Info,
        }
    };

    log::set_max_level(level);

    if let Some(file_path) = log_file {
        if !file_path.is_empty() {
            println!("Logging to file: {}", file_path);
        }
    }

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
