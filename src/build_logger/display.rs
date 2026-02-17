use crate::build_logger::progress::{BuildProgress, StepStatus};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

pub struct ProgressBar {
    total: usize,
    current: usize,
    start_time: Instant,
    pub last_update: AtomicU64,
}

impl ProgressBar {
    pub fn new(total: usize) -> Self {
        Self {
            total,
            current: 0,
            start_time: Instant::now(),
            last_update: AtomicU64::new(0),
        }
    }

    pub fn increment(&mut self, amount: usize) {
        self.current = (self.current + amount).min(self.total);
        self.last_update.store(
            Instant::now().elapsed().as_millis() as u64,
            Ordering::Relaxed,
        );
    }

    pub fn set(&mut self, value: usize) {
        self.current = value.min(self.total);
        self.last_update.store(
            Instant::now().elapsed().as_millis() as u64,
            Ordering::Relaxed,
        );
    }

    pub fn percentage(&self) -> f32 {
        if self.total == 0 {
            100.0
        } else {
            (self.current as f32 / self.total as f32) * 100.0
        }
    }

    pub fn elapsed(&self) -> std::time::Duration {
        self.start_time.elapsed()
    }

    pub fn render(&self, message: &str) -> String {
        let width = 30;
        let filled = ((self.percentage() / 100.0) * (width as f32)) as usize;
        let bar = format!("{}{}", "█".repeat(filled), "░".repeat(width - filled));
        format!("[{}] {:.1}% {}", bar, self.percentage(), message)
    }
}

pub fn print_progress_bar(progress: &BuildProgress) {
    let total = progress.steps.len();
    let completed = progress
        .steps
        .iter()
        .filter(|s| s.status == StepStatus::Completed)
        .count();
    let in_progress = progress
        .steps
        .iter()
        .find(|s| s.status == StepStatus::InProgress);

    println!("\n=== Build Progress ===");
    for (i, step) in progress.steps.iter().enumerate() {
        let status_char = match step.status {
            StepStatus::Completed => "✓",
            StepStatus::Failed => "✗",
            StepStatus::InProgress => "▶",
            StepStatus::Pending => "○",
            StepStatus::Skipped => "⊘",
        };
        println!("  {} {}", status_char, step.name);
        if let Some(ref msg) = in_progress {
            if msg.name == step.name && !step.message.is_empty() {
                println!("    └─ {}", step.message);
            }
        }
    }
    println!(
        "Progress: {}/{} ({}%)\n",
        completed,
        total,
        progress.get_overall_progress() as usize
    );
}

pub fn print_step_completed(step_name: &str, duration_ms: u64, message: &str) {
    println!(
        "[✓] {} completed in {}ms - {}",
        step_name, duration_ms, message
    );
}

pub fn print_step_failed(step_name: &str, error: &str) {
    println!("[✗] {} failed: {}", step_name, error);
}
