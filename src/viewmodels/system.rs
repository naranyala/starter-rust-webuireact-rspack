use tracing::{info, error};
use webui_rs::webui;
use crate::event_bus::{emit_event, emit_system_info_request, Event, EventType};

pub fn setup_system_viewmodel(window: &mut webui::Window) {
    window.bind("get_system_info", |_event| {
        info!("Get system info event received");
        
        tokio::spawn(async {
            if let Err(e) = emit_system_info_request("system_viewmodel").await {
                error!("Failed to emit system info request event: {}", e);
            }
            
            let event = Event::new(
                EventType::SystemInfoReceived {
                    cpu: "Intel Core i7".to_string(),
                    memory: "16GB".to_string(),
                    os: std::env::consts::OS.to_string(),
                },
                "system_viewmodel"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit system info received event: {}", e);
            }
        });
    });

    info!("System viewmodel handlers registered");
}
