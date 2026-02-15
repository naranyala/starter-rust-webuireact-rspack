# Rust WebUI Application Starter

A modern, production-ready desktop application template combining Rust with React for cross-platform desktop apps.

## Project Structure (MVVM Architecture)

```
starter-rust-webuireact-rspack/
├── src/                              # Rust backend (MVVM)
│   ├── main.rs                       # Application entry point
│   ├── models/                       # M - Data models
│   │   └── mod.rs                   # AppConfig, Database, User, DbStats, SystemInfo
│   ├── viewmodels/                   # VM - Business logic
│   │   ├── mod.rs                   # ViewModel exports
│   │   ├── counter.rs               # Counter handlers
│   │   ├── user.rs                  # User/DB handlers
│   │   ├── system.rs                # System info handlers
│   │   └── utils.rs                 # Utility handlers
│   ├── infrastructure/               # Core services
│   │   └── mod.rs                   # Logging, database initialization
│   ├── event_bus.rs                 # Event bus (frontend-backend comm)
│   └── build_logger.rs              # Build-time logging
├── frontend/                         # React frontend (MVVM)
│   ├── src/
│   │   ├── main.tsx                 # React entry point
│   │   ├── models/                  # M - TypeScript types
│   │   │   └── index.ts            # User, DbStats, ApiResponse interfaces
│   │   ├── views/                   # V - React components
│   │   │   ├── App.tsx             # Main application component
│   │   │   └── ErrorDemo.tsx       # Error handling demo
│   │   ├── viewmodels/             # VM - React hooks
│   │   │   └── index.ts            # useCounter, useUsers, useSystemInfo hooks
│   │   └── utils/
│   │       ├── ErrorProvider.tsx   # Error context provider
│   │       └── event-bus.js         # Frontend event bus
│   ├── rspack.config.ts            # Production bundler config
│   ├── rspack.config.dev.ts        # Development bundler config
│   ├── rspack.config.inline.ts     # Inline asset config
│   ├── package.json                 # Node.js dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── biome.json                  # Code formatting rules
│   └── dist/                       # Compiled frontend (generated)
├── static/                          # Static assets
│   ├── css/                        # Compiled CSS
│   └── js/                         # Compiled JS bundles
├── thirdparty/                      # Third-party dependencies
│   └── webui-c-src/                # WebUI C library
├── Cargo.toml                       # Rust package config
├── Cargo.lock                      # Rust lock file
├── app.config.toml                 # Runtime config
├── app.db                          # SQLite database
├── build.rs                        # Build script
├── build-frontend.js               # Frontend production build
├── build-frontend-inline.js       # Frontend inline build
├── build-dist.sh                   # Distribution packaging
├── run.sh                          # Development run script
├── post-build.sh                   # Post-build processing
├── index.html                      # Root HTML template
├── README.md                       # This file
├── EVENT_BUS_DOCS.md              # Event bus docs
└── BUILD_LOGGING.md               # Build logging docs
```

## MVVM Architecture

### Model Layer
- **Rust**: `src/models/` - Data structures (AppConfig, Database, User, DbStats, SystemInfo)
- **Frontend**: `frontend/src/models/` - TypeScript interfaces

### View Layer
- **Rust**: WebUI window rendering
- **Frontend**: `frontend/src/views/` - React components (App.tsx, ErrorDemo.tsx)

### ViewModel Layer
- **Rust**: `src/viewmodels/` - Business logic handlers (counter, user, system, utils)
- **Frontend**: `frontend/src/viewmodels/` - React hooks (useCounter, useUsers, useSystemInfo)

### Infrastructure
- **Rust**: `src/infrastructure/` - Logging, database initialization
- **Frontend**: `frontend/src/utils/` - ErrorProvider, event-bus

## Key Components

### Backend (Rust)
- **main.rs**: Application entry, WebUI init, HTTP server
- **models/mod.rs**: Data models (AppConfig, Database, User, etc.)
- **viewmodels/**: Handler modules (counter, user, system, utils)
- **infrastructure/mod.rs**: Logging and database setup
- **event_bus.rs**: Bidirectional frontend-backend communication
- **build_logger.rs**: Compile-time logging

### Frontend (React + TypeScript)
- **main.tsx**: React bootstrap with error handling
- **models/index.ts**: TypeScript interfaces
- **views/App.tsx**: Main UI component
- **viewmodels/index.ts**: Custom React hooks
- **utils/ErrorProvider.tsx**: Global error context
- **utils/event-bus.js**: Event bus client

### Build System
- **rspack**: Fast Rust-based bundler
- **build-frontend.js**: Production frontend build
- **build-frontend-inline.js**: Inline asset bundling
- **build-dist.sh**: Distribution packaging

## Potential Improvements

### Code Organization
- Split large files (`event_bus.rs`, `App.tsx`) into smaller focused modules
- Add a `tests/` directory with unit and integration tests

### Frontend
- Replace `utils.js` (vanilla JS) with TypeScript equivalents
- Add a state management solution (Zustand, Jotai, or React Query)
- Set up CSS modules or Tailwind CSS for styling
- Add React component library (Shadcn UI, Mantine, etc.)
- Implement code splitting and lazy loading

### Backend
- Add authentication/authorization layer
- Implement proper error handling with user-friendly error types
- Add database migrations support
- Consider adding async runtime (tokio) for concurrent operations

### Build & Dev Experience
- Add Docker support for consistent builds
- Set up CI/CD pipeline configuration
- Add ESLint and Prettier for frontend linting
- Configure hot module replacement (HMR) for faster development
- Add environment variable handling for different deployment modes

### Production Readiness
- Add logging to files with rotation
- Implement proper panic handling and crash reporting
- Add system tray support
- Implement auto-updater
- Add native notifications support
