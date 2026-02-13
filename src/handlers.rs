use lazy_static::lazy_static;
use tracing::{info, error, debug};
use std::sync::{Arc, Mutex};
use webui_rs::webui;
use crate::core::{emit_event, emit_counter_increment, emit_counter_reset, emit_users_fetched, Event, EventType, GLOBAL_EVENT_BUS};
use crate::event_bus::WebUIEventBridge;
use serde_json::json;

// Consolidated handlers module combining all previous handler modules
// Combines: ui_handlers, counter_handlers, db_handlers, sysinfo_handlers, utils_handlers, advanced_handlers, enhanced_handlers

// Shared database reference using lazy static
lazy_static! {
    static ref DATABASE: Arc<Mutex<Option<Arc<crate::core::Database>>>> =
        Arc::new(Mutex::new(None));
}

pub fn init_database(db: Arc<crate::core::Database>) {
    let mut db_guard = DATABASE.lock().unwrap();
    *db_guard = Some(db);
}

pub fn setup_ui_handlers(window: &mut webui::Window) {
    // Setup basic UI handlers with event bus integration
    window.bind("increment_counter", |_event| {
        info!("Increment counter event received");
        
        // Emit event through event bus
        tokio::spawn(async {
            if let Err(e) = emit_counter_increment("ui_handler").await {
                error!("Failed to emit counter increment event: {}", e);
            }
        });
    });

    window.bind("reset_counter", |_event| {
        info!("Reset counter event received");
        
        // Emit event through event bus
        tokio::spawn(async {
            if let Err(e) = emit_counter_reset("ui_handler").await {
                error!("Failed to emit counter reset event: {}", e);
            }
        });
    });

    info!("UI handlers registered with event bus integration");
}

pub fn setup_counter_handlers(window: &mut webui::Window) {
    // Counter-specific handlers with event bus integration
    window.bind("get_counter_value", |_event| {
        info!("Get counter value event received");
        
        // In a real implementation, we would return the current counter value
        // For now, emit an event indicating the request
        tokio::spawn(async {
            let event = Event::new(
                EventType::CounterValueChanged { value: 0 }, // Placeholder value
                "counter_handler"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit counter value changed event: {}", e);
            }
        });
    });

    info!("Counter handlers registered with event bus integration");
}

