# Rust WebUI Application Starter

A modern, production-ready desktop application template combining Rust with React for cross-platform desktop apps.

## Project Structure

```
starter-rust-webuireact-rspack/
├── src/                              # Rust backend source code
│   ├── main.rs                       # Application entry point
│   ├── core.rs                       # Core infrastructure (config, logging, database)
│   ├── event_bus.rs                  # Event bus for frontend-backend communication
│   ├── handlers.rs                   # WebUI event handlers
│   └── build_logger.rs               # Build-time logging functionality
├── frontend/                         # React frontend application
│   ├── src/
│   │   ├── main.tsx                  # React application entry point
│   │   ├── utils.js                  # JavaScript utilities
│   │   ├── use-cases/
│   │   │   ├── App.tsx               # Main application component
│   │   │   └── ErrorDemo.tsx         # Error handling demo
│   │   └── utils/
│   │       ├── ErrorProvider.tsx     # React error context provider
│   │       └── event-bus.js          # Frontend event bus implementation
│   ├── rspack.config.ts              # Production bundler configuration
│   ├── rspack.config.dev.ts          # Development bundler configuration
│   ├── rspack.config.inline.ts       # Inline asset configuration
│   ├── package.json                  # Node.js dependencies
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── biome.json                    # Code formatting rules
│   ├── index.html                    # HTML template
│   └── dist/                         # Compiled frontend (generated)
├── static/                           # Static assets served by the app
│   ├── css/                          # Compiled CSS files
│   └── js/                           # Compiled JavaScript bundles
├── thirdparty/                       # Third-party dependencies
│   └── webui-c-src/                  # WebUI C library source
│       ├── src/
│       │   ├── webui.c               # Main WebUI implementation
│       │   ├── webview/              # Platform-specific webview implementations
│       │   └── civetweb/             # Embedded HTTP server
│       ├── include/                  # C headers
│       └── examples/                 # Example applications
├── Cargo.toml                        # Rust package configuration
├── Cargo.lock                        # Rust dependency lock file
├── app.config.toml                   # Runtime configuration
├── app.db                            # SQLite database (generated)
├── build.rs                          # Build script for native dependencies
├── build-frontend.js                 # Frontend production build
├── build-frontend-inline.js         # Frontend inline build
├── build-dist.sh                     # Distribution packaging script
├── run.sh                            # Development run script
├── post-build.sh                     # Post-build processing script
├── index.html                        # Root HTML template
├── README.md                         # This file
├── EVENT_BUS_DOCS.md                 # Event bus documentation
└── BUILD_LOGGING.md                  # Build logging documentation
```

## Key Components

### Backend (Rust)
- **main.rs**: Application entry point with WebUI initialization
- **core.rs**: Configuration, logging, and database setup
- **event_bus.rs**: Bidirectional event communication with frontend
- **handlers.rs**: WebUI event handler implementations
- **build_logger.rs**: Compile-time logging for builds

### Frontend (React + TypeScript)
- **main.tsx**: React app bootstrap and initialization
- **use-cases/App.tsx**: Main UI component
- **use-cases/ErrorDemo.tsx**: Error handling demonstration
- **utils/ErrorProvider.tsx**: Global error context
- **utils/event-bus.js**: Frontend event bus client

### Build System
- **rspack**: Fast Rust-based bundler
- **build-frontend.js**: Production frontend build
- **build-frontend-inline.js**: Inline asset bundling
- **build-dist.sh**: Creates distribution packages

## Potential Improvements

### Code Organization
- Split large files (`handlers.rs`, `event_bus.rs`, `App.tsx`) into smaller, focused modules
- Extract shared types to a common `types/` directory for cross-language consistency
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
