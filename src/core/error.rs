use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Database connection error: {0}")]
    DatabaseConnection(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Plugin error: {0}")]
    Plugin(String),

    #[error("Window error: {0}")]
    Window(String),

    #[error("Event bus error: {0}")]
    EventBus(String),

    #[error("WebSocket error: {0}")]
    WebSocket(String),

    #[error("HTTP server error: {0}")]
    HttpServer(String),

    #[error("Initialization error: {0}")]
    Init(String),

    #[error("Runtime error: {0}")]
    Runtime(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}