pub fn setup_db_handlers(window: &mut webui::Window) {
    // Database handlers with event bus integration
    window.bind("get_users", |_event| {
        info!("Get users event received");
        
        // Access the database and fetch users
        let db_opt = {
            let db_guard = DATABASE.lock().unwrap();
            db_guard.clone()
        };
        
        if let Some(db) = db_opt {
            tokio::spawn(async move {
                match fetch_users_from_db(&db).await {
                    Ok(users) => {
                        info!("Fetched {} users from database", users.len());
                        
                        // Emit users fetched event
                        if let Err(e) = emit_users_fetched(users.len(), users.clone(), "db_handler").await {
                            error!("Failed to emit users fetched event: {}", e);
                        }
                        
                        // Send response back to frontend via WebUI
                        let response = json!({
                            "success": true,
                            "data": users,
                            "count": users.len()
                        }).to_string();
                        
                        // In a real implementation, we would send this back to the specific window
                        // For now, we'll just log it
                        debug!("Sending users response to frontend: {}", response);
                    }
                    Err(e) => {
                        error!("Failed to fetch users from database: {}", e);
                        
                        // Emit error event
                        let event = Event::new(
                            EventType::Custom {
                                name: "database.error".to_string(),
                                payload: json!({"error": e.to_string()})
                            },
                            "db_handler"
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
        
        // Access the database and fetch stats
        let db_opt = {
            let db_guard = DATABASE.lock().unwrap();
            db_guard.clone()
        };
        
        if let Some(db) = db_opt {
            tokio::spawn(async move {
                match fetch_db_stats(&db).await {
                    Ok(stats) => {
                        info!("Fetched database stats");
                        
                        // Emit stats received event
                        let event = Event::new(
                            EventType::Custom {
                                name: "database.stats_received".to_string(),
                                payload: json!(stats)
                            },
                            "db_handler"
                        );
                        if let Err(e) = emit_event(event).await {
                            error!("Failed to emit database stats event: {}", e);
                        }
                        
                        // Send response back to frontend via WebUI
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

    info!("Database handlers registered with event bus integration");
}

// Helper function to fetch users from database
async fn fetch_users_from_db(db: &Arc<crate::core::Database>) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    use rusqlite::OptionalExtension;
    
    let db_conn = db.get_connection();
    let conn = db_conn.lock().unwrap();
    
    let mut stmt = conn.prepare(
        "SELECT id, name, email, role FROM users ORDER BY id LIMIT 100"
    )?;
    
    let users = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .map(|user_result| {
            match user_result {
                Ok((id, name, email, role)) => {
                    Ok(json!({
                        "id": id,
                        "name": name,
                        "email": email,
                        "role": role,
                        "status": if role == "admin" { "Active" } else { "Active" } // Placeholder status
                    }))
                }
                Err(e) => Err(Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
            }
        })
        .collect::<Result<Vec<_>, _>>()?;
    
    Ok(users)
}

// Helper function to fetch database stats
async fn fetch_db_stats(db: &Arc<crate::core::Database>) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
    use rusqlite::OptionalExtension;
    
    let db_conn = db.get_connection();
    let conn = db_conn.lock().unwrap();
    
    // Get user count
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    
    // Get table info
    let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'")?;
    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .map(|table_result| table_result.unwrap_or_default())
        .collect();
    
    Ok(json!({
        "users": user_count,
        "tables": tables,
        "size": "N/A" // Would require additional query for actual DB size
    }))
}

pub fn setup_sysinfo_handlers(window: &mut webui::Window) {
    // System info handlers with event bus integration
    window.bind("get_system_info", |_event| {
        info!("Get system info event received");
        
        tokio::spawn(async {
            // Emit system info requested event
            if let Err(e) = crate::core::emit_system_info_request("sysinfo_handler").await {
                error!("Failed to emit system info request event: {}", e);
            }
            
            // In a real implementation, we would gather system info here
            // For now, we'll emit a mock response
            let event = Event::new(
                EventType::SystemInfoReceived {
                    cpu: "Intel Core i7".to_string(),
                    memory: "16GB".to_string(),
                    os: std::env::consts::OS.to_string(),
                },
                "sysinfo_handler"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit system info received event: {}", e);
            }
        });
    });

    info!("System info handlers registered with event bus integration");
}

pub fn setup_utils_handlers(window: &mut webui::Window) {
    // Utility handlers with event bus integration
    window.bind("open_folder", |_event| {
        info!("Open folder event received");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "utils.folder_open_requested".to_string(),
                    payload: json!({})
                },
                "utils_handler"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit folder open event: {}", e);
            }
        });
    });

    window.bind("organize_images", |_event| {
        info!("Organize images event received");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "utils.images_organized".to_string(),
                    payload: json!({})
                },
                "utils_handler"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit images organized event: {}", e);
            }
        });
    });

    info!("Utility handlers registered with event bus integration");
}

pub fn setup_advanced_handlers(window: &mut webui::Window) {
    // Advanced handlers with event bus integration
    window.bind("advanced_operation", |_event| {
        info!("Advanced operation event received");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "advanced.operation_started".to_string(),
                    payload: json!({})
                },
                "advanced_handler"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit advanced operation event: {}", e);
            }
        });
    });

    info!("Advanced handlers registered with event bus integration");
}

pub fn setup_enhanced_handlers(window: &mut webui::Window) {
    // Enhanced handlers with event bus integration
    window.bind("enhanced_feature", |_event| {
        info!("Enhanced feature event received");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "enhanced.feature_used".to_string(),
                    payload: json!({})
                },
                "enhanced_handler"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit enhanced feature event: {}", e);
            }
        });
    });

    info!("Enhanced handlers registered with event bus integration");
}

// Initialize WebUI event bridge for bidirectional communication
pub fn init_webui_event_bridge(window: Arc<Mutex<webui::Window>>) {
    let event_bus = Arc::new(GLOBAL_EVENT_BUS.clone());
    let mut webui_bridge = WebUIEventBridge::new(event_bus);
    webui_bridge.set_webui_window(window);
    
    // Subscribe to important events to forward to WebUI
    tokio::spawn(async move {
        // Subscribe to events that should be forwarded to the frontend
        if let Err(e) = webui_bridge.subscribe_for_webui("database.users_fetched").await {
            error!("Failed to subscribe for WebUI forwarding: {}", e);
        }
        if let Err(e) = webui_bridge.subscribe_for_webui("system.info_received").await {
            error!("Failed to subscribe for WebUI forwarding: {}", e);
        }
        if let Err(e) = webui_bridge.subscribe_for_webui("counter.value_changed").await {
            error!("Failed to subscribe for WebUI forwarding: {}", e);
        }
    });
    
    info!("WebUI event bridge initialized");
}
