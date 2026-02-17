use std::sync::Arc;

pub mod counter;
pub mod system;
pub mod user;
pub mod window;

pub use counter::CounterPlugin;
pub use system::SystemPlugin;
pub use user::UserPlugin;
pub use window::WindowPlugin;

use crate::event_bus::Event;

pub trait PluginTrait: Send + Sync {
    fn name(&self) -> &str;
    fn setup(&self, window: &mut webui::Window) -> Result<(), Box<dyn std::error::Error>>;
}

pub struct PluginRegistry {
    plugins: Vec<Box<dyn PluginTrait>>,
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
        }
    }

    pub fn register(&mut self, plugin: Box<dyn PluginTrait>) {
        self.plugins.push(plugin);
    }

    pub fn setup_all(&self, window: &mut webui::Window) -> Result<(), Box<dyn std::error::Error>> {
        for plugin in &self.plugins {
            tracing::info!("Setting up plugin: {}", plugin.name());
            plugin.setup(window)?;
        }
        Ok(())
    }

    pub fn list_plugins(&self) -> Vec<&str> {
        self.plugins.iter().map(|p| p.name()).collect()
    }
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}
