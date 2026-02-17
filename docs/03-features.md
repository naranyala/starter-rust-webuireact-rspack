# Key Features

## Backend Features

### SQLite Database
- Embedded SQLite database with WAL mode enabled
- Sample data auto-population on first run
- User management with CRUD operations

### Structured Logging
- File-based logging with rotation
- Multiple log levels (debug, info, warn, error)
- JSON and text format support
- Timestamps with uptime

### Event Bus
- Bidirectional frontend-backend communication
- Event subscription with patterns
- Event history tracking
- Async event processing

### WebSocket Management
- Connection state tracking
- Message count metrics
- Error logging
- Reconnection handling

### MVVM Architecture
- Clear separation of concerns
- ViewModels for business logic
- Models for data structures
- Event-driven updates

### Configuration Management
- TOML-based configuration
- Default values
- Environment variable override support

## Frontend Features

### Modern React UI
- React 18 with TypeScript
- Functional components with hooks
- Error boundaries

### Dashboard Layout
- Responsive sidebar with window management
- Header with gradient styling
- Status bar with WebSocket indicators
- WinBox-based modal windows

### State Management
- React hooks for state
- ErrorProvider for global error handling
- Plugin-based state architecture

### Build System
- Rspack bundler for fast builds
- Bun runtime for package management
- Multiple build profiles (dev, inline, production)

## Build System Features

### Frontend Build
- Rspack production builds
- Asset optimization
- Static file copying
- HTML path updates

### Development Scripts
- `run.sh` - Main development script
- Multiple build modes (frontend, rust, full)
- Clean rebuild support
- Release builds

### HTTP Server
- Random port generation (8000-9000)
- Security headers
- Path traversal protection
- Static file serving
