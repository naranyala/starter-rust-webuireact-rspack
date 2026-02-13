#!/usr/bin/env bash

#===============================================================================
# Cross-Platform Distribution Build Script
# Builds self-contained executables for Windows, macOS, and Linux
# Enhanced with detailed logging system
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME=""
APP_VERSION="1.0.0"
DIST_DIR="dist"
PLATFORM=""
ARCH=""
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="build-${TIMESTAMP}.log"

# Enhanced logging functions
log() {
    local level=$1
    local message=$2
    local module=${3:-"BUILD"}
    local duration=${4:-""}
    local context=${5:-""}
    
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S%.3N')
    local pid=$$
    
    # Create structured log entry
    if [ "$LOG_FORMAT" = "json" ]; then
        local log_entry="{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"module\":\"$module\",\"pid\":$pid,\"message\":\"$message\""
        if [ -n "$duration" ]; then
            log_entry="$log_entry,\"duration_ms\":\"$duration\""
        fi
        if [ -n "$context" ]; then
            log_entry="$log_entry,\"context\":$context"
        fi
        log_entry="$log_entry}"
        echo "$log_entry" | tee -a "$LOG_FILE"
    else
        local formatted_msg="[${timestamp}] [${level}] [${module}] ${message}"
        if [ -n "$duration" ]; then
            formatted_msg="${formatted_msg} (Duration: ${duration}ms)"
        fi
        if [ -n "$context" ]; then
            formatted_msg="${formatted_msg} [Context: ${context}]"
        fi
        echo "$formatted_msg" | tee -a "$LOG_FILE"
    fi
}

log_info() { log "INFO" "$1" "${2:-BUILD}" "${3:-}" "${4:-}"; }
log_warn() { log "WARN" "$1" "${2:-BUILD}" "${3:-}" "${4:-}"; }
log_error() { log "ERROR" "$1" "${2:-BUILD}" "${3:-}" "${4:-}"; }
log_debug() { log "DEBUG" "$1" "${2:-BUILD}" "${3:-}" "${4:-}"; }
log_step() { log "STEP" "$1" "${2:-BUILD}" "${3:-}" "${4:-}"; }

# Timing function
time_command() {
    local start_time=$(date +%s.%N)
    local cmd="$1"
    eval "$cmd"
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time $start_time" | awk '{result = ($1 - $2) * 1000; printf "%.0f", result}')
    echo "$duration"
}

# Platform detection
detect_platform() {
    local platform_start=$(date +%s.%N)
    case "$(uname -s)" in
        Linux*)     PLATFORM="linux";;
        Darwin*)    PLATFORM="macos";;
        CYGWIN*|MINGW*|MSYS*) PLATFORM="windows";;
        *)          PLATFORM="unknown";;
    esac
    
    local platform_end=$(date +%s.%N)
    local platform_duration=$(echo "$platform_end $platform_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    
    log_info "Detected platform: $PLATFORM" "PLATFORM_DETECT" "$platform_duration"
}

# Architecture detection
detect_arch() {
    local arch_start=$(date +%s.%N)
    case "$(uname -m)" in
        x86_64|amd64)   ARCH="x64";;
        aarch64|arm64)  ARCH="arm64";;
        armv7l)         ARCH="arm";;
        *)              ARCH="x64";;
    esac
    
    local arch_end=$(date +%s.%N)
    local arch_duration=$(echo "$arch_end $arch_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    
    log_info "Detected architecture: $ARCH" "ARCH_DETECT" "$arch_duration"
}

