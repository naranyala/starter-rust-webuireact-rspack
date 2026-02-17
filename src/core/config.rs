use serde::Deserialize;
use std::env;
use std::fs;
use std::path::Path;

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
    pub format: Option<String>,
    pub max_file_size: Option<u64>,
    pub max_files: Option<usize>,
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
                format: Some(String::from("text")),
                max_file_size: Some(10 * 1024 * 1024),
                max_files: Some(5),
            },
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
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

        if config_content.is_none() {
            if let Ok(env_path) = env::var("APP_CONFIG") {
                if Path::new(&env_path).exists() {
                    config_content = Some(fs::read_to_string(&env_path)?);
                    config_path = env_path;
                }
            }
        }

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
