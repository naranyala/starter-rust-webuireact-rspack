pub mod types;
pub mod bus;

pub use types::{Event, EventType, EventPriority, EventFilter};
pub use bus::{EventBus, WebUIEventBridge};

use std::sync::Arc;
use anyhow::Result;
use lazy_static::lazy_static;

lazy_static! {
    pub static ref GLOBAL_EVENT_BUS: EventBus = EventBus::new();
}

pub async fn emit_event(event: Event) -> Result<()> {
    GLOBAL_EVENT_BUS.emit(event).await
}

pub async fn emit_counter_increment(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_counter_increment(source).await
}

pub async fn emit_counter_reset(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_counter_reset(source).await
}

pub async fn emit_counter_value_changed(value: i32, source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_counter_value_changed(value, source).await
}

pub async fn emit_users_fetched(count: usize, users: Vec<serde_json::Value>, source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_users_fetched(count, users, source).await
}

pub async fn emit_system_info_request(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_system_info_request(source).await
}

pub async fn emit_build_started(build_id: &str, source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_build_started(build_id, source).await
}

pub async fn emit_build_progress(build_id: &str, step: &str, progress: f32, source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_build_progress(build_id, step, progress, source).await
}

pub async fn emit_build_completed(build_id: &str, success: bool, duration_ms: u64, source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_build_completed(build_id, success, duration_ms, source).await
}

pub async fn emit_custom(name: &str, payload: serde_json::Value, source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_custom(name, payload, source).await
}

pub async fn emit_webui_connected(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_webui_connected(source).await
}

pub async fn emit_webui_ready(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_webui_ready(source).await
}

pub fn get_event_history(limit: Option<usize>) -> Vec<Event> {
    GLOBAL_EVENT_BUS.get_event_history(limit)
}
