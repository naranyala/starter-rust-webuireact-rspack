use log::info;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use webui_rs::webui;

// Import consolidated modules
mod core;
use core::{init_logging_with_config, AppConfig, Database};

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
            let path = if url == "/" {
                frontend_path.join("index.html")
            } else {
                frontend_path.join(url.trim_start_matches('/'))
            };

            info!("HTTP Request: {} -> {:?}", url, path);

            if path.exists() && path.is_file() {
                match std::fs::read(&path) {
                    Ok(content) => {
                        let content_type = mime_guess::from_path(&path)
                            .first_or_octet_stream()
                            .to_string();

                        let response = tiny_http::Response::from_data(content).with_header(
                            tiny_http::Header::from_bytes(
                                &b"Content-Type"[..],
                                content_type.as_bytes(),
                            )
                            .unwrap(),
                        );

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

    // Get window settings from config
    let window_title = config.get_window_title();
    info!("Window title: {}", window_title);

    // Show the built React.js application via HTTP server
    let url = format!("http://localhost:{}", http_port);
    info!("Loading application UI from {}", url);
    my_window.show(&url);

    info!("Application started successfully, waiting for events...");
    info!("=============================================");

    // Wait until all windows are closed
    webui::wait();

    info!("Application shutting down...");
    info!("=============================================");
}
