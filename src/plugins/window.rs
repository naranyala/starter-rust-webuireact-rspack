use crate::plugins::PluginTrait;
use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicUsize, Ordering};
use tracing::info;

static WINDOW_ID: AtomicUsize = AtomicUsize::new(1);

pub struct WindowPlugin;

impl WindowPlugin {
    pub fn new() -> Self {
        Self
    }

    pub fn get_next_id() -> usize {
        WINDOW_ID.fetch_add(1, Ordering::SeqCst)
    }
}

impl Default for WindowPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginTrait for WindowPlugin {
    fn name(&self) -> &str {
        "window"
    }

    fn setup(&self, window: &mut webui::Window) -> Result<(), Box<dyn std::error::Error>> {
        let window_id = window.id();

        window.bind("test_handler", move |_event| {
            info!(
                "[TEST] test_handler called from frontend! Window ID: {}",
                window_id
            );
        });

        window.bind("handleFrontendEvent", |event| {
            info!("[WEBUI] handleFrontendEvent called");
        });

        window.bind("minimize_window", |event| {
            info!("[WEBUI] minimize_window called");
        });

        window.bind("maximize_window", |event| {
            info!("[WEBUI] maximize_window called");
        });

        window.bind("close_window", |event| {
            info!("[WEBUI] close_window called");
        });

        info!("WindowPlugin initialized for window {}", window_id);
        Ok(())
    }
}
