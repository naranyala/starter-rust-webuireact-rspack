pub mod counter;
pub mod system;
pub mod user;
pub mod utils;
pub mod window;

pub use counter::setup_counter_viewmodel;
pub use system::setup_system_viewmodel;
pub use user::setup_user_viewmodel;
pub use utils::setup_utils_viewmodel;
pub use window::setup_window_viewmodel;

use std::sync::{Arc, Mutex};
use crate::core::Database;

lazy_static::lazy_static! {
    pub static ref DATABASE: Arc<Mutex<Option<Arc<Database>>>> = Arc::new(Mutex::new(None));
}

pub fn init_db(db: Arc<Database>) {
    match DATABASE.lock() {
        Ok(mut db_guard) => *db_guard = Some(db),
        Err(e) => tracing::error!("Failed to lock database: {}", e),
    }
}
