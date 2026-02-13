# Enhanced Build Pipeline Logging System

This project implements a comprehensive logging system for both frontend and backend build pipelines with detailed logging, timing measurements, and structured output.

## Features

### Backend (Rust)
- **Tracing-based logging**: Uses the `tracing` crate for advanced logging capabilities
- **Structured output**: Support for both text and JSON formats
- **Configurable levels**: Support for trace, debug, info, warn, and error levels
- **Performance timing**: Automatic timing of operations
- **Thread-aware logging**: Includes thread IDs and names in logs

### Frontend (JavaScript/Node.js)
- **Enhanced logging utility**: `BuildLogger` class with multiple log levels
- **Timing measurements**: Built-in timers for measuring build step durations
- **Structured output**: Support for both text and JSON formats
- **Contextual logging**: Ability to add contextual information to log entries
- **Child loggers**: Support for creating child loggers with inherited context

### Build Scripts (Bash)
- **Comprehensive logging**: All build scripts now include detailed logging
- **Timing measurements**: Automatic timing of build operations
- **Structured output**: Consistent log format with timestamps and modules
- **JSON support**: Option to output logs in JSON format
- **Context tracking**: Additional context information for each log entry

## Configuration

### Backend Configuration
The backend logging is configured through `app.config.toml`:

```toml
[logging]
level = "info"              # Log level: trace, debug, info, warn, error
file = "application.log"    # Log file name
append = true              # Whether to append to existing log file
format = "text"            # Log format: "text" or "json"
max_file_size = 10485760   # Max log file size in bytes (10MB)
max_files = 5              # Number of rotated log files to keep
```

### Environment Variables
- `RUST_LOG`: Override log level for Rust applications
- `LOG_FORMAT`: Set log format to "json" for JSON output (default: "text")
- `LOG_LEVEL`: Set minimum log level for build scripts

## Log Format

### Text Format
```
[YYYY-MM-DD HH:MM:SS.sss] [LEVEL] [MODULE] Message [Context: key=value]
```

### JSON Format
```json
{
  "timestamp": "YYYY-MM-DDTHH:MM:SS.sssZ",
  "level": "INFO",
  "module": "MODULE_NAME",
  "pid": 12345,
  "message": "Log message",
  "duration_ms": 123,
  "context": {
    "key": "value"
  }
}
```

## Build Script Logging

All build scripts now support enhanced logging:

- `run.sh`: Main build and run script
- `build-dist.sh`: Distribution build script
- `post-build.sh`: Post-build configuration script

Each script supports:
- Detailed step-by-step logging
- Performance timing for each operation
- Contextual information
- JSON output format option

### Example Usage:
```bash
# Standard text logging
./run.sh --build

# JSON logging
LOG_FORMAT=json ./run.sh --build

# Custom log file
LOG_FILE=my-build.log ./build-dist.sh build-release
```

## Frontend Build Logging

The frontend build process uses the enhanced logging system:

- `build-frontend.js`: Standard build with asset copying
- `build-frontend-inline.js`: Inline build creating single HTML file

Both scripts provide:
- Dependency check logging
- Build step timing
- Asset copy tracking
- Error handling with context

## Best Practices

1. **Use appropriate log levels**: Reserve error for actual errors, warn for potential issues, info for important milestones, debug for detailed debugging, and trace for very verbose output.

2. **Include context**: When possible, include relevant context in log messages to aid debugging.

3. **Measure performance**: Use the built-in timing utilities to track build performance.

4. **Consistent modules**: Use consistent module names across the codebase for easier log filtering.

## Testing the Logging System

To test the enhanced logging system, run:

```bash
# Test backend logging
cargo run

# Test frontend build logging
bun build-frontend.js

# Test full build pipeline logging
./run.sh --build

# Test with JSON format
LOG_FORMAT=json ./run.sh --build

# Test distribution build
./build-dist.sh build-release
```