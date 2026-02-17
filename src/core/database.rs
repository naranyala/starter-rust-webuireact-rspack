use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tracing::info;

pub struct Database {
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;

        Ok(Database {
            connection: Arc::new(Mutex::new(conn)),
        })
    }

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
