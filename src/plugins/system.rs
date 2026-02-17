use crate::event_bus::emit_event;
use crate::plugins::PluginTrait;
use serde_json::json;
use tracing::info;

pub struct SystemPlugin;

impl SystemPlugin {
    pub fn new() -> Self {
        Self
    }
}

impl Default for SystemPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginTrait for SystemPlugin {
    fn name(&self) -> &str {
        "system"
    }

    fn setup(&self, window: &mut webui::Window) -> Result<(), Box<dyn std::error::Error>> {
        window.bind("get_system_info", |_event| {
            info!("Frontend: get_system_info called");

            let system_info = serde_json::json!({
                "os": std::env::consts::OS,
                "arch": std::env::consts::ARCH,
                "family": std::env::consts::FAMILY,
            });

            info!("System info: {:?}", system_info);
        });

        window.bind("get_app_version", |_event| {
            info!("Frontend: get_app_version called");
        });

        info!("SystemPlugin initialized");
        Ok(())
    }
}
