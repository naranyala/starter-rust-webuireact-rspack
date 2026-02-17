# Project Structure

```
starter-rust-webuireact-rspack/
|
|-- src/                           # Rust backend source
|   |-- main.rs                    # Entry point, HTTP server, WebUI initialization
|   |-- models/mod.rs              # Data models (AppConfig, Database, User, etc.)
|   |-- viewmodels/                # Business logic handlers
|   |   |-- counter.rs             # Counter state management
|   |   |-- user.rs               # User database operations
|   |   |-- system.rs             # System information handlers
|   |   |-- utils.rs              # Utility functions
|   |   |-- window.rs             # Window management handlers
|   |   +-- mod.rs                # ViewModel exports
|   |-- core/                     # Core modules
|   |   |-- config.rs             # Application configuration
|   |   |-- database.rs           # SQLite database
|   |   |-- logging.rs            # Logging setup
|   |   |-- error.rs              # Error types
|   |   +-- mod.rs
|   |-- plugins/                  # Plugin system
|   |   |-- counter.rs             # Counter plugin
|   |   |-- user.rs               # User plugin
|   |   |-- system.rs              # System plugin
|   |   |-- window.rs              # Window plugin
|   |   +-- mod.rs
|   |-- event_bus.rs              # Bidirectional frontend-backend event system
|   |-- websocket_manager.rs      # WebSocket state management
|   |-- handlers.rs               # General handlers
|   +-- build_logger.rs           # Build-time logging
|
|-- frontend/                      # React frontend source
|   |-- src/
|   |   |-- main.tsx              # React entry point
|   |   |-- core/                 # Core utilities
|   |   |   |-- config.ts         # App configuration
|   |   |   |-- error.ts          # Error types
|   |   |   +-- index.ts
|   |   |-- plugins/              # Frontend plugins
|   |   |   |-- counter.ts         # Counter state
|   |   |   |-- user.ts            # User state
|   |   |   |-- system.ts          # System info
|   |   |   |-- window.ts          # Window state
|   |   |   +-- index.ts
|   |   |-- components/           # React components
|   |   |-- views/
|   |   |   |-- App.tsx           # Main application component
|   |   |   +-- ErrorDemo.tsx     # Error handling demo
|   |   |-- styles/               # CSS styles
|   |   +-- utils/
|   |       |-- enhanced-websocket.ts  # WebSocket handler
|   |       |-- ErrorProvider.tsx     # Global error context
|   |       +-- event-bus.ts          # Event bus client
|   |-- rspack.config.ts          # Production bundler config
|   |-- rspack.config.dev.ts      # Development bundler config
|   |-- rspack.config.inline.ts   # Inline asset config
|   |-- package.json              # Node dependencies
|   |-- tsconfig.json             # TypeScript config
|   |-- biome.json                # Code formatting rules
|   +-- dist/                    # Compiled frontend (generated)
|
|-- static/                       # Static assets (generated)
|   +-- js/                      # JS bundles
|
|-- thirdparty/                   # Third-party dependencies
|   +-- webui-c-src/            # WebUI C library
|
|-- Cargo.toml                    # Rust package configuration
|-- app.config.toml               # Runtime configuration
|-- app.db                       # SQLite database
|-- build.rs                     # Build script
|-- build-frontend.js            # Frontend production build
|-- build-frontend-inline.js      # Frontend inline build
|-- build-dist.sh                # Distribution packaging
|-- run.sh                       # Development run script
|-- post-build.sh                # Post-build processing
|
|-- README.md                    # This file
|-- docs/                        # Documentation
|   +-- *.md                     # Separate documentation files
```

## Directory Descriptions

### Backend (`src/`)
| Directory | Description |
|-----------|-------------|
| `core/` | Core utilities: config, database, logging, error handling |
| `plugins/` | Plugin system for modular features |
| `viewmodels/` | Business logic handlers following MVVM pattern |
| `event_bus.rs` | Bidirectional frontend-backend event communication |
| `websocket_manager.rs` | WebSocket state tracking |

### Frontend (`frontend/src/`)
| Directory | Description |
|-----------|-------------|
| `core/` | Core utilities: config, error types |
| `plugins/` | Frontend plugin state management |
| `components/` | Reusable React components |
| `views/` | Page-level React components |
| `styles/` | CSS styles |
| `utils/` | Utilities: WebSocket, ErrorProvider, event bus |
