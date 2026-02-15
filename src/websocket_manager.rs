use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::interval;
use tracing::{info, error, warn, trace};
use webui_rs::webui;
use serde_json::json;
use crate::event_bus::{emit_event, Event, EventType};
use std::collections::VecDeque;

#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)] // These variants are part of the design and may be used in future implementations
pub enum WebSocketState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // These fields are part of the design and may be used in future implementations
pub struct WebSocketMetrics {
    pub connection_attempts: u32,
    pub successful_connections: u32,
    pub failed_connections: u32,
    pub messages_sent: u64,
    pub messages_received: u64,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub last_error: Option<String>,
    pub last_error_time: Option<u64>,
    pub uptime_seconds: u64,
    pub avg_ping_time: Option<f64>,
    pub connection_duration: Option<Duration>,
    pub reconnect_count: u32,
}

pub struct WebSocketManager {
    state: Arc<Mutex<WebSocketState>>,
    metrics: Arc<Mutex<WebSocketMetrics>>,
    window: Arc<Mutex<webui::Window>>,
    reconnect_interval: Duration,
    max_reconnect_attempts: u32,
    current_reconnect_attempt: Arc<Mutex<u32>>,
    is_running: Arc<Mutex<bool>>,
    connection_start_time: Arc<Mutex<Option<Instant>>>,
    error_log: Arc<Mutex<VecDeque<(u64, String)>>>,
    max_error_log_size: usize,
}

impl WebSocketManager {
    pub fn new(window: Arc<Mutex<webui::Window>>) -> Self {
        Self {
            state: Arc::new(Mutex::new(WebSocketState::Disconnected)),
            metrics: Arc::new(Mutex::new(WebSocketMetrics {
                connection_attempts: 0,
                successful_connections: 0,
                failed_connections: 0,
                messages_sent: 0,
                messages_received: 0,
                bytes_sent: 0,
                bytes_received: 0,
                last_error: None,
                last_error_time: None,
                uptime_seconds: 0,
                avg_ping_time: None,
                connection_duration: None,
                reconnect_count: 0,
            })),
            window,
            reconnect_interval: Duration::from_secs(5),
            max_reconnect_attempts: 10,
            current_reconnect_attempt: Arc::new(Mutex::new(0)),
            is_running: Arc::new(Mutex::new(false)),
            connection_start_time: Arc::new(Mutex::new(None)),
            error_log: Arc::new(Mutex::new(VecDeque::new())),
            max_error_log_size: 50,
        }
    }

    pub fn start_monitoring(&self) {
        let state = Arc::clone(&self.state);
        let metrics = Arc::clone(&self.metrics);
        let is_running = Arc::clone(&self.is_running);
        let connection_start_time = Arc::clone(&self.connection_start_time);
        let _error_log = Arc::clone(&self.error_log);
        
        *self.is_running.lock().unwrap() = true;
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(1));
            