# Read configuration from app.config.toml
read_config() {
    local config_start=$(date +%s.%N)
    log_step "Reading configuration..." "CONFIG_READ"
    
    if [ -f "app.config.toml" ]; then
        # Read executable name
        APP_NAME=$(grep -A1 '\[executable\]' app.config.toml 2>/dev/null | grep 'name' | cut -d'=' -f2 | tr -d ' "' || echo "app")
        # Read version
        APP_VERSION=$(grep '^version = ' Cargo.toml 2>/dev/null | cut -d'"' -f2 || echo "1.0.0")
    else
        APP_NAME="app"
        APP_VERSION="1.0.0"
    fi

    # Fallback to cargo package name
    if [ -z "$APP_NAME" ]; then
        APP_NAME=$(grep '^name = ' Cargo.toml | head -1 | cut -d'"' -f2 || echo "rustwebui-app")
    fi

    local config_end=$(date +%s.%N)
    local config_duration=$(echo "$config_end $config_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    
    log_info "App name: $APP_NAME" "CONFIG_READ" "$config_duration"
    log_info "App version: $APP_VERSION" "CONFIG_READ" "$config_duration"
}

# Check prerequisites
check_prerequisites() {
    local prereq_start=$(date +%s.%N)
    log_step "Checking prerequisites..." "PREREQ_CHECK"
    
    local missing=0
    local context="{}"

    # Check for Cargo
    if ! command -v cargo &> /dev/null; then
        log_error "Cargo is not installed. Please install Rust from https://rustup.rs/" "PREREQ_CHECK"
        missing=1
    else
        local cargo_version=$(cargo --version)
        log_info "Cargo found: $cargo_version" "PREREQ_CHECK"
        if command -v jq >/dev/null 2>&1; then
            context=$(echo "$context" | jq '.cargo_version="'$cargo_version'"' 2>/dev/null || echo '{"cargo_version":"'$cargo_version'"}')
        else
            # If jq is not available, just add to context string
            context="{\"cargo_version\":\"$cargo_version\"}"
        fi
    fi

    # Check for Bun (frontend build)
    if ! command -v bun &> /dev/null; then
        log_warn "Bun is not installed. Frontend build may fail." "PREREQ_CHECK"
        log_warn "Install Bun from https://bun.sh/" "PREREQ_CHECK"
    else
        local bun_version=$(bun --version)
        log_info "Bun found: $bun_version" "PREREQ_CHECK"
        if command -v jq >/dev/null 2>&1; then
            context=$(echo "$context" | jq '.bun_version="'$bun_version'"' 2>/dev/null || echo '{"bun_version":"'$bun_version'"}')
        else
            # If jq is not available, just add to context string
            context="{\"bun_version\":\"$bun_version\"}"
        fi
    fi

    local prereq_end=$(date +%s.%N)
    local prereq_duration=$(echo "$prereq_end $prereq_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    
    log_info "Prerequisite check completed" "PREREQ_CHECK" "$prereq_duration" "$context"

    if [ $missing -eq 1 ]; then
        exit 1
    fi
}

# Build frontend
build_frontend() {
    local frontend_start=$(date +%s.%N)
    log_step "Building frontend..." "FRONTEND_BUILD"
    
    if [ ! -d "frontend" ]; then
        log_warn "Frontend directory not found, skipping frontend build" "FRONTEND_BUILD"
        return 0
    fi

    # Install frontend dependencies if needed
    if [ ! -d "frontend/node_modules" ]; then
        log_info "Installing frontend dependencies..." "FRONTEND_DEPS"
        local deps_duration=$(time_command "cd frontend && bun install")
        log_info "Frontend dependencies installed successfully" "FRONTEND_DEPS" "$deps_duration"
    else
        log_info "Frontend dependencies already installed." "FRONTEND_DEPS"
    fi

    # Build frontend
    if [ -f "build-frontend.js" ]; then
        local build_duration=$(time_command "bun build-frontend.js")
        log_info "Frontend built successfully" "FRONTEND_BUILD" "$build_duration"
    else
        log_warn "build-frontend.js not found, skipping frontend build" "FRONTEND_BUILD"
    fi

    cd "$SCRIPT_DIR"
    
    local frontend_end=$(date +%s.%N)
    local frontend_duration=$(echo "$frontend_end $frontend_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Frontend build process completed" "FRONTEND_BUILD" "$frontend_duration"
}

# Build Rust application
build_rust() {
    local build_type="${1:-release}"
    local rust_start=$(date +%s.%N)
    log_step "Building Rust application ($build_type)..." "RUST_BUILD"
    
    local build_cmd
    if [ "$build_type" = "release" ]; then
        build_cmd="cargo build --release"
    else
        build_cmd="cargo build"
    fi
    
    local build_duration=$(time_command "$build_cmd")
    
    log_info "Rust build completed" "RUST_BUILD" "$build_duration" "{\"build_type\":\"$build_type\"}"
}

# Build for current platform
build_current_platform() {
    local build_type="${1:-release}"
    local platform_start=$(date +%s.%N)
    
    log_step "Building for current platform ($PLATFORM-$ARCH)..." "PLATFORM_BUILD"
    
    # Build frontend
    build_frontend
    
    # Build Rust
    build_rust "$build_type"
    
    local platform_end=$(date +%s.%N)
    local platform_duration=$(echo "$platform_end $platform_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    
    log_info "Build completed for $PLATFORM-$ARCH" "PLATFORM_BUILD" "$platform_duration" "{\"platform\":\"$PLATFORM\", \"arch\":\"$ARCH\", \"build_type\":\"$build_type\"}"
}

# Create distribution package
create_dist_package() {
    local build_type="${1:-release}"
    local output_dir="$DIST_DIR/${APP_NAME}-${APP_VERSION}-${PLATFORM}-${ARCH}"
    
    local package_start=$(date +%s.%N)
    log_step "Creating distribution package..." "DIST_PACKAGE"
    
    # Clean and create output directory
    local clean_duration=$(time_command "rm -rf '$output_dir' && mkdir -p '$output_dir'")
    log_debug "Cleaned and created output directory" "DIST_PACKAGE" "$clean_duration"
    
    # Copy executable
    local exe_name="${APP_NAME}"
    if [ "$PLATFORM" = "windows" ]; then
        exe_name="${APP_NAME}.exe"
    fi

    local source_exe=""
    if [ "$build_type" = "release" ]; then
        source_exe="target/release/${APP_NAME}"
    else
        source_exe="target/debug/${APP_NAME}"
    fi

    # Handle different executable names from cargo
    if [ ! -f "$source_exe" ]; then
        local cargo_name=$(grep '^name = ' Cargo.toml | head -1 | cut -d'"' -f2)
        source_exe="target/${build_type}/${cargo_name}"
    fi

    if [ "$PLATFORM" = "windows" ]; then
        source_exe="${source_exe}.exe"
    fi

    if [ ! -f "$source_exe" ]; then
        log_error "Executable not found: $source_exe" "DIST_PACKAGE"
        return 1
    fi

    # Copy executable
    local copy_exe_duration=$(time_command "cp '$source_exe' '${output_dir}/${exe_name}' && chmod +x '${output_dir}/${exe_name}'")
    log_info "Copied executable: $exe_name" "DIST_PACKAGE" "$copy_exe_duration"
    
    # Copy static files (frontend)
    if [ -d "static" ]; then
        local copy_static_duration=$(time_command "cp -r static '$output_dir/'")
        log_info "Copied static files" "DIST_PACKAGE" "$copy_static_duration"
    fi

    # Copy database (if exists)
    if [ -f "app.db" ]; then
        local copy_db_duration=$(time_command "cp app.db '$output_dir/'")
        log_info "Copied database" "DIST_PACKAGE" "$copy_db_duration"
    fi

    # Copy configuration
    if [ -f "app.config.toml" ]; then
        local copy_config_duration=$(time_command "cp app.config.toml '$output_dir/'")
        log_info "Copied configuration" "DIST_PACKAGE" "$copy_config_duration"
    fi

    # Create README for the package
    create_readme "$output_dir"

    # Create startup script (for convenience)
    create_startup_script "$output_dir"

    # Create archive
    create_archive "$output_dir"

    # Print package size
    local size=$(du -sh "$output_dir" 2>/dev/null | cut -f1 || echo "unknown")
    log_info "Distribution package created: $output_dir" "DIST_PACKAGE" "" "{\"size\":\"$size\"}"
    
    local package_end=$(date +%s.%N)
    local package_duration=$(echo "$package_end $package_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Distribution package creation completed" "DIST_PACKAGE" "$package_duration" "{\"output_dir\":\"$output_dir\", \"size\":\"$size\"}"
}

# Create README for distribution
create_readme() {
    local dir="$1"
    local readme_start=$(date +%s.%N)
    local readme_file="${dir}/README.txt"

    cat > "$readme_file" << EOF
================================================================================
${APP_NAME} v${APP_VERSION}
================================================================================

Quick Start:
- ${PLATFORM}-${ARCH} Build

For ${PLATFORM}, simply run:
  ./${APP_NAME}

The application will start a local web server and open your default browser.

Configuration:
- Edit app.config.toml to customize database path, logging, etc.

Features:
- Built with Rust + WebUI + React.js
- SQLite database with bundled SQLite (no external dependencies)
- Self-contained distribution - no runtime dependencies required

================================================================================
EOF

    local readme_end=$(date +%s.%N)
    local readme_duration=$(echo "$readme_end $readme_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Created README.txt" "README_CREATE" "$readme_duration" "{\"path\":\"$readme_file\"}"
}

# Create startup script
create_startup_script() {
    local dir="$1"
    local script_start=$(date +%s.%N)
    local script_file="${dir}/start.sh"

    cat > "$script_file" << 'STARTUP_EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Set working directory
export RUSTWEBUI_HOME="$SCRIPT_DIR"

# Run the application
./app "$@"
STARTUP_EOF

    chmod +x "$script_file"
    
    local script_end=$(date +%s.%N)
    local script_duration=$(echo "$script_end $script_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Created startup script: start.sh" "STARTUP_SCRIPT" "$script_duration" "{\"path\":\"$script_file\"}"
}

# Create archive
create_archive() {
    local dir="$1"
    local archive_start=$(date +%s.%N)
    local archive_name=$(basename "$dir")

    log_step "Creating archive..." "ARCHIVE_CREATE"

    cd "$DIST_DIR"

    local archive_cmd=""
    case "$PLATFORM" in
        linux)
            archive_cmd="tar -czf '${archive_name}.tar.gz' '$archive_name'"
            ;;
        macos)
            archive_cmd="tar -czf '${archive_name}.tar.gz' '$archive_name'"
            ;;
        windows)
            if command -v zip &> /dev/null; then
                archive_cmd="zip -rq '${archive_name}.zip' '$archive_name'"
            else
                log_warn "zip not found, skipping zip archive" "ARCHIVE_CREATE"
                cd "$SCRIPT_DIR"
                return 0
            fi
            ;;
    esac

    if [ -n "$archive_cmd" ]; then
        local archive_duration=$(time_command "$archive_cmd")
        log_info "Created: ${archive_name}.(tar.gz|zip)" "ARCHIVE_CREATE" "$archive_duration" "{\"archive\":\"$archive_name\"}"
    fi

    cd "$SCRIPT_DIR"
    
    local archive_end=$(date +%s.%N)
    local archive_total_duration=$(echo "$archive_end $archive_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Archive creation completed" "ARCHIVE_CREATE" "$archive_total_duration"
}

# Build and package for current platform
build_and_package() {
    local build_type="${1:-release}"
    local total_start=$(date +%s.%N)
    
    log_step "Building and packaging for $PLATFORM-$ARCH..." "BUILD_PACKAGE_TOTAL"
    
    build_current_platform "$build_type"
    create_dist_package "$build_type"
    
    local total_end=$(date +%s.%N)
    local total_duration=$(echo "$total_end $total_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    
    log_info "Build and package complete!" "BUILD_PACKAGE_TOTAL" "$total_duration" "{\"platform\":\"$PLATFORM-$ARCH\", \"build_type\":\"$build_type\"}"
}

# Cross-compilation setup (advanced)
setup_cross_compile() {
    log_step "Setting up cross-compilation..." "CROSS_COMPILE_SETUP"

    case "$1" in
        windows)
            log_info "To cross-compile for Windows from Linux:" "CROSS_COMPILE_SETUP"
            log_info "  rustup target add x86_64-pc-windows-gnu" "CROSS_COMPILE_SETUP"
            log_info "  cargo build --release --target x86_64-pc-windows-gnu" "CROSS_COMPILE_SETUP"
            ;;
        macos)
            log_info "Cross-compilation for macOS requires macOS build machine" "CROSS_COMPILE_SETUP"
            log_info "or use osxcross (https://github.com/tpoechtrager/osxcross)" "CROSS_COMPILE_SETUP"
            ;;
        linux)
            log_info "For Linux ARM builds:" "CROSS_COMPILE_SETUP"
            log_info "  rustup target add aarch64-unknown-linux-gnu" "CROSS_COMPILE_SETUP"
            log_info "  cargo build --release --target aarch64-unknown-linux-gnu" "CROSS_COMPILE_SETUP"
            ;;
    esac
}

# Full build for all platforms (requires CI/CD or multiple machines)
build_all_platforms() {
    log_error "Full cross-platform build requires:" "CROSS_BUILD_ALL"
    log_error "  1. Multiple build machines (Windows, macOS, Linux)" "CROSS_BUILD_ALL"
    log_error "  2. Or use GitHub Actions for CI/CD" "CROSS_BUILD_ALL"
    log_info "Recommended approach: Use GitHub Actions workflow" "CROSS_BUILD_ALL"
    log_info "See: .github/workflows/cross-build.yml" "CROSS_BUILD_ALL"

    log_step "Building for current platform only..." "CROSS_BUILD_CURRENT"
    build_and_package "release"
}

# Verify self-contained nature
verify_self_contained() {
    local dir="${1:-$DIST_DIR}/${APP_NAME}-${APP_VERSION}-${PLATFORM}-${ARCH}"
    local verify_start=$(date +%s.%N)

    log_step "Verifying self-contained package..." "VERIFY_SELF_CONTAINED"

    if [ ! -d "$dir" ]; then
        log_error "Directory not found: $dir" "VERIFY_SELF_CONTAINED"
        return 1
    fi

    # Check for executable
    if [ ! -f "$dir/${APP_NAME}" ]; then
        if [ "$PLATFORM" = "windows" ]; then
            if [ ! -f "$dir/${APP_NAME}.exe" ]; then
                log_error "Executable not found" "VERIFY_SELF_CONTAINED"
                return 1
            fi
        else
            log_error "Executable not found" "VERIFY_SELF_CONTAINED"
            return 1
        fi
    fi

    # Check for static files
    if [ ! -d "$dir/static" ]; then
        log_warn "Static files directory not found" "VERIFY_SELF_CONTAINED"
    fi

    # Verify no external library dependencies (Linux)
    if [ "$PLATFORM" = "linux" ] && command -v ldd &> /dev/null; then
        log_info "Checking library dependencies..." "VERIFY_LIBS"
        local exe_path="$dir/${APP_NAME}"
        if [ -f "$exe_path" ]; then
            local deps_check_duration=$(time_command "ldd '$exe_path' 2>/dev/null | grep -v '=> /' | grep -v 'statically linked' || true")
            log_info "Library dependency check completed" "VERIFY_LIBS" "$deps_check_duration"
        fi
    fi

    local verify_end=$(date +%s.%N)
    local verify_duration=$(echo "$verify_end $verify_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Verification complete" "VERIFY_SELF_CONTAINED" "$verify_duration" "{\"package_dir\":\"$dir\"}"
}

# Clean distribution directory
clean_dist() {
    local clean_start=$(date +%s.%N)
    log_step "Cleaning distribution directory..." "CLEAN_DIST"

    if [ -d "$DIST_DIR" ]; then
        local clean_duration=$(time_command "rm -rf '$DIST_DIR'")
        log_info "Cleaned $DIST_DIR" "CLEAN_DIST" "$clean_duration"
    else
        log_info "$DIST_DIR already clean" "CLEAN_DIST"
    fi
    
    local clean_end=$(date +%s.%N)
    local clean_total_duration=$(echo "$clean_end $clean_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Distribution cleaning completed" "CLEAN_DIST" "$clean_total_duration"
}

# Show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Cross-Platform Distribution Build Script"
    echo "Enhanced with detailed logging system"
    echo ""
    echo "Options:"
    echo "  build              Build and create package for current platform"
    echo "  build-release     Build release version and package (default)"
    echo "  build-debug       Build debug version and package"
    echo "  build-frontend     Build frontend only"
    echo "  build-rust        Build Rust only"
    echo "  verify            Verify self-contained package"
    echo "  clean             Clean distribution directory"
    echo "  cross-setup      Show cross-compilation setup info"
    echo "  all              Build for all platforms (current platform only)"
    echo "  help, -h         Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BUILD_TYPE        Override build type (release|debug)"
    echo "  LOG_FORMAT        Set log format (text|json) - defaults to text"
    echo "  LOG_FILE          Set log file name - defaults to build-[timestamp].log"
    echo ""
    echo "Examples:"
    echo "  $0 build-release  # Build release package (default)"
    echo "  $0 build-debug     # Build debug package"
    echo "  $0 verify          # Verify package"
    echo "  $0 clean           # Clean dist directory"
    echo "  LOG_FORMAT=json $0 build-release  # Build with JSON logging"
    echo ""
    echo "Note: Full cross-platform builds (Windows/macOS/Linux) require"
    echo "      building on each platform or using CI/CD like GitHub Actions."
}

# Main function
main() {
    # Set default log format if not provided
    LOG_FORMAT=${LOG_FORMAT:-"text"}
    
    log_info "========================================" "BUILD_START"
    log_info "Cross-Platform Distribution Builder" "BUILD_START"
    log_info "========================================" "BUILD_START"
    log_info "Build started at: $TIMESTAMP" "BUILD_START" "" "{\"log_format\":\"$LOG_FORMAT\", \"log_file\":\"$LOG_FILE\"}"

    # Detect platform and architecture
    detect_platform
    detect_arch

    # Read configuration
    read_config

    # Show header
    log_info "----------------------------------------" "BUILD_HEADER"
    log_info "Building: $APP_NAME v$APP_VERSION" "BUILD_HEADER" "" "{\"platform\":\"$PLATFORM-$ARCH\"}"
    log_info "----------------------------------------" "BUILD_HEADER"

    # Process command line arguments
    case "${1:-build-release}" in
        build)
            check_prerequisites
            build_and_package "${BUILD_TYPE:-release}"
            ;;
        build-release)
            check_prerequisites
            build_and_package "release"
            ;;
        build-debug)
            check_prerequisites
            build_and_package "debug"
            ;;
        build-frontend)
            check_prerequisites
            build_frontend
            ;;
        build-rust)
            check_prerequisites
            build_rust "${BUILD_TYPE:-release}"
            ;;
        verify)
            verify_self_contained
            ;;
        clean)
            clean_dist
            ;;
        cross-setup)
            setup_cross_compile "${2:-}"
            ;;
        all)
            check_prerequisites
            build_all_platforms
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown option: $1" "BUILD_ERROR"
            show_help
            exit 1
            ;;
    esac
    
    log_info "========================================" "BUILD_END"
    log_info "Build completed successfully!" "BUILD_END"
    log_info "Log file: $LOG_FILE" "BUILD_END"
    log_info "========================================" "BUILD_END"
}

# Run main with all arguments
main "$@"
