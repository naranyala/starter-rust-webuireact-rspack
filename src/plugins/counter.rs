use crate::core::database::Database;
use crate::event_bus::{emit_counter_increment, emit_counter_reset, emit_event, Event, EventType};
use crate::plugins::PluginTrait;
use lazy_static::lazy_static;
use std::sync::{Arc, Mutex};
use tracing::info;

lazy_static! {
    static ref COUNTER: Arc<Mutex<i32>> = Arc::new(Mutex::new(0));
}

pub struct CounterPlugin;

impl CounterPlugin {
    pub fn new() -> Self {
        Self
    }

    pub fn get_value() -> i32 {
        *COUNTER.lock().unwrap()
    }

    pub fn increment() -> i32 {
        let mut counter = COUNTER.lock().unwrap();
        *counter += 1;
        let value = *counter;
        tracing::info!("Counter incremented to: {}", value);
        value
    }

    pub fn reset() {
        let mut counter = COUNTER.lock().unwrap();
        *counter = 0;
        tracing::info!("Counter reset to 0");
    }
}

impl Default for CounterPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginTrait for CounterPlugin {
    fn name(&self) -> &str {
        "counter"
    }

    fn setup(&self, window: &mut webui::Window) -> Result<(), Box<dyn std::error::Error>> {
        window.bind("increment_counter", |_event| {
            let value = CounterPlugin::increment();
            let _ = emit_counter_increment("counter_plugin");
            tracing::info!("Frontend: increment_counter -> {}", value);
        });

        window.bind("reset_counter", |_event| {
            CounterPlugin::reset();
            let _ = emit_counter_reset("counter_plugin");
            tracing::info!("Frontend: reset_counter");
        });

        window.bind("get_counter_value", |_event| {
            let value = CounterPlugin::get_value();
            tracing::info!("Frontend: get_counter_value -> {}", value);
        });

        info!("CounterPlugin initialized");
        Ok(())
    }
}
