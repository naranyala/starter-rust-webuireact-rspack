use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::future::Future;
use std::pin::Pin;
use std::time::Duration;
use tokio::sync::broadcast;
use serde::{Serialize, Deserialize};
use tracing::{info, error, debug, warn};
use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;
use lazy_static::lazy_static;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EventPriority {
    Low,
    Normal,
    High,
    Critical,
}

impl Default for EventPriority {
    fn default() -> Self {
        EventPriority::Normal
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventFilter {
    pub source: Option<String>,
    pub priority: Option<EventPriority>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    CounterIncrement,
    CounterReset,
    CounterValueChanged { value: i32 },
    DatabaseConnected,
    DatabaseDisconnected,
    UsersFetched { count: usize, users: Vec<serde_json::Value> },
    UserAdded { id: i32, name: String },
    UserUpdated { id: i32, name: String },
    UserDeleted { id: i32 },
    SystemInfoRequested,
    SystemInfoReceived { cpu: String, memory: String, os: String },
    WebUIConnected,
    WebUIReady,
    WebUIDisconnected,
    BuildStarted { build_id: String },
    BuildProgress { build_id: String, step: String, progress: f32 },
    BuildCompleted { build_id: String, success: bool, duration_ms: u64 },
    Custom { name: String, payload: serde_json::Value },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub name: String,
    pub event_type: EventType,
    pub timestamp: i64,
    pub source: String,
    pub target: Option<String>,
    pub priority: EventPriority,
    pub metadata: HashMap<String, serde_json::Value>,
    pub correlation_id: Option<String>,
    pub reply_to: Option<String>,
}

impl Event {
    pub fn new(event_type: EventType, source: &str) -> Self {
        let name = Self::get_event_name(&event_type);
        Event {
            id: Uuid::new_v4().to_string(),
            name,
            event_type,
            timestamp: Utc::now().timestamp_millis(),
            source: source.to_string(),
            target: None,
            priority: EventPriority::Normal,
            metadata: HashMap::new(),
            correlation_id: None,
            reply_to: None,
        }
    }

    pub fn with_name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    pub fn with_target(mut self, target: &str) -> Self {
        self.target = Some(target.to_string());
        self
    }

    pub fn with_priority(mut self, priority: EventPriority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }

    pub fn with_correlation_id(mut self, correlation_id: &str) -> Self {
        self.correlation_id = Some(correlation_id.to_string());
        self
    }

    pub fn with_reply_to(mut self, reply_to: &str) -> Self {
        self.reply_to = Some(reply_to.to_string());
        self
    }

    fn get_event_name(event_type: &EventType) -> String {
        match event_type {
            EventType::CounterIncrement => "counter.increment".to_string(),
            EventType::CounterReset => "counter.reset".to_string(),
            EventType::CounterValueChanged { .. } => "counter.value_changed".to_string(),
            EventType::DatabaseConnected => "database.connected".to_string(),
            EventType::DatabaseDisconnected => "database.disconnected".to_string(),
            EventType::UsersFetched { .. } => "database.users_fetched".to_string(),
            EventType::UserAdded { .. } => "database.user_added".to_string(),
            EventType::UserUpdated { .. } => "database.user_updated".to_string(),
            EventType::UserDeleted { .. } => "database.user_deleted".to_string(),
            EventType::SystemInfoRequested => "system.info_requested".to_string(),
            EventType::SystemInfoReceived { .. } => "system.info_received".to_string(),
            EventType::WebUIConnected => "webui.connected".to_string(),
            EventType::WebUIReady => "webui.ready".to_string(),
            EventType::WebUIDisconnected => "webui.disconnected".to_string(),
            EventType::BuildStarted { .. } => "build.started".to_string(),
            EventType::BuildProgress { .. } => "build.progress".to_string(),
            EventType::BuildCompleted { .. } => "build.completed".to_string(),
            EventType::Custom { name, .. } => name.clone(),
        }
    }
}

pub struct Subscription {
    pub id: String,
    pub pattern: String,
    pub priority: i32,
}

pub trait EventListener: Send + Sync {
    fn handle_event(&self, event: &Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>>;
}

pub struct EventHandler<F>
where
    F: Fn(Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync + 'static,
{
    handler: F,
}

impl<F> EventHandler<F>
where
    F: Fn(Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync + 'static,
{
    pub fn new(handler: F) -> Self {
        EventHandler { handler }
    }
}

impl<F> EventListener for EventHandler<F>
where
    F: Fn(Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync + 'static,
{
    fn handle_event(&self, event: &Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> {
        (self.handler)(event.clone())
    }
}

#[derive(Clone)]
pub struct EventBus {
    subscriptions: Arc<RwLock<HashMap<String, Vec<(String, Arc<dyn EventListener>)>>>>,
    broadcast_tx: broadcast::Sender<Event>,
    event_history: Arc<Mutex<Vec<Event>>>,
    max_history_size: usize,
}

impl EventBus {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(256);
        EventBus {
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
            event_history: Arc::new(Mutex::new(Vec::new())),
            max_history_size: 1000,
        }
    }

    pub fn subscribe(&self, pattern: &str, listener: Arc<dyn EventListener>) -> String {
        let id = Uuid::new_v4().to_string();
        let mut subs = self.subscriptions.write().unwrap();
        subs.entry(pattern.to_string()).or_insert_with(Vec::new).push((id.clone(), listener));
        debug!("Subscribed to pattern: {}", pattern);
        id
    }

    pub fn unsubscribe(&self, subscription_id: &str) -> bool {
        let mut subs = self.subscriptions.write().unwrap();
        for (_, subscriptions) in subs.iter_mut() {
            if let Some(pos) = subscriptions.iter().position(|(id, _)| id == subscription_id) {
                subscriptions.remove(pos);
                return true;
            }
        }
        false
    }

    pub async fn emit(&self, event: Event) -> Result<()> {
        debug!("Emitting event: {} from {}", event.name, event.source);

        {
            let mut history = self.event_history.lock().unwrap();
            history.push(event.clone());
            if history.len() > self.max_history_size {
                history.remove(0);
            }
        }

        let _ = self.broadcast_tx.send(event.clone());

        let matching_subs = self.get_matching_subscriptions(&event.name);
        
        for (_, listener) in matching_subs {
            let event_clone = event.clone();
            tokio::spawn(async move {
                if let Err(e) = listener.handle_event(&event_clone).await {
                    error!("Error handling event: {}", e);
                }
            });
        }

        Ok(())
    }

    fn get_matching_subscriptions(&self, event_name: &str) -> Vec<(String, Arc<dyn EventListener>)> {
        let subs = self.subscriptions.read().unwrap();
        let mut matches = Vec::new();

        for (pattern, listeners) in subs.iter() {
            if self.match_pattern(pattern, event_name) {
                matches.extend(listeners.iter().cloned());
            }
        }

        matches
    }

    fn match_pattern(&self, pattern: &str, event_name: &str) -> bool {
        if pattern == event_name || pattern == "*" {
            return true;
        }

        let pattern_parts: Vec<&str> = pattern.split('.').collect();
        let name_parts: Vec<&str> = event_name.split('.').collect();

        if pattern_parts.len() > name_parts.len() {
            return false;
        }

        for (i, part) in pattern_parts.iter().enumerate() {
            if *part == "*" || *part == "**" {
                return true;
            }
            if i >= name_parts.len() || part != &name_parts[i] {
                return false;
            }
        }

        pattern_parts.len() == name_parts.len() || pattern_parts.last() == Some(&"**")
    }

    pub fn get_receiver(&self) -> broadcast::Receiver<Event> {
        self.broadcast_tx.subscribe()
    }

    pub fn get_event_history(&self, limit: Option<usize>) -> Vec<Event> {
        let history = self.event_history.lock().unwrap();
        match limit {
            Some(l) => history.iter().rev().take(l).cloned().collect(),
            None => history.clone(),
        }
    }

    pub async fn emit_counter_increment(&self, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::CounterIncrement, source)).await
    }

    pub async fn emit_counter_reset(&self, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::CounterReset, source)).await
    }

    pub async fn emit_counter_value_changed(&self, value: i32, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::CounterValueChanged { value }, source)).await
    }

