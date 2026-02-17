use super::types::{Event, EventType, EventPriority};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::future::Future;
use std::pin::Pin;
use tokio::sync::broadcast;
use tracing::{info, error, debug};
use anyhow::Result;
use uuid::Uuid;
use lazy_static::lazy_static;

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
        if pattern == event_name || pattern == "*" { return true; }
        let pattern_parts: Vec<&str> = pattern.split('.').collect();
        let name_parts: Vec<&str> = event_name.split('.').collect();
        if pattern_parts.len() > name_parts.len() { return false; }
        for (i, part) in pattern_parts.iter().enumerate() {
            if *part == "*" || *part == "**" { return true; }
            if i >= name_parts.len() || part != &name_parts[i] { return false; }
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
        self.emit(Event::new(EventType::BuildProgress { build_id: build_id.to_string(), step: step.to_string(), progress }, source)).await
    }

    pub async fn emit_build_completed(&self, build_id: &str, success: bool, duration_ms: u64, source: &str) -> Result<()> {
        self.emit(Event::new(EventType::BuildCompleted { build_id: build_id.to_string(), success, duration_ms }, source)).await
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
}

impl Default for EventBus {
    fn default() -> Self { Self::new() }
}

pub struct WebUIEventBridge {
    event_bus: Arc<EventBus>,
    webui_window: Option<Arc<Mutex<webui_rs::webui::Window>>>,
}

impl WebUIEventBridge {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self { event_bus, webui_window: None }
    }

    pub fn set_webui_window(&mut self, window: Arc<Mutex<webui_rs::webui::Window>>) {
        self.webui_window = Some(window);
    }

    pub async fn send_to_frontend(&self, event: &Event) -> Result<()> {
        if let Some(ref _window) = self.webui_window {
            info!("Sending to frontend: {}", event.name);
        }
        Ok(())
    }

    pub async fn subscribe_for_webui(&self, event_pattern: &str) -> Result<()> {
        let event_bus = self.event_bus.clone();
        let pattern = event_pattern.to_string();
        let listener = Arc::new(EventHandler::new(move |_event| {
            let _bus = event_bus.clone();
            Box::pin(async move {
                info!("Forwarding to frontend: {}", _event.name);
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
