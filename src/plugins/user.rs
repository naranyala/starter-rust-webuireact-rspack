use crate::core::database::Database;
use crate::event_bus::{emit_event, emit_users_fetched, Event, EventType};
use crate::plugins::PluginTrait;
use serde_json::json;
use std::sync::Arc;
use tracing::{error, info};

pub struct UserPlugin {
    db: Option<Arc<Database>>,
}

impl UserPlugin {
    pub fn new() -> Self {
        Self { db: None }
    }

    pub fn with_database(db: Arc<Database>) -> Self {
        Self { db: Some(db) }
    }

    pub fn set_database(&mut self, db: Arc<Database>) {
        self.db = Some(db);
    }
}

impl Default for UserPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginTrait for UserPlugin {
    fn name(&self) -> &str {
        "user"
    }

    fn setup(&self, window: &mut webui::Window) -> Result<(), Box<dyn std::error::Error>> {
        let db = self.db.clone();

        window.bind("get_users", move |_event| {
            info!("Frontend: get_users called");

            if let Some(ref database) = db {
                let conn = database.get_connection().lock().unwrap();
                let mut stmt = conn.prepare("SELECT id, name, email, role FROM users")?;
                let users: Vec<serde_json::Value> = stmt
                    .query_map([], |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, i32>(0)?,
                            "name": row.get::<_, String>(1)?,
                            "email": row.get::<_, String>(2)?,
                            "role": row.get::<_, String>(3)?,
                            "status": "Active"
                        }))
                    })?
                    .filter_map(|r| r.ok())
                    .collect();

                let count = users.len();
                info!("Fetched {} users from database", count);

                let _ = emit_users_fetched(count, users.clone(), "user_plugin");
            }
        });

        window.bind("add_user", |event| {
            info!("Frontend: add_user called");
            if let Some(data) = event.payload.as_str() {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    let name = parsed
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown");
                    let email = parsed
                        .get("email")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown@example.com");
                    let role = parsed
                        .get("role")
                        .and_then(|v| v.as_str())
                        .unwrap_or("user");

                    info!("Adding user: {} ({}) role: {}", name, email, role);
                }
            }
        });

        info!("UserPlugin initialized");
        Ok(())
    }
}
