use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::future::Future;
use std::pin::Pin;
use tokio::sync::broadcast;
use serde::{Serialize, Deserialize};
use tracing::{info, error, debug, warn};
use anyhow::Result;
use std::time::Instant;

// Event types for the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    // UI Events
    CounterIncrement,
    CounterReset,
    CounterValueChanged { value: i32 },
    
    // Database Events
    DatabaseConnected,
    DatabaseDisconnected,
    UsersFetched { count: usize, users: Vec<serde_json::Value> },
    UserAdded { id: i32, name: String },
    UserUpdated { id: i32, name: String },
    UserDeleted { id: i32 },
    
    // System Events
    SystemInfoRequested,
    SystemInfoReceived { cpu: String, memory: String, os: String },
    
    // WebUI Events
    WebUIConnected,
    WebUIReady,
    WebUIDisconnected,
    
    // Custom events with generic payload
    Custom { name: String, payload: serde_json::Value },
}

// Event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub event_type: EventType,
    pub timestamp: u64,
    pub source: String,
    pub target: Option<String>, // Specific target, if any
    pub metadata: HashMap<String, serde_json::Value>, // Additional metadata
}

impl Event {
    pub fn new(event_type: EventType, source: &str) -> Self {
        Event {
            id: uuid::Uuid::new_v4().to_string(),
            event_type,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            source: source.to_string(),
            target: None,
            metadata: HashMap::new(),
        }
    }
    
    pub fn with_target(mut self, target: &str) -> Self {
        self.target = Some(target.to_string());
        self
    }
    
    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }
    
    pub fn get_event_name(&self) -> String {
        match &self.event_type {
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
            EventType::Custom { name, .. } => name.clone(),
        }
    }
}

