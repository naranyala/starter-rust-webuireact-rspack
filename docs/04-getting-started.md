# Getting Started

## Prerequisites

### Required Tools
- **Rust** - Latest stable version
- **Bun** - JavaScript runtime for frontend builds
- **Cargo** - Rust package manager (included with Rust)

### Installation

1. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Build and Run

### Development Mode

```bash
# Build and run the application
./run.sh
```

The application will:
1. Install frontend dependencies
2. Build the frontend with Rspack
3. Compile the Rust backend
4. Start the HTTP server on a random port
5. Open the WebUI window

### Build Options

```bash
# Build only (no run)
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

## Configuration

Edit `app.config.toml` to configure:

### Application Settings
```toml
[app]
name = "Rust WebUI Application"
version = "1.0.0"
```

### Window Settings
```toml
[window]
title = "Rust WebUI Application"
```

### Database Settings
```toml
[database]
path = "app.db"
create_sample_data = true
```

### Logging Settings
```toml
[logging]
level = "info"
file = "application.log"
append = true
format = "text"
max_file_size = 10485760  # 10 MB
max_files = 5
```

## Port Configuration

The HTTP server uses a randomly selected port (8000-9000 range) to avoid conflicts. The port is:
- Written to `frontend/dist/port.json` at runtime
- Automatically used by the frontend via the built-in server

## Development Workflow

1. Make changes to frontend or backend
2. Run `./run.sh` to rebuild and test
3. Use `--build-frontend` for quick frontend-only rebuilds

## Troubleshooting

### Build Failures
- Ensure Rust and Bun are installed correctly
- Run `./run.sh --rebuild` to clean and rebuild

### Port Conflicts
- The application automatically finds an available port
- Check `frontend/dist/port.json` for the current port

### Database Issues
- Delete `app.db` to reset the database
- The application will recreate it with sample data
