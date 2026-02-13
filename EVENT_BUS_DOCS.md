# Event Bus System - Event Types and Interfaces

## Overview
This document describes the event types and interfaces for the bidirectional event bus system connecting the Rust backend and React frontend.

## Backend (Rust) Event Types

### Core Event Types
```rust
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
```

### Event Structure
```rust
pub struct Event {
    pub id: String,                    // Unique identifier for the event
    pub event_type: EventType,         // The type of event
    pub timestamp: u64,               // Unix timestamp in milliseconds
    pub source: String,               // Component that originated the event
    pub target: Option<String>,       // Specific target (if any)
    pub metadata: HashMap<String, serde_json::Value>, // Additional metadata
}
```

### Event Bus Interface
```rust
pub trait EventListener: Send + Sync {
    fn handle_event(&self, event: &Event) -> Pin<Box<dyn Future<Output = Result<()>> + Send>>;
}

pub struct EventBus {
    // Methods for publishing/subscribing to events
    pub fn subscribe(&self, event_type: &str, listener: Arc<dyn EventListener>);
    pub fn emit(&self, event: Event) -> Result<()>;
    pub fn get_receiver(&self) -> broadcast::Receiver<Event>;
    
    // Helper methods for common events
    pub async fn emit_counter_increment(&self, source: &str) -> Result<()>;
    pub async fn emit_users_fetched(&self, count: usize, users: Vec<serde_json::Value>, source: &str) -> Result<()>;
    // ... other helper methods
}
```

## Frontend (JavaScript) Event Types

### Core Event Constants
```javascript
export const EVENT_TYPES = {
  COUNTER_INCREMENT: 'counter.increment',
  COUNTER_RESET: 'counter.reset',
  COUNTER_VALUE_CHANGED: 'counter.value_changed',
  DATABASE_CONNECTED: 'database.connected',
  DATABASE_DISCONNECTED: 'database.disconnected',
  USERS_FETCHED: 'database.users_fetched',
  USER_ADDED: 'database.user_added',
  USER_UPDATED: 'database.user_updated',
  USER_DELETED: 'database.user_deleted',
  SYSTEM_INFO_REQUESTED: 'system.info_requested',
  SYSTEM_INFO_RECEIVED: 'system.info_received',
  WEBUI_CONNECTED: 'webui.connected',
  WEBUI_READY: 'webui.ready',
  WEBUI_DISCONNECTED: 'webui.disconnected',
  CUSTOM: 'custom'
};
```

### Event Bus Interface
```javascript
class EventBus {
  // Subscription methods
  subscribe(eventName, callback, options = {});
  subscribeOnce(eventName, callback, options = {});
  unsubscribe(eventName, subscriptionId);
  
  // Publishing methods
  emit(eventOrName, data = null, metadata = {});
  forwardToBackend(eventName, data);
  sendToBackendWithResponse(eventName, data, timeout = 5000);
  
  // Query methods
  getHistory(eventName = null);
  getEventNames();
  getListenerCount(eventName);
  waitFor(eventName, timeout = null);
  
  // Middleware
  use(middleware);
}
```

## Event Flow Patterns

### 1. Backend-to-Frontend Communication
```
Backend emits event → EventBus → Broadcast to subscribers → Frontend receives via DOM event
```

### 2. Frontend-to-Backend Communication
```
Frontend emits event → EventBus → forwardToBackend → WebUI.run() → Backend handler
```

### 3. Bidirectional Communication
```
Frontend requests data → Backend processes → Backend emits response → Frontend receives
```

## Common Event Payloads

### Users Fetched Event
```json
{
  "id": "unique-event-id",
  "name": "database.users_fetched",
  "data": {
    "users": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "role": "admin",
        "status": "active"
      }
    ],
    "count": 1
  },
  "timestamp": 1234567890,
  "source": "db_handler",
  "metadata": {
    "request_id": "req-123"
  }
}
```

### System Info Received Event
```json
{
  "id": "unique-event-id",
  "name": "system.info_received",
  "data": {
    "cpu": "Intel Core i7",
    "memory": "16GB",
    "os": "linux"
  },
  "timestamp": 1234567890,
  "source": "sysinfo_handler",
  "metadata": {}
}
```

## Integration Points

### Backend Integration
- WebUI event handlers in `handlers.rs`
- Database operations
- System information gathering
- Application lifecycle events

### Frontend Integration
- React component event handling
- UI state updates
- WebUI communication bridge
- WinBox window management

## Error Handling

### Backend Error Events
Events with error information are emitted when operations fail:
- `EventType::Custom` with error details in payload
- Proper error logging and propagation

### Frontend Error Handling
- Middleware for error logging
- Promise-based error handling for backend communications
- Graceful degradation when backend is unavailable

## Performance Considerations

- Event history is limited to prevent memory leaks
- Efficient event filtering and routing
- Asynchronous event processing
- Proper cleanup of event listeners