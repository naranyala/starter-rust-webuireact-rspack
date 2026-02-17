use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

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
    CounterValueChanged {
        value: i32,
    },
    DatabaseConnected,
    DatabaseDisconnected,
    UsersFetched {
        count: usize,
        users: Vec<serde_json::Value>,
    },
    UserAdded {
        id: i32,
        name: String,
    },
    UserUpdated {
        id: i32,
        name: String,
    },
    UserDeleted {
        id: i32,
    },
    SystemInfoRequested,
    SystemInfoReceived {
        cpu: String,
        memory: String,
        os: String,
    },
    WebUIConnected,
    WebUIReady,
    WebUIDisconnected,
    BuildStarted {
        build_id: String,
    },
    BuildProgress {
        build_id: String,
        step: String,
        progress: f32,
    },
    BuildCompleted {
        build_id: String,
        success: bool,
        duration_ms: u64,
    },
    Custom {
        name: String,
        payload: serde_json::Value,
    },
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
