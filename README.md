# Rust WebUI React Application

A modern, production-ready desktop application template combining Rust backend with React frontend for cross-platform desktop apps using WebUI.

## Overview

This project demonstrates a complete desktop application architecture with:
- **Rust backend** - High-performance native code with SQLite database support
- **React frontend** - Modern UI with TypeScript and Rspack bundler
- **WebUI** - Lightweight cross-platform webview library
- **MVVM architecture** - Clean separation of concerns

## Technology Stack

### Backend
- Rust (edition 2024)
- WebUI (webui-rs) - Desktop UI framework
- SQLite (rusqlite) - Embedded database
- Tokio - Async runtime
- Tracing - Structured logging

### Frontend
- React 18 with TypeScript
- Rspack - Fast bundler
- Bun - JavaScript runtime

## Project Structure

```
starter-rust-webuireact-rspack/
|
|-- src/                           # Rust backend source
|   |-- main.rs                    # Entry point, HTTP server, WebUI initialization
|   |-- models/mod.rs              # Data models (AppConfig, Database, User, etc.)
|   |-- viewmodels/                # Business logic handlers
|   |   |-- counter.rs             # Counter state management
|   |   |-- user.rs                # User database operations
|   |   |-- system.rs              # System information handlers
|   |   |-- utils.rs               # Utility functions
|   |   |-- window.rs              # Window management handlers
|   |   +-- mod.rs                 # ViewModel exports
|   |-- infrastructure/mod.rs      # Logging, database initialization
|   |-- event_bus.rs               # Bidirectional frontend-backend event system
|   |-- websocket_manager.rs       # WebSocket state management
|   |-- handlers.rs                # General handlers
|   |-- core.rs                    # Core utilities
|   +-- build_logger.rs            # Build-time logging
|
|-- frontend/                      # React frontend source
|   |-- src/
|   |   |-- main.tsx               # React entry point
|   |   |-- models/index.ts         # TypeScript interfaces
|   |   |-- views/
|   |   |   |-- App.tsx            # Main application component
|   |   |   +-- ErrorDemo.tsx      # Error handling demo
|   |   |-- viewmodels/index.ts    # React hooks
|   |   +-- utils/
|   |       |-- enhanced-websocket.ts  # WebSocket handler
|   |       |-- ErrorProvider.tsx  # Global error context
|   |       |-- event-bus.js       # Event bus client
|   |       +-- utils.js           # Utility functions
|   |-- rspack.config.ts           # Production bundler config
|   |-- rspack.config.dev.ts       # Development bundler config
|   |-- rspack.config.inline.ts    # Inline asset config
|   |-- package.json                # Node dependencies
|   |-- tsconfig.json              # TypeScript config
|   |-- biome.json                 # Code formatting rules
|   +-- dist/                      # Compiled frontend (generated)
|
|-- static/                        # Static assets (generated)
|   +-- js/                        # JS bundles
|
|-- thirdparty/                    # Third-party dependencies
|   +-- webui-c-src/              # WebUI C library
|
|-- Cargo.toml                     # Rust package configuration
|-- app.config.toml                # Runtime configuration
|-- app.db                         # SQLite database
|-- build.rs                       # Build script
|-- build-frontend.js              # Frontend production build
|-- build-frontend-inline.js       # Frontend inline build
|-- build-dist.sh                  # Distribution packaging
|-- run.sh                         # Development run script
|-- post-build.sh                  # Post-build processing
|-- index.html                     # Root HTML template
|
|-- README.md                      # This file
|-- EVENT_BUS_DOCS.md              # Event bus documentation
+-- BUILD_LOGGING.md              # Build logging documentation
```

## Key Features

### Backend Features
- SQLite database with sample data
- Structured logging with file rotation
- Event bus for frontend-backend communication
- WebSocket state management
- MVVM architecture with viewmodels
- Configuration management via TOML

### Frontend Features
- Modern React with TypeScript
- Responsive dashboard layout
- Sidebar with window management
- Statusbar with WebSocket status
- WinBox-based modal windows
- Error handling with ErrorProvider
- Event bus integration

