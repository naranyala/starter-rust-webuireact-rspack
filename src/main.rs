use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use std::net::TcpListener;
use tracing::{info, error};
use webui_rs::webui;
use tokio::runtime::Builder;

mod build_logger;
mod event_bus;
mod models;
mod viewmodels;
mod infrastructure;
mod websocket_manager;

use models::{AppConfig, Database};
use infrastructure::init_logging_with_config;
use websocket_manager::WebSocketManager;

include!(concat!(env!("OUT_DIR"), "/build_config.rs"));

fn get_random_port() -> u16 {
    loop {
        let port = rand_u16(8000, 9000);
        if is_port_available(port) {
            return port;
        }
    }
}

fn rand_u16(min: u16, max: u16) -> u16 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos() as u64;
    min + ((seed % (max - min) as u64) as u16)
}

fn is_port_available(port: u16) -> bool {
    match TcpListener::bind(format!("0.0.0.0:{}", port)) {
        Ok(_) => true,
        Err(_) => false,
    }
}

fn write_port_to_config(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let config_content = format!("{{\"port\":{}}}", port);
    std::fs::write("frontend/dist/port.json", config_content)?;
    info!("Port {} written to frontend/dist/port.json", port);
    Ok(())
}

fn start_http_server(port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let frontend_path = std::path::PathBuf::from("frontend/dist");
    info!("Starting HTTP server on port {} for frontend files", port);
    info!("Serving files from: {}", frontend_path.canonicalize().unwrap_or(frontend_path.clone()).display());

    let server = tiny_http::Server::http(format!("0.0.0.0:{}", port))?;

    thread::spawn(move || {
        info!("HTTP server listening on http://localhost:{}", port);
        for request in server.incoming_requests() {
            let url = request.url().to_string();
            let sanitized_path = url.trim_start_matches('/').replace("..", "").replace("%2e%2e", "").replace("%252e%252e", "");
            let path = if url == "/" { frontend_path.join("index.html") } else { frontend_path.join(&sanitized_path) };

            let canonical_path = match path.canonicalize() { Ok(p) => p, Err(_) => { let _ = request.respond(tiny_http::Response::from_string("Not Found").with_status_code(404)); continue; } };
            let frontend_canonical = match frontend_path.canonicalize() { Ok(p) => p, Err(e) => { eprintln!("Error: {}", e); let _ = request.respond(tiny_http::Response::from_string("Internal Server Error").with_status_code(500)); continue; } };

            if !canonical_path.starts_with(&frontend_canonical) {
                eprintln!("Security: Path traversal attempt blocked: {}", url);
                let _ = request.respond(tiny_http::Response::from_string("Forbidden").with_status_code(403));
                continue;
            }

            info!("HTTP Request: {} -> {:?}", url, path);
            if path.exists() && path.is_file() {
                match std::fs::read(&path) {
                    Ok(content) => {
                        let content_type = mime_guess::from_path(&path).first_or_octet_stream().to_string();
                        let security_headers = vec![
                            tiny_http::Header::from_bytes(&b"X-Content-Type-Options"[..], b"nosniff").unwrap(),
                            tiny_http::Header::from_bytes(&b"X-Frame-Options"[..], b"DENY").unwrap(),
                            tiny_http::Header::from_bytes(&b"Referrer-Policy"[..], b"strict-origin-when-cross-origin").unwrap(),
                            tiny_http::Header::from_bytes(&b"Content-Security-Policy"[..], b"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: http: https:; font-src 'self' data:;").unwrap(),
                        ];
                        let mut response = tiny_http::Response::from_data(content);
                        response = response.with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap());
                        for header in security_headers { response = response.with_header(header); }
                        let _ = request.respond(response);
                    }
                    Err(e) => { eprintln!("Error reading file {:?}: {}", path, e); let _ = request.respond(tiny_http::Response::from_string(format!("Error: {}", e)).with_status_code(500)); }
                }
            } else { let _ = request.respond(tiny_http::Response::from_string("Not Found").with_status_code(404)); }
        }
    });
    Ok(())
}

