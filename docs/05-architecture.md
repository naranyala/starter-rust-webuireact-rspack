# Architecture

## MVVM Pattern

The application follows the Model-View-ViewModel (MVVM) pattern for clean separation of concerns:

```
Model       <-->    ViewModel     <-->     View
(Rust)              (Rust)               (React)
  |                      |                    |
  +-- Database           +-- Handlers         +-- Components
  +-- Config            +-- Event Bus        +-- Hooks
                        +-- State            +-- State
```

### Model Layer (Rust)
- **Database** - SQLite data persistence
- **Config** - Application configuration
- **Error Types** - Typed error handling

### ViewModel Layer (Rust)
- **ViewModels** - Business logic handlers
- **Event Bus** - Frontend-backend communication
- **Plugins** - Modular feature implementations

### View Layer (React)
- **Components** - UI components
- **Hooks** - State management
- **Plugins** - Frontend state management

## Event Flow

1. User interacts with React UI
2. View emits event via event-bus
3. Backend handler processes event
4. Response sent back to frontend
5. View updates accordingly

## Plugin System

### Backend Plugins
The backend uses a trait-based plugin system:

```rust
pub trait PluginTrait: Send + Sync {
    fn name(&self) -> &str;
    fn setup(&self, window: &mut webui::Window) -> Result<(), Box<dyn std::error::Error>>;
}
```

Available plugins:
- **CounterPlugin** - Counter state management
- **UserPlugin** - User database operations
- **SystemPlugin** - System information
- **WindowPlugin** - Window management

### Frontend Plugins
Frontend plugins manage state:

- **CounterPlugin** - Counter state
- **UserPlugin** - User data
- **SystemPlugin** - System information
- **WindowPlugin** - Window state

## Error Handling

### Backend Errors
Using "errors as values" pattern with custom error types:

```rust
pub enum AppError {
    Config(String),
    Database(#[from] rusqlite::Error),
    Io(#[from] std::io::Error),
    // ...
}

pub type AppResult<T> = Result<T, AppError>;
```

### Frontend Errors
Typed error handling in TypeScript:

```typescript
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  source?: string;
}
```

## Core and Plugin Structure

### Backend
```
src/
├── core/          # Core utilities
│   ├── config.rs
│   ├── database.rs
│   ├── logging.rs
│   └── error.rs
├── plugins/       # Feature plugins
│   ├── counter.rs
│   ├── user.rs
│   ├── system.rs
│   └── window.rs
└── viewmodels/   # Business logic
```

### Frontend
```
frontend/src/
├── core/          # Core utilities
│   ├── config.ts
│   └── error.ts
├── plugins/       # State plugins
│   ├── counter.ts
│   ├── user.ts
│   ├── system.ts
│   └── window.ts
└── views/         # UI components
```