    pub async fn emit_users_fetched(&self, count: usize, users: Vec<serde_json::Value>, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::UsersFetched { count, users }, source)).await
    }

    pub async fn emit_system_info_request(&self, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::SystemInfoRequested, source)).await
    }

    pub async fn emit_build_started(&self, build_id: &str, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::BuildStarted { build_id: build_id.to_string() }, source)).await
    }

    pub async fn emit_build_progress(&self, build_id: &str, step: &str, progress: f32, source: &str) -> Result<()> {
        self.emit(Event::new(
            EventType::BuildProgress { build_id: build_id.to_string(), step: step.to_string(), progress }, 
            source
        )).await
    }

    pub async fn emit_build_completed(&self, build_id: &str, success: bool, duration_ms: u64, source: &str) -> Result<()> {
        self.emit(Event::new(
            EventType::BuildCompleted { build_id: build_id.to_string(), success, duration_ms }, 
            source
        )).await
    }

    pub async fn emit_custom(&self, name: &str, payload: serde_json::Value, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::Custom { name: name.to_string(), payload }, source)).await
    }

    pub async fn emit_webui_connected(&self, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::WebUIConnected, source)).await
    }

    pub async fn emit_webui_ready(&self, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::WebUIReady, source)).await
    }

    pub async fn emit_webui_disconnected(&self, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::WebUIDisconnected, source)).await
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

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

