use std::time::Instant;

#[derive(Debug, Clone, PartialEq)]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone)]
pub struct BuildStep {
    pub name: String,
    pub status: StepStatus,
    pub start_time: Option<Instant>,
    pub end_time: Option<Instant>,
    pub message: String,
    pub progress_percent: f32,
}

#[derive(Debug)]
pub struct BuildProgress {
    pub steps: Vec<BuildStep>,
    pub current_step: usize,
    pub start_time: Instant,
    pub total_steps: usize,
}

impl BuildProgress {
    pub fn new() -> Self {
        Self {
            steps: Vec::new(),
            current_step: 0,
            start_time: Instant::now(),
            total_steps: 0,
        }
    }

    pub fn init_steps(&mut self, step_names: Vec<&str>) {
        self.steps = step_names
            .iter()
            .map(|s| BuildStep {
                name: s.to_string(),
                status: StepStatus::Pending,
                start_time: None,
                end_time: None,
                message: String::new(),
                progress_percent: 0.0,
            })
            .collect();
        self.total_steps = self.steps.len();
        self.current_step = 0;
    }

    pub fn start_step(&mut self, name: &str) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.status = StepStatus::InProgress;
            step.start_time = Some(Instant::now());
        }
    }

    pub fn complete_step(&mut self, name: &str, message: &str) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.status = StepStatus::Completed;
            step.end_time = Some(Instant::now());
            step.message = message.to_string();
            step.progress_percent = 100.0;
            self.current_step += 1;
        }
    }

    pub fn fail_step(&mut self, name: &str, message: &str) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.status = StepStatus::Failed;
            step.end_time = Some(Instant::now());
            step.message = message.to_string();
            self.current_step += 1;
        }
    }

    pub fn update_progress(&mut self, name: &str, percent: f32) {
        if let Some(step) = self.steps.iter_mut().find(|s| s.name == name) {
            step.progress_percent = percent;
        }
    }

    pub fn get_overall_progress(&self) -> f32 {
        if self.total_steps == 0 {
            return 0.0;
        }
        let completed = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Completed)
            .count() as f32;
        let in_progress = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::InProgress)
            .fold(0.0, |acc, s| acc + s.progress_percent);
        ((completed * 100.0) + in_progress) / (self.total_steps as f32)
    }

    pub fn get_status_summary(&self) -> String {
        let total = self.steps.len();
        let completed = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Completed)
            .count();
        let failed = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Failed)
            .count();
        let pending = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Pending)
            .count();
        let in_progress = self
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::InProgress)
            .count();
        format!(
            "{}/{} completed, {} failed, {} pending, {} in progress",
            completed, total, failed, pending, in_progress
        )
    }

    pub fn get_step(&self, name: &str) -> Option<&BuildStep> {
        self.steps.iter().find(|s| s.name == name)
    }

    pub fn get_all_steps(&self) -> &[BuildStep] {
        &self.steps
    }

    pub fn get_current_step_name(&self) -> Option<String> {
        self.steps
            .iter()
            .find(|s| s.status == StepStatus::InProgress)
            .map(|s| s.name.clone())
    }

    pub fn reset(&mut self) {
        *self = Self::new();
    }
}

impl Default for BuildProgress {
    fn default() -> Self {
        Self::new()
    }
}
