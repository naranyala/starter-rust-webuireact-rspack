use tracing::{info, error};
use webui_rs::webui;
use crate::event_bus::{emit_event, Event, EventType};

pub fn setup_utils_viewmodel(window: &mut webui::Window) {
    window.bind("open_folder", |_event| {
        info!("Open folder event received");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "utils.folder_open_requested".to_string(),
                    payload: serde_json::json!({})
                },
                "utils_viewmodel"
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
                    payload: serde_json::json!({})
                },
                "utils_viewmodel"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit images organized event: {}", e);
            }
        });
    });

    window.bind("advanced_operation", |_event| {
        info!("Advanced operation event received");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "advanced.operation_started".to_string(),
                    payload: serde_json::json!({})
                },
                "utils_viewmodel"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit advanced operation event: {}", e);
            }
        });
    });

    window.bind("enhanced_feature", |_event| {
        info!("Enhanced feature event received");
        
        tokio::spawn(async {
            let event = Event::new(
                EventType::Custom {
                    name: "enhanced.feature_used".to_string(),
                    payload: serde_json::json!({})
                },
                "utils_viewmodel"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit enhanced feature event: {}", e);
            }
        });
    });

    info!("Utils viewmodel handlers registered");
}
