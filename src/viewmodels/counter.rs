#![allow(dead_code)]

use lazy_static::lazy_static;
use std::sync::{Arc, Mutex};
use tracing::{info, error};
use webui_rs::webui;
use crate::core::Database;
use crate::event_bus::{emit_counter_increment, emit_counter_reset, emit_event, Event, EventType};

lazy_static! {
    static ref DATABASE: Arc<Mutex<Option<Arc<Database>>>> = Arc::new(Mutex::new(None));
}

pub fn init_database(db: Arc<Database>) {
    let mut db_guard = DATABASE.lock().unwrap();
    *db_guard = Some(db);
}

pub fn setup_counter_viewmodel(window: &mut webui::Window) {
    window.bind("increment_counter", |_event| {
        info!("Increment counter event received");
        tokio::spawn(async {
            if let Err(e) = emit_counter_increment("counter_viewmodel").await {
                error!("Failed to emit counter increment event: {}", e);
            }
        });
    });

    window.bind("reset_counter", |_event| {
        info!("Reset counter event received");
        tokio::spawn(async {
            if let Err(e) = emit_counter_reset("counter_viewmodel").await {
                error!("Failed to emit counter reset event: {}", e);
            }
        });
    });

    window.bind("get_counter_value", |_event| {
        info!("Get counter value event received");
        tokio::spawn(async {
            let event = Event::new(
                EventType::CounterValueChanged { value: 0 },
                "counter_viewmodel"
            );
            if let Err(e) = emit_event(event).await {
                error!("Failed to emit counter value changed event: {}", e);
            }
        });
    });

    info!("Counter viewmodel handlers registered");
}
