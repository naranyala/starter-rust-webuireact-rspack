use std::sync::Arc;
use tracing::{info, error, debug};
use webui_rs::webui;
use serde_json::json;
use crate::core::Database;
use crate::models::User;
use crate::event_bus::{emit_users_fetched, emit_event, Event, EventType};

pub fn setup_user_viewmodel(window: &mut webui::Window) {
    window.bind("get_users", |_event| {
        info!("Get users event received");
        
        let db_opt = {
            let db_guard = crate::viewmodels::DATABASE.lock().unwrap();
            db_guard.clone()
        };
        
        if let Some(db) = db_opt {
            tokio::spawn(async move {
                match fetch_users_from_db(&db).await {
                    Ok(users) => {
                        let users_value: Vec<serde_json::Value> = users.iter().map(|u| serde_json::to_value(u).unwrap_or(serde_json::Value::Null)).collect();
                        info!("Fetched {} users from database", users.len());
                        if let Err(e) = emit_users_fetched(users.len(), users_value, "user_viewmodel").await {
                            error!("Failed to emit users fetched event: {}", e);
                        }
                        let response = json!({
                            "success": true,
                            "data": users,
                            "count": users.len()
                        }).to_string();
                        debug!("Sending users response to frontend: {}", response);
                    }
                    Err(e) => {
                        error!("Failed to fetch users from database: {}", e);
                        let event = Event::new(
                            EventType::Custom {
                                name: "database.error".to_string(),
                                payload: json!({"error": e.to_string()})
                            },
                            "user_viewmodel"
                        );
                        if let Err(emission_err) = emit_event(event).await {
                            error!("Failed to emit database error event: {}", emission_err);
                        }
                    }
                }
            });
        } else {
            error!("Database not initialized");
        }
    });

    window.bind("get_db_stats", |_event| {
        info!("Get DB stats event received");
        
        let db_opt = {
            let db_guard = crate::viewmodels::DATABASE.lock().unwrap();
            db_guard.clone()
        };
        
        if let Some(db) = db_opt {
            tokio::spawn(async move {
                match fetch_db_stats(&db).await {
                    Ok(stats) => {
                        info!("Fetched database stats");
                        let event = Event::new(
                            EventType::Custom {
                                name: "database.stats_received".to_string(),
                                payload: json!(stats)
                            },
                            "user_viewmodel"
                        );
                        if let Err(e) = emit_event(event).await {
                            error!("Failed to emit database stats event: {}", e);
                        }
                        let response = json!({
                            "success": true,
                            "stats": stats
                        }).to_string();
                        debug!("Sending DB stats response to frontend: {}", response);
                    }
                    Err(e) => {
                        error!("Failed to fetch database stats: {}", e);
                    }
                }
            });
        } else {
            error!("Database not initialized");
        }
    });

    info!("User viewmodel handlers registered");
}

async fn fetch_users_from_db(db: &Arc<Database>) -> Result<Vec<User>, Box<dyn std::error::Error + Send + Sync>> {
    let db_conn = db.get_connection();
    let conn = db_conn.lock().unwrap();
    
    let mut stmt = conn.prepare("SELECT id, name, email, role FROM users ORDER BY id LIMIT 100")?;
    
    let users = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                role: row.get(3)?,
                status: "Active".to_string(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    
    Ok(users)
}

async fn fetch_db_stats(db: &Arc<Database>) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
    let db_conn = db.get_connection();
    let conn = db_conn.lock().unwrap();
    
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")?;
    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .map(|table_result| table_result.unwrap_or_default())
        .collect();
    
    Ok(json!({
        "users": user_count,
        "tables": tables,
        "size": "N/A"
    }))
}