pub struct WebUIEventBridge {
    event_bus: Arc<EventBus>,
    webui_window: Option<Arc<Mutex<webui_rs::webui::Window>>>,
}

impl WebUIEventBridge {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self {
            event_bus,
            webui_window: None,
        }
    }

    pub fn set_webui_window(&mut self, window: Arc<Mutex<webui_rs::webui::Window>>) {
        self.webui_window = Some(window);
    }

    pub async fn send_to_frontend(&self, event: &Event) -> Result<()> {
        if let Some(ref window) = self.webui_window {
            let payload = serde_json::json!({
                "event": event.name,
                "timestamp": event.timestamp,
                "source": event.source,
            });

            info!("Sending to frontend: {}", event.name);
        }
        Ok(())
    }

    pub async fn subscribe_for_webui(&self, event_pattern: &str) -> Result<()> {
        let event_bus = self.event_bus.clone();
        let pattern = event_pattern.to_string();

        let listener = Arc::new(EventHandler::new(move |event| {
            let bus = event_bus.clone();
            Box::pin(async move {
                info!("Forwarding to frontend: {}", event.name);
                Ok(())
            })
        }));

        self.event_bus.subscribe(&pattern, listener);
        info!("Subscribed frontend to: {}", pattern);
        Ok(())
    }
}

impl Clone for WebUIEventBridge {
    fn clone(&self) -> Self {
        Self {
            event_bus: self.event_bus.clone(),
            webui_window: self.webui_window.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_event_subscription() {
        let bus = EventBus::new();
        let received = Arc::new(Mutex::new(false));
        let received_clone = received.clone();

        let listener = Arc::new(EventHandler::new(move |_| {
            let r = received_clone.clone();
            Box::pin(async move {
                *r.lock().unwrap() = true;
                Ok(())
            })
        }));

        bus.subscribe("test.event", listener).await;

        bus.emit(Event::new(EventType::Custom { 
            name: "test.event".to_string(), 
            payload: serde_json::json!({}) 
        }, "test")).await.unwrap();

        tokio::time::sleep(Duration::from_millis(50)).await;

        assert!(*received.lock().unwrap());
    }
}