// Event listener trait
pub trait EventListener: Send + Sync {
    fn handle_event(&self, event: &Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>>;
}

// Concrete implementation of event listener
pub struct EventHandler<F>
where
    F: Fn(&Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync + 'static,
{
    handler: F,
}

impl<F> EventHandler<F>
where
    F: Fn(&Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync + 'static,
{
    pub fn new(handler: F) -> Self {
        EventHandler { handler }
    }
}

impl<F> EventListener for EventHandler<F>
where
    F: Fn(&Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync + 'static,
{
    fn handle_event(&self, event: &Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> {
        (self.handler)(event)
    }
}

// Event bus implementation
pub struct EventBus {
    listeners: Arc<RwLock<HashMap<String, Vec<Arc<dyn EventListener>>>>>,
    broadcast_tx: broadcast::Sender<Event>,
    event_history: Arc<Mutex<Vec<Event>>>,
    max_history_size: usize,
}

impl EventBus {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(100);
        EventBus {
            listeners: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
            event_history: Arc::new(Mutex::new(Vec::new())),
            max_history_size: 100,
        }
    }

    pub fn new_with_history_size(max_history_size: usize) -> Self {
        let (broadcast_tx, _) = broadcast::channel(100);
        EventBus {
            listeners: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
            event_history: Arc::new(Mutex::new(Vec::new())),
            max_history_size,
        }
    }

    pub fn subscribe(&self, event_type: &str, listener: Arc<dyn EventListener>) {
        let mut listeners = self.listeners.write().unwrap();
        listeners.entry(event_type.to_string()).or_insert_with(Vec::new).push(listener);
        drop(listeners);
        info!("Subscribed listener to event type: {}", event_type);
    }

    pub fn unsubscribe(&self, event_type: &str, listener_id: &str) {
        let mut listeners = self.listeners.write().unwrap();
        if let Some(subscribers) = listeners.get_mut(event_type) {
            subscribers.retain(|_| true); // In a real implementation, we'd match by ID
        }
        drop(listeners);
        info!("Unsubscribed listener from event type: {}", event_type);
    }

    pub async fn emit(&self, event: Event) -> Result<()> {
        let start_time = Instant::now();
        let event_name = event.get_event_name();
        
        debug!("Emitting event: {} from {}", event_name, event.source);
        
        // Add to history
        {
            let mut history = self.event_history.lock().unwrap();
            history.push(event.clone());
            if history.len() > self.max_history_size {
                history.remove(0);
            }
        }
        
        // Send to broadcast channel (for external consumers like WebUI)
        let _ = self.broadcast_tx.send(event.clone());
        
        // Send to registered listeners
        let subscribers_to_call = {
            let listeners = self.listeners.read().unwrap();
            listeners.get(&event_name)
                .map(|subscribers| subscribers.clone())
                .unwrap_or_default()
        };
        
        for subscriber in subscribers_to_call {
            if let Err(e) = subscriber.handle_event(&event).await {
                error!("Error handling event by subscriber: {}", e);
            }
        }
        
        let duration = start_time.elapsed();
        debug!("Event {} processed in {:?}", event_name, duration);
        
        Ok(())
    }

    pub fn get_receiver(&self) -> broadcast::Receiver<Event> {
        self.broadcast_tx.subscribe()
    }

    pub fn get_event_history(&self) -> Vec<Event> {
        self.event_history.lock().unwrap().clone()
    }

    pub fn get_events_by_type(&self, event_type: &str) -> Vec<Event> {
        self.event_history
            .lock()
            .unwrap()
            .iter()
            .filter(|event| event.get_event_name() == event_type)
            .cloned()
            .collect()
    }

    // Helper methods for common events
    pub async fn emit_counter_increment(&self, source: &str) -> Result<()> {
        let event = Event::new(EventType::CounterIncrement, source);
        self.emit(event).await
    }

    pub async fn emit_counter_reset(&self, source: &str) -> Result<()> {
        let event = Event::new(EventType::CounterReset, source);
        self.emit(event).await
    }

    pub async fn emit_counter_value_changed(&self, value: i32, source: &str) -> Result<()> {
        let event = Event::new(EventType::CounterValueChanged { value }, source);
        self.emit(event).await
    }

    pub async fn emit_users_fetched(&self, count: usize, users: Vec<serde_json::Value>, source: &str) -> Result<()> {
        let event = Event::new(EventType::UsersFetched { count, users }, source);
        self.emit(event).await
    }

    pub async fn emit_system_info_request(&self, source: &str) -> Result<()> {
        let event = Event::new(EventType::SystemInfoRequested, source);
        self.emit(event).await
    }

    pub async fn emit_webui_connected(&self, source: &str) -> Result<()> {
        let event = Event::new(EventType::WebUIConnected, source);
        self.emit(event).await
    }

    pub async fn emit_webui_ready(&self, source: &str) -> Result<()> {
        let event = Event::new(EventType::WebUIReady, source);
        self.emit(event).await
    }

    pub async fn emit_webui_disconnected(&self, source: &str) -> Result<()> {
        let event = Event::new(EventType::WebUIDisconnected, source);
        self.emit(event).await
    }

    pub async fn emit_custom(&self, name: &str, payload: serde_json::Value, source: &str) -> Result<()> {
        let event = Event::new(EventType::Custom { 
            name: name.to_string(), 
            payload 
        }, source);
        self.emit(event).await
    }
}

// Global event bus instance
use lazy_static::lazy_static;

lazy_static! {
    pub static ref GLOBAL_EVENT_BUS: EventBus = EventBus::new();
}

// Make EventBus cloneable
impl Clone for EventBus {
    fn clone(&self) -> Self {
        EventBus {
            listeners: self.listeners.clone(),
            broadcast_tx: self.broadcast_tx.clone(), // broadcast::Sender implements Clone
            event_history: self.event_history.clone(),
            max_history_size: self.max_history_size,
        }
    }
}

// Helper functions for global event bus
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

pub async fn emit_webui_connected(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_webui_connected(source).await
}

pub async fn emit_webui_ready(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_webui_ready(source).await
}

pub async fn emit_webui_disconnected(source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_webui_disconnected(source).await
}

pub async fn emit_custom(name: &str, payload: serde_json::Value, source: &str) -> Result<()> {
    GLOBAL_EVENT_BUS.emit_custom(name, payload, source).await
}

pub fn get_event_history() -> Vec<Event> {
    GLOBAL_EVENT_BUS.get_event_history()
}

pub fn get_events_by_type(event_type: &str) -> Vec<Event> {
    GLOBAL_EVENT_BUS.get_events_by_type(event_type)
}

// WebUI event bridge
pub struct WebUIEventBridge {
    event_bus: Arc<EventBus>,
    webui_window: Option<Arc<Mutex<webui_rs::webui::Window>>>, // Reference to WebUI window
}

impl WebUIEventBridge {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        WebUIEventBridge { 
            event_bus,
            webui_window: None,
        }
    }

    pub fn set_webui_window(&mut self, window: Arc<Mutex<webui_rs::webui::Window>>) {
        self.webui_window = Some(window);
    }

    // Method to send events to WebUI
    pub async fn send_to_webui(&self, event_name: &str, data: &str) -> Result<()> {
        if let Some(ref window) = self.webui_window {
            let window_ref = window.lock().unwrap();
            
            // In a real implementation, this would use WebUI's API to send events
            // For now, we'll simulate by emitting a custom event
            let payload = serde_json::json!({
                "event": event_name,
                "data": data,
                "timestamp": std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64
            });
            
            // Emit a custom event that can be handled by frontend
            self.event_bus.emit_custom("webui.send", payload, "WebUIEventBridge").await?;
            
            info!("Sent to WebUI: {} with data: {}", event_name, data);
        } else {
            warn!("WebUI window not set, cannot send event: {}", event_name);
        }
        
        Ok(())
    }

    // Subscribe to events and forward to WebUI
    pub async fn subscribe_for_webui(&self, event_type: &str) -> Result<()> {
        let event_bus = self.event_bus.clone();
        let event_type_owned = event_type.to_string();
        let event_type_for_subscribe = event_type_owned.clone(); // Create a separate copy for subscription

        // Create a listener that forwards to WebUI
        let listener = Arc::new(EventHandler::new(move |event| {
            let event_json = serde_json::to_string(event).unwrap_or_default();
            let event_bus_clone = event_bus.clone();
            let event_type_local = event_type_owned.clone();
            
            Box::pin(async move {
                info!("Forwarding event to WebUI: {} - {}", event_type_local, event_json);
                
                // In a real implementation, we would send this to the WebUI window
                // For now, we'll emit another event that can be caught by the frontend
                let payload = serde_json::json!({
                    "original_event": event_type_local,
                    "event_data": event_json,
                    "forwarded_at": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64
                });
                
                event_bus_clone.emit_custom("webui.forward", payload, "WebUIEventBridge").await?;
                Ok(())
            })
        }));

        self.event_bus.subscribe(&event_type_for_subscribe, listener);
        Ok(())
    }
}

// Implement clone for WebUIEventBridge
impl Clone for WebUIEventBridge {
    fn clone(&self) -> Self {
        WebUIEventBridge {
            event_bus: self.event_bus.clone(),
            webui_window: self.webui_window.clone(), // This will only work if Window is wrapped in Arc<Mutex<>>
        }
    }
}