### Build System
- Rspack bundler for fast builds
- Bun runtime for package management
- Random port generation for HTTP server
- Multi-profile builds (dev/release)

## Getting Started

### Prerequisites
- Rust (latest stable)
- Bun (JavaScript runtime)
- Cargo (Rust package manager)

### Build and Run

```bash
# Build and run the application
./run.sh

# Build only
./run.sh --build

# Build frontend only
./run.sh --build-frontend

# Build Rust only
./run.sh --build-rust

# Clean and rebuild
./run.sh --rebuild

# Build release version
./run.sh --release
```

### Configuration

Edit `app.config.toml` to configure:
- Application name and version
- Window title and dimensions
- Database settings
- Logging levels
- Feature flags

## Architecture

### MVVM Pattern

```
Model       <-->    ViewModel     <-->     View
(Rust)              (Rust)               (React)
  |                      |                    |
  +-- Database           +-- Handlers         +-- Components
  +-- Config            +-- Event Bus        +-- Hooks
                       +-- State            +-- State
```

### Event Flow

1. User interacts with React UI
2. View emits event via event-bus
3. Backend handler processes event
4. Response sent back to frontend
5. View updates accordingly

### Port Configuration

The HTTP server uses a randomly selected port (8000-9000 range) to avoid conflicts. The port is:
- Written to `frontend/dist/port.json` at runtime
- Automatically used by the frontend via the built-in server

## File Descriptions

### Backend Files
| File | Description |
|------|-------------|
| `main.rs` | Application entry, HTTP server, WebUI window creation |
| `models/mod.rs` | AppConfig, Database, User, DbStats, SystemInfo |
| `viewmodels/*.rs` | Business logic handlers |
| `event_bus.rs` | Frontend-backend event communication |
| `websocket_manager.rs` | WebSocket state tracking |
| `infrastructure/mod.rs` | Logging and database setup |

### Frontend Files
| File | Description |
|------|-------------|
| `main.tsx` | React bootstrap with error handling |
| `views/App.tsx` | Main UI with sidebar, header, statusbar |
| `utils/enhanced-websocket.ts` | WebSocket connection handler |
| `utils/ErrorProvider.tsx` | Global error state management |
| `utils/event-bus.js` | Event subscription and emission |

## Potential Improvements

### Code Organization
- Split large files (`event_bus.rs`, `App.tsx`) into smaller focused modules
- Add a `tests/` directory with unit and integration tests for both frontend and backend
- Implement module-level documentation

### Frontend Enhancements
- Replace `utils.js` with TypeScript equivalents for type safety
- Add a state management library (Zustand, Jotai, or React Query)
- Implement CSS modules or Tailwind CSS for scoped styling
- Add a component library (Shadcn UI, Mantine, etc.)
- Implement code splitting and lazy loading for routes
- Add form validation library (React Hook Form, Zod)
- Implement unit tests with Vitest or Jest

### Backend Enhancements
- Add authentication and authorization layer
- Implement proper error handling with custom error types
- Add database migration support
- Add API versioning
- Implement caching layer
- Add rate limiting

### Build & Development
- Add Docker support for consistent builds
- Set up CI/CD pipeline (GitHub Actions, GitLab CI)
- Configure hot module replacement (HMR)
- Add environment variable handling
- Set up ESLint and Prettier for frontend
- Add development mode with watch mode

### Production Readiness
- Implement file-based logging with rotation
- Add panic handling and crash reporting
- Add system tray support
- Implement auto-updater
- Add native notifications
- Add window management (minimize to tray)
- Implement keyboard shortcuts

### Performance
- Optimize bundle size with tree shaking
- Add service worker for offline support
- Implement virtual scrolling for large lists
- Add caching strategies
- Profile and optimize Rust code

### Documentation
- Add API documentation (Swagger/OpenAPI)
- Add architecture decision records (ADRs)
- Create contribution guidelines
- Add changelog
- Document deployment process