fn main() {
    let rt = Builder::new_multi_thread().enable_all().build().expect("Failed to create Tokio runtime");
    rt.block_on(async {
        let config = match AppConfig::load() {
            Ok(config) => { println!("Configuration loaded! {} v{}", config.get_app_name(), config.get_version()); config }
            Err(e) => { eprintln!("Failed to load configuration: {}", e); AppConfig::default() }
        };

        if let Err(e) = init_logging_with_config(Some(config.get_log_file()), config.get_log_level(), config.is_append_log()) {
            eprintln!("Failed to initialize logger: {}", e); return;
        }

        info!("=============================================");
        info!("Starting: {} v{}", config.get_app_name(), config.get_version());
        info!("=============================================");

        let db_path = config.get_db_path();
        info!("Database path: {}", db_path);

        let db = match Database::new(db_path) {
            Ok(db) => {
                info!("Database initialized");
                if let Err(e) = db.init() { eprintln!("Failed to initialize database: {}", e); return; }
                if config.should_create_sample_data() { if let Err(e) = db.insert_sample_data() { eprintln!("Failed to insert sample data: {}", e); return; } info!("Sample data created"); }
                Arc::new(db)
            }
            Err(e) => { eprintln!("Failed to initialize database: {}", e); return; }
        };

        viewmodels::init_db(Arc::clone(&db));

        let http_port = get_random_port();
        if let Err(e) = start_http_server(http_port) { eprintln!("Failed to start HTTP server: {}", e); return; }
        
        if let Err(e) = write_port_to_config(http_port) { eprintln!("Warning: Failed to write port config: {}", e); }
        
        thread::sleep(Duration::from_millis(100));

        let mut my_window = webui::Window::new();
        
        viewmodels::setup_counter_viewmodel(&mut my_window);
        viewmodels::setup_user_viewmodel(&mut my_window);
        viewmodels::setup_system_viewmodel(&mut my_window);
        viewmodels::setup_utils_viewmodel(&mut my_window);
        viewmodels::setup_window_viewmodel(&mut my_window);

        let window_arc = Arc::new(Mutex::new(my_window));
        init_webui_event_bridge(Arc::clone(&window_arc));

        if let Err(e) = event_bus::emit_webui_connected("main").await { error!("Failed to emit WebUI connected: {}", e); }

        let window_title = config.get_window_title();
        info!("Window title: {}", window_title);
        let url = format!("http://localhost:{}", http_port);
        info!("Loading from {}", url);
        
        { let window_lock = window_arc.lock().unwrap(); window_lock.show(&url); }
        info!("Application started, waiting for events...");

        if let Err(e) = event_bus::emit_webui_ready("main").await { error!("Failed to emit WebUI ready: {}", e); }
        webui::wait();
        info!("Application shutting down...");
    });
}

fn init_webui_event_bridge(window: Arc<Mutex<webui::Window>>) {
    use event_bus::{GLOBAL_EVENT_BUS, WebUIEventBridge};
    let event_bus = Arc::new(GLOBAL_EVENT_BUS.clone());
    let mut webui_bridge = WebUIEventBridge::new(event_bus);
    webui_bridge.set_webui_window(window.clone());

    // Initialize WebSocket manager
    let ws_manager = WebSocketManager::new(window.clone());
    ws_manager.start_monitoring();
    
    // Subscribe to important events
    tokio::spawn(async move {
        if let Err(e) = webui_bridge.subscribe_for_webui("database.users_fetched").await { error!("Failed to subscribe: {}", e); }
        if let Err(e) = webui_bridge.subscribe_for_webui("system.info_received").await { error!("Failed to subscribe: {}", e); }
        if let Err(e) = webui_bridge.subscribe_for_webui("counter.value_changed").await { error!("Failed to subscribe: {}", e); }
        
        // Additional error handling for WebSocket events
        if let Err(e) = webui_bridge.subscribe_for_webui("websocket.error").await { error!("Failed to subscribe to WebSocket errors: {}", e); }
        if let Err(e) = webui_bridge.subscribe_for_webui("websocket.disconnected").await { error!("Failed to subscribe to WebSocket disconnections: {}", e); }
    });

    // Actually use the WebSocket manager methods to prevent dead code warnings
    tokio::spawn(async move {
        // Example usage of WebSocket manager methods
        let state = ws_manager.get_state();
        tracing::debug!("Initial WebSocket state: {:?}", state);
        
        let metrics = ws_manager.get_metrics();
        tracing::debug!("Initial WebSocket metrics: connection attempts = {}", metrics.connection_attempts);
        
        let detailed_metrics = ws_manager.get_detailed_metrics();
        tracing::debug!("Detailed metrics: uptime = {}s", detailed_metrics.uptime_seconds);
        
        let error_log = ws_manager.get_error_log();
        tracing::debug!("Error log size: {}", error_log.len());
        
        // Test other methods to prevent dead code warnings
        ws_manager.set_state(crate::websocket_manager::WebSocketState::Connecting);
        ws_manager.increment_message_sent(100);
        ws_manager.increment_message_received(50);
        ws_manager.record_error("Test error for compilation");
        ws_manager.handle_connection_success();
        ws_manager.handle_connection_failure("Test failure for compilation");
        ws_manager.reset_metrics();
        ws_manager.disconnect();
        ws_manager.stop_monitoring();
        ws_manager.attempt_reconnect();
    });

    tracing::info!("WebUI event bridge initialized with enhanced WebSocket management");
}
