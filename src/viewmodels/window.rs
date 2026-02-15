use tracing::{info, error};
use webui_rs::webui;
use serde_json::{json, Value};
use crate::event_bus::{emit_event, Event, EventType};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

static WEBUI_WINDOW_ID: Lazy<Arc<Mutex<Option<usize>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

pub fn set_webui_window_id(window_id: usize) {
    let mut guard = WEBUI_WINDOW_ID.lock().unwrap();
    *guard = Some(window_id);
}

pub fn send_to_frontend(event_name: &str, data: Value) {
    if let Ok(guard) = WEBUI_WINDOW_ID.lock() {
        if let Some(window_id) = *guard {
            let js = format!(
                "if (window.handleBackendEvent) {{ window.handleBackendEvent({}); }}",
                serde_json::to_string(&json!({
                    "event": event_name,
                    "data": data,
                    "timestamp": chrono::Utc::now().timestamp_millis()
                })).unwrap_or_default()
            );
            let mut js_obj = webui::JavaScript {
                timeout: 0,
                script: js,
                error: false,
                data: String::new(),
            };
            webui::run_js(window_id, &mut js_obj);
        }
    }
}

pub fn setup_window_viewmodel(window: &mut webui::Window) {
    set_webui_window_id(window.id);

    window.bind("test_handler", |_event| {
        info!("[TEST] test_handler called from frontend!");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "test.handler".to_string(),
                    payload: json!({ "status": "success" }),
                },
                "window_viewmodel"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit test event: {}", e);
            }
        });
    });

    window.bind("handleFrontendEvent", |event| {
        info!("[WEBUI] handleFrontendEvent called from frontend");
        
        let event_data = parse_event_data(&event);
        
        tokio::spawn(async move {
            let frontend_event = Event::new(
                EventType::Custom {
                    name: event_data.get("event").and_then(|v| v.as_str()).unwrap_or("frontend.event").to_string(),
                    payload: event_data.get("data").cloned().unwrap_or(json!({})),
                },
                "frontend"
            );
            
            if let Err(e) = emit_event(frontend_event).await {
                error!("Failed to emit frontend event: {}", e);
            } else {
                info!("[WEBUI] Frontend event emitted successfully");
            }
        });
    });

    window.bind("window_focused", |_event| {
        info!("[WEBUI] ===> window_focused <===");
        send_to_frontend("window.focused", json!({ "source": "backend" }));
    });

    window.bind("window_minimized", |_event| {
        info!("[WEBUI] ===> window_minimized <===");
        send_to_frontend("window.minimized", json!({ "source": "backend" }));
    });

    window.bind("window_closed", |_event| {
        info!("[WEBUI] ===> window_closed <===");
    });

    window.bind("window_restored", |_event| {
        info!("[WEBUI] ===> window_restored <===");
        send_to_frontend("window.restored", json!({ "source": "backend" }));
    });

    window.bind("window_maximized", |_event| {
        info!("[WEBUI] ===> window_maximized <===");
        send_to_frontend("window.maximized", json!({ "source": "backend" }));
    });

    info!("[VIEWMODEL] Window viewmodel handlers registered");
}

fn parse_event_data(event: &webui::Event) -> Value {
    let element_ptr = event.element;
    if element_ptr.is_null() {
        return json!({});
    }
    
    let c_str = unsafe { std::ffi::CStr::from_ptr(element_ptr) };
    let element_id = c_str.to_string_lossy().to_string();
    
    if element_id.is_empty() {
        return json!({});
    }
    
    json!({ "element": element_id })
}