            loop {
                {
                    let running = is_running.lock().unwrap();
                    if !*running {
                        break;
                    }
                }
                
                interval.tick().await;
                
                // Update uptime
                {
                    let mut metrics_guard = metrics.lock().unwrap();
                    metrics_guard.uptime_seconds += 1;
                    
                    // Update connection duration if connected
                    if let Ok(state_guard) = state.lock() {
                        if *state_guard == WebSocketState::Connected {
                            if let Ok(conn_start) = connection_start_time.lock() {
                                if let Some(start_time) = *conn_start {
                                    metrics_guard.connection_duration = Some(start_time.elapsed());
                                }
                            }
                        }
                    }
                }
                
                // Log state periodically
                {
                    let state_guard = state.lock().unwrap();
                    trace!("WebSocket state: {:?}, Metrics: {:?}", 
                           *state_guard, 
                           metrics.lock().unwrap());
                           
                    // Log detailed metrics every 30 seconds
                    if metrics.lock().unwrap().uptime_seconds % 30 == 0 {
                        info!("WebSocket Monitoring Report:");
                        info!("  State: {:?}", *state_guard);
                        let m = metrics.lock().unwrap();
                        info!("  Connection Attempts: {}, Successful: {}, Failed: {}", 
                              m.connection_attempts, m.successful_connections, m.failed_connections);
                        info!("  Messages: Sent={} Received={}", m.messages_sent, m.messages_received);
                        info!("  Bytes: Sent={} Received={}", m.bytes_sent, m.bytes_received);
                        info!("  Uptime: {}s", m.uptime_seconds);
                        info!("  Reconnect Count: {}", m.reconnect_count);
                        if let Some(ref err) = m.last_error {
                            info!("  Last Error: {}", err);
                        }
                    }
                }
            }
        });
    }

    pub fn stop_monitoring(&self) {
        *self.is_running.lock().unwrap() = false;
    }

    pub fn get_state(&self) -> WebSocketState {
        self.state.lock().unwrap().clone()
    }

    pub fn get_metrics(&self) -> WebSocketMetrics {
        self.metrics.lock().unwrap().clone()
    }

    pub fn set_state(&self, new_state: WebSocketState) {
        let mut state_guard = self.state.lock().unwrap();
        let old_state = state_guard.clone();
        
        if *state_guard != new_state {
            info!("WebSocket state changed: {:?} -> {:?}", old_state, new_state);
            *state_guard = new_state.clone();
            
            // Emit state change events
            self.emit_state_change_event(&old_state, &new_state);
        }
    }

    fn emit_state_change_event(&self, old_state: &WebSocketState, new_state: &WebSocketState) {
        let event_name = match new_state {
            WebSocketState::Connected => "websocket.connected",
            WebSocketState::Disconnected => "websocket.disconnected",
            WebSocketState::Connecting => "websocket.connecting",
            WebSocketState::Reconnecting => "websocket.reconnecting",
            WebSocketState::Failed => "websocket.failed",
        };

        let payload = json!({
            "previous_state": format!("{:?}", old_state),
            "current_state": format!("{:?}", new_state),
            "timestamp": chrono::Utc::now().timestamp_millis(),
        });

        tokio::spawn(async move {
            if let Err(e) = emit_event(Event::new(
                EventType::Custom {
                    name: event_name.to_string(),
                    payload,
                },
                "websocket_manager"
            )).await {
                error!("Failed to emit WebSocket state change event: {}", e);
            }
        });
    }

    pub fn increment_message_sent(&self, bytes: usize) {
        let mut metrics = self.metrics.lock().unwrap();
        metrics.messages_sent += 1;
        metrics.bytes_sent += bytes as u64;
    }

    pub fn increment_message_received(&self, bytes: usize) {
        let mut metrics = self.metrics.lock().unwrap();
        metrics.messages_received += 1;
        metrics.bytes_received += bytes as u64;
    }

    pub fn record_error(&self, error: &str) {
        let timestamp = chrono::Utc::now().timestamp_millis() as u64;
        let mut metrics = self.metrics.lock().unwrap();
        metrics.last_error = Some(error.to_string());
        metrics.last_error_time = Some(timestamp);
        
        // Add to error log
        {
            let mut error_log = self.error_log.lock().unwrap();
            error_log.push_back((timestamp, error.to_string()));
            if error_log.len() > self.max_error_log_size {
                error_log.pop_front();
            }
        }
        
        // Emit error event
        let payload = json!({
            "error": error,
            "timestamp": timestamp,
            "metrics": {
                "connection_attempts": metrics.connection_attempts,
                "successful_connections": metrics.successful_connections,
                "failed_connections": metrics.failed_connections,
                "messages_sent": metrics.messages_sent,
                "messages_received": metrics.messages_received,
                "bytes_sent": metrics.bytes_sent,
                "bytes_received": metrics.bytes_received,
                "uptime_seconds": metrics.uptime_seconds,
            }
        });

        tokio::spawn(async move {
            if let Err(e) = emit_event(Event::new(
                EventType::Custom {
                    name: "websocket.error".to_string(),
                    payload,
                },
                "websocket_manager"
            )).await {
                error!("WebSocket error event emission failed: {}", e);
            }
        });
        
        error!("WebSocket Error: {}", error);
    }

    pub fn handle_connection_success(&self) {
        let mut metrics = self.metrics.lock().unwrap();
        metrics.connection_attempts += 1;
        metrics.successful_connections += 1;
        *self.current_reconnect_attempt.lock().unwrap() = 0;
        
        // Record connection start time
        {
            let mut conn_start = self.connection_start_time.lock().unwrap();
            *conn_start = Some(Instant::now());
        }
        
        self.set_state(WebSocketState::Connected);
        
        info!("WebSocket connection established successfully");
    }

    pub fn handle_connection_failure(&self, error: &str) {
        let mut metrics = self.metrics.lock().unwrap();
        metrics.connection_attempts += 1;
        metrics.failed_connections += 1;
        self.record_error(error);
        
        let mut attempt_guard = self.current_reconnect_attempt.lock().unwrap();
        *attempt_guard += 1;
        metrics.reconnect_count += 1;
        
        if *attempt_guard >= self.max_reconnect_attempts {
            self.set_state(WebSocketState::Failed);
            error!("Maximum reconnection attempts ({}) reached. Connection failed permanently.", self.max_reconnect_attempts);
        } else {
            self.set_state(WebSocketState::Reconnecting);
            warn!("Connection failed, attempting to reconnect... (attempt {}/{})", 
                  *attempt_guard, self.max_reconnect_attempts);
        }
    }
    
    pub fn get_detailed_metrics(&self) -> WebSocketMetrics {
        self.metrics.lock().unwrap().clone()
    }
    
    pub fn get_error_log(&self) -> Vec<(u64, String)> {
        self.error_log.lock().unwrap().clone().into()
    }
    
    pub fn reset_metrics(&self) {
        let mut metrics = self.metrics.lock().unwrap();
        *metrics = WebSocketMetrics {
            connection_attempts: 0,
            successful_connections: 0,
            failed_connections: 0,
            messages_sent: 0,
            messages_received: 0,
            bytes_sent: 0,
            bytes_received: 0,
            last_error: None,
            last_error_time: None,
            uptime_seconds: 0,
            avg_ping_time: None,
            connection_duration: None,
            reconnect_count: 0,
        };
        
        info!("WebSocket metrics reset");
    }

    pub fn attempt_reconnect(&self) {
        if self.get_state() == WebSocketState::Reconnecting {
            info!("Attempting to reconnect WebSocket...");
            self.set_state(WebSocketState::Connecting);
            
            // In a real implementation, you would trigger the actual reconnection here
            // For now, we'll simulate the reconnection process
            let _window_clone = Arc::clone(&self.window);
            let manager_clone = self.clone();
            
            tokio::spawn(async move {
                tokio::time::sleep(manager_clone.reconnect_interval).await;
                
                // Simulate reconnection attempt
                // In a real implementation, you would check if the connection is actually established
                manager_clone.set_state(WebSocketState::Connected);
                manager_clone.handle_connection_success();
                
                info!("WebSocket reconnection attempt completed");
            });
        }
    }

    pub fn disconnect(&self) {
        self.set_state(WebSocketState::Disconnected);
        info!("WebSocket disconnected by user request");
    }
}

impl Clone for WebSocketManager {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            metrics: Arc::clone(&self.metrics),
            window: Arc::clone(&self.window),
            reconnect_interval: self.reconnect_interval,
            max_reconnect_attempts: self.max_reconnect_attempts,
            current_reconnect_attempt: Arc::clone(&self.current_reconnect_attempt),
            is_running: Arc::clone(&self.is_running),
            connection_start_time: Arc::clone(&self.connection_start_time),
            error_log: Arc::clone(&self.error_log),
            max_error_log_size: self.max_error_log_size,
        }
    }
}