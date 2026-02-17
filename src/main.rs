use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use std::net::TcpListener;
use tracing::{info, error, warn};
use webui_rs::webui;
use tokio::runtime::Builder;

mod build_logger;
mod event_bus;
mod models;
mod viewmodels;
mod websocket_manager;
mod core;

use core::{AppConfig, Database, init_logging, AppError, AppResult};
use websocket_manager::WebSocketManager;

include!(concat!(env!("OUT_DIR"), "/build_config.rs"));

fn get_random_port() -> Option<u16> {
    for port in 8000..9000 {
        if is_port_available(port) {
            return Some(port);
        }
    }
    None
}

fn is_port_available(port: u16) -> bool {
    TcpListener::bind(format!("0.0.0.0:{}", port)).is_ok()
}

fn write_port_to_config(port: u16) -> AppResult<()> {
    let config_content = format!("{{\"port\":{}}}", port);
    std::fs::write("frontend/dist/port.json", config_content)
        .map_err(|e| AppError::Io(e))?;
    info!("Port {} written to frontend/dist/port.json", port);
    Ok(())
}

fn start_http_server(port: u16) -> AppResult<()> {
    let frontend_path = std::path::PathBuf::from("frontend/dist");
    info!("Starting HTTP server on port {} for frontend files", port);

    let server = tiny_http::Server::http(format!("0.0.0.0:{}", port))
        .map_err(|e| AppError::HttpServer(e.to_string()))?;

    thread::spawn(move || {
        info!("HTTP server listening on http://localhost:{}", port);
        for request in server.incoming_requests() {
            let url = request.url().to_string();
            let sanitized_path = url.trim_start_matches('/').replace("..", "").replace("%2e%2e", "").replace("%252e%252e", "");
            let path = if url == "/" { frontend_path.join("index.html") } else { frontend_path.join(&sanitized_path) };

            let canonical_path = match path.canonicalize() { 
                Ok(p) => p, 
                Err(_) => { 
                    let _ = request.respond(tiny_http::Response::from_string("Not Found").with_status_code(404)); 
                    continue; 
                } 
            };
            let frontend_canonical = match frontend_path.canonicalize() { 
                Ok(p) => p, 
                Err(e) => { 
                    warn!("Error canonicalizing path: {}", e); 
                    let _ = request.respond(tiny_http::Response::from_string("Internal Server Error").with_status_code(500)); 
                    continue; 
                } 
            };

            if !canonical_path.starts_with(&frontend_canonical) {
                warn!("Security: Path traversal attempt blocked: {}", url);
                let _ = request.respond(tiny_http::Response::from_string("Forbidden").with_status_code(403));
                continue;
            }

            info!("HTTP Request: {} -> {:?}", url, path);
            if path.exists() && path.is_file() {
                match std::fs::read(&path) {
                    Ok(content) => {
                        let content_type = mime_guess::from_path(&path).first_or_octet_stream().to_string();
                        let security_headers = [
                            tiny_http::Header::from_bytes(&b"X-Content-Type-Options"[..], b"nosniff"),
                            tiny_http::Header::from_bytes(&b"X-Frame-Options"[..], b"DENY"),
                            tiny_http::Header::from_bytes(&b"Referrer-Policy"[..], b"strict-origin-when-cross-origin"),
                            tiny_http::Header::from_bytes(&b"Content-Security-Policy"[..], b"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: http: https:; font-src 'self' data:;"),
                        ];
                        let mut response = tiny_http::Response::from_data(content);
                        response = response.with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap());
                        for header in security_headers.into_iter().flatten() {
                            response = response.with_header(header);
                        }
                        let _ = request.respond(response);
                    }
                    Err(e) => { 
                        warn!("Error reading file {:?}: {}", path, e); 
                        let _ = request.respond(tiny_http::Response::from_string(format!("Error: {}", e)).with_status_code(500)); 
                    }
                }
            } else { 
                let _ = request.respond(tiny_http::Response::from_string("Not Found").with_status_code(404)); 
            }
        }
    });
    Ok(())
}

fn main() {
    let rt = match Builder::new_multi_thread().enable_all().build() {
        Ok(rt) => rt,
        Err(e) => {
            eprintln!("Failed to create Tokio runtime: {}", e);
            std::process::exit(1);
        }
    };
    
    rt.block_on(async {
        let config = match AppConfig::load() {
            Ok(config) => {
                println!("Configuration loaded! {} v{}", config.get_app_name(), config.get_version());
                config
            }
            Err(e) => {
                eprintln!("Failed to load configuration: {}", e);
                AppConfig::default()
            }
        };

        if let Err(e) = init_logging(Some(config.get_log_file()), config.get_log_level(), config.is_append_log()) {
            eprintln!("Failed to initialize logger: {}", e);
            return;
        }

        info!("=============================================");
        info!("Starting: {} v{}", config.get_app_name(), config.get_version());
        info!("=============================================");
        
        info!("");
        info!("=== Backend-Frontend Communication ===");
        info!("Transport Options:");
        info!("  - WebUI Bridge (webui-rs)    [SELECTED]");
        info!("  - WebSocket                  [available]");
        info!("  - HTTP/REST                  [available]");
        info!("  - IPC (tokio)                [available]");
        info!("");
        info!("Serialization Options:");
        info!("  - JSON (serde_json)          [SELECTED]");
        info!("  - MessagePack (rmp-serde)    [available]");
        info!("  - CBOR (serde_cbor)          [available]");
        info!("  - Protobuf (protobuf)        [available]");
        info!("=============================================");
        info!("");

        let db_path = config.get_db_path();
        info!("Database path: {}", db_path);

        let db = match Database::new(db_path) {
            Ok(db) => {
                info!("Database initialized");
                if let Err(e) = db.init() {
                    error!("Failed to initialize database: {}", e);
                    return;
                }
                if config.should_create_sample_data() {
                    if let Err(e) = db.insert_sample_data() {
                        error!("Failed to insert sample data: {}", e);
                        return;
                    }
                    info!("Sample data created");
                }
                Arc::new(db)
            }
            Err(e) => {
                error!("Failed to initialize database: {}", e);
                return;
            }
        };

        viewmodels::init_db(Arc::clone(&db));

        let http_port = match get_random_port() {
            Some(port) => port,
            None => {
                error!("Failed to find available port");
                return;
            }
        };
        
        if let Err(e) = start_http_server(http_port) {
            error!("Failed to start HTTP server: {}", e);
            return;
        }
        
        if let Err(e) = write_port_to_config(http_port) {
            warn!("Warning: Failed to write port config: {}", e);
        }
        
        thread::sleep(Duration::from_millis(100));

        let mut my_window = webui::Window::new();
        
        viewmodels::setup_counter_viewmodel(&mut my_window);
        viewmodels::setup_user_viewmodel(&mut my_window);
        viewmodels::setup_system_viewmodel(&mut my_window);
        viewmodels::setup_utils_viewmodel(&mut my_window);
        viewmodels::setup_window_viewmodel(&mut my_window);

        let window_arc = Arc::new(Mutex::new(my_window));
        init_webui_event_bridge(Arc::clone(&window_arc));

        if let Err(e) = event_bus::emit_webui_connected("main").await {
            error!("Failed to emit WebUI connected: {}", e);
        }

        let window_title = config.get_window_title();
        info!("Window title: {}", window_title);
        let url = format!("http://localhost:{}", http_port);
        info!("Loading from {}", url);
        
        { 
            let window_lock = match window_arc.lock() {
                Ok(lock) => lock,
                Err(e) => {
                    error!("Failed to acquire window lock: {}", e);
                    return;
                }
            };
            window_lock.show(&url); 
        }
        info!("Application started, waiting for events...");

        if let Err(e) = event_bus::emit_webui_ready("main").await {
            error!("Failed to emit WebUI ready: {}", e);
        }
        webui::wait();
        info!("Application shutting down...");
    });
}

fn init_webui_event_bridge(window: Arc<Mutex<webui::Window>>) {
    use event_bus::{GLOBAL_EVENT_BUS, WebUIEventBridge};
    let event_bus = Arc::new(GLOBAL_EVENT_BUS.clone());
    let mut webui_bridge = WebUIEventBridge::new(event_bus);
    webui_bridge.set_webui_window(window.clone());

    let ws_manager = WebSocketManager::new(window.clone());
    ws_manager.start_monitoring();
    
    tokio::spawn(async move {
        if let Err(e) = webui_bridge.subscribe_for_webui("database.users_fetched").await { error!("Failed to subscribe: {}", e); }
    });

    tokio::spawn(async move {
        let _ = ws_manager.get_state();
        let _ = ws_manager.get_metrics();
    });

    tracing::info!("WebUI event bridge initialized");
}
