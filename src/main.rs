use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tracing::{info, error, warn};
use webui_rs::webui;
use tokio::runtime::{Runtime, Builder};

// Declare modules at the crate level so they can be accessed from other modules
mod build_logger;
mod event_bus;
mod core;
use core::{init_logging_with_config, AppConfig, Database, emit_webui_connected, emit_webui_ready};

mod handlers;
use handlers::*;

// Build-time generated config
include!(concat!(env!("OUT_DIR"), "/build_config.rs"));

fn start_http_server(port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let frontend_path = std::path::PathBuf::from("frontend/dist");

    info!("Starting HTTP server on port {} for frontend files", port);
    info!(
        "Serving files from: {}",
        frontend_path
            .canonicalize()
            .unwrap_or(frontend_path.clone())
            .display()
    );

    let server = tiny_http::Server::http(format!("0.0.0.0:{}", port))?;

    thread::spawn(move || {
        info!("HTTP server listening on http://localhost:{}", port);

        for request in server.incoming_requests() {
            let url = request.url().to_string();
            
            // Validate and sanitize URL to prevent path traversal
            let sanitized_path = url
                .trim_start_matches('/')
                .replace("..", "")  // Remove parent directory references
                .replace("%2e%2e", "")  // URL-encoded parent directory
                .replace("%252e%252e", "");
            
            let path = if url == "/" {
                frontend_path.join("index.html")
            } else {
                frontend_path.join(&sanitized_path)
            };

            // Security: Ensure resolved path is within frontend directory
            let canonical_path = match path.canonicalize() {
                Ok(p) => p,
                Err(_) => {
                    let response = tiny_http::Response::from_string("Not Found")
                        .with_status_code(404);
                    let _ = request.respond(response);
                    continue;
                }
            };
            
            let frontend_canonical = match frontend_path.canonicalize() {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("Error canonicalizing frontend path: {}", e);
                    let response = tiny_http::Response::from_string("Internal Server Error")
                        .with_status_code(500);
                    let _ = request.respond(response);
                    continue;
                }
            };

            if !canonical_path.starts_with(&frontend_canonical) {
                // Path traversal attempt detected
                eprintln!("Security: Path traversal attempt blocked: {}", url);
                let response = tiny_http::Response::from_string("Forbidden")
                    .with_status_code(403);
                let _ = request.respond(response);
                continue;
            }

            info!("HTTP Request: {} -> {:?}", url, path);

            if path.exists() && path.is_file() {
                match std::fs::read(&path) {
                    Ok(content) => {
                        let content_type = mime_guess::from_path(&path)
                            .first_or_octet_stream()
                            .to_string();

                        // Security headers
                        let security_headers = vec![
                            tiny_http::Header::from_bytes(&b"X-Content-Type-Options"[..], b"nosniff").unwrap(),
                            tiny_http::Header::from_bytes(&b"X-Frame-Options"[..], b"DENY").unwrap(),
                            tiny_http::Header::from_bytes(&b"Referrer-Policy"[..], b"strict-origin-when-cross-origin").unwrap(),
                            tiny_http::Header::from_bytes(&b"Content-Security-Policy"[..], b"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: http: https:; font-src 'self' data:;").unwrap(),
                        ];

                        let mut response = tiny_http::Response::from_data(content);
                        response = response.with_header(
                            tiny_http::Header::from_bytes(
                                &b"Content-Type"[..],
                                content_type.as_bytes(),
                            )
                            .unwrap(),
                        );
                        
                        // Add security headers
                        for header in security_headers {
                            response = response.with_header(header);
                        }

                        if let Err(e) = request.respond(response) {
                            eprintln!("Error sending response: {}", e);
                        }
                    }
                    Err(e) => {
                        eprintln!("Error reading file {:?}: {}", path, e);
                        let response = tiny_http::Response::from_string(format!("Error: {}", e))
                            .with_status_code(500);
                        let _ = request.respond(response);
                    }
                }
            } else {
                let response = tiny_http::Response::from_string("Not Found").with_status_code(404);
                let _ = request.respond(response);
            }
        }
    });

    Ok(())
}

fn main() {
    // Initialize Tokio runtime for async operations
    let rt = Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime");
    
    rt.block_on(async {
        // Load application configuration
        let config = match AppConfig::load() {
            Ok(config) => {
                println!("Configuration loaded successfully!");
                println!(
                    "Application: {} v{}",
                    config.get_app_name(),
                    config.get_version()
                );
                config
            }
            Err(e) => {
                eprintln!("Failed to load configuration: {}", e);
                eprintln!("Using default configuration");
                AppConfig::default()
            }
        };

        // Initialize logging system with config settings
        if let Err(e) = init_logging_with_config(
            Some(config.get_log_file()),
            config.get_log_level(),
            config.is_append_log(),
        ) {
            eprintln!("Failed to initialize logger: {}", e);
            return;
        }

        info!("=============================================");
        info!(
            "Starting: {} v{}",
            config.get_app_name(),
            config.get_version()
        );
        info!("=============================================");

        info!("Application starting...");

        // Get database path from config
        let db_path = config.get_db_path();
        info!("Database path: {}", db_path);

        // Initialize SQLite database
        let db = match Database::new(db_path) {
            Ok(db) => {
                info!("Database initialized successfully");
                if let Err(e) = db.init() {
                    eprintln!("Failed to initialize database schema: {}", e);
                    return;
                }
                if config.should_create_sample_data() {
                    if let Err(e) = db.insert_sample_data() {
                        eprintln!("Failed to insert sample data: {}", e);
                        return;
                    }
                    info!("Sample data created (if not exists)");
                }
                Arc::new(db)
            }
            Err(e) => {
                eprintln!("Failed to initialize database: {}", e);
                return;
            }
        };

        // Initialize database handlers with the database instance
        init_database(Arc::clone(&db));

        // Start HTTP server for frontend files
        let http_port = 8080u16;
        if let Err(e) = start_http_server(http_port) {
            eprintln!("Failed to start HTTP server: {}", e);
            return;
        }

        // Give the server a moment to start
        thread::sleep(Duration::from_millis(100));

        // Create a new window
        let mut my_window = webui::Window::new();

        // Set up UI event handlers
        setup_ui_handlers(&mut my_window);
        setup_counter_handlers(&mut my_window);
        setup_db_handlers(&mut my_window);
        setup_sysinfo_handlers(&mut my_window);
        setup_utils_handlers(&mut my_window);
        setup_advanced_handlers(&mut my_window);
        setup_enhanced_handlers(&mut my_window);

        // Initialize WebUI event bridge for bidirectional communication
        let window_arc = Arc::new(Mutex::new(my_window));
        init_webui_event_bridge(Arc::clone(&window_arc));

        // Emit WebUI connected event
        if let Err(e) = emit_webui_connected("main").await {
            error!("Failed to emit WebUI connected event: {}", e);
        }

        // Get window settings from config
        let window_title = config.get_window_title();
        info!("Window title: {}", window_title);

        // Show the built React.js application via HTTP server
        let url = format!("http://localhost:{}", http_port);
        info!("Loading application UI from {}", url);
        
        // Lock the window to show it
        {
            let mut window_lock = window_arc.lock().unwrap();
            window_lock.show(&url);
        }

        info!("Application started successfully, waiting for events...");
        info!("=============================================");

        // Emit WebUI ready event
        if let Err(e) = emit_webui_ready("main").await {
            error!("Failed to emit WebUI ready event: {}", e);
        }

        // Wait until all windows are closed
        webui::wait();

        info!("Application shutting down...");
        info!("=============================================");
    });
}
