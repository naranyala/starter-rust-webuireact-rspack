#!/bin/bash

# Master build and run script for Rust WebUI React project
# This script handles the complete build pipeline for frontend and backend
# Enhanced with detailed logging system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="run-${TIMESTAMP}.log"

# Enhanced logging functions
log() {
    local level=$1
    local message=$2
    local module=${3:-"RUN_SCRIPT"}
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

log_status() { log "STATUS" "$1" "${2:-RUN_SCRIPT}" "${3:-}" "${4:-}"; }
log_warning() { log "WARN" "$1" "${2:-RUN_SCRIPT}" "${3:-}" "${4:-}"; }
log_error() { log "ERROR" "$1" "${2:-RUN_SCRIPT}" "${3:-}" "${4:-}"; }
log_step() { log "STEP" "$1" "${2:-RUN_SCRIPT}" "${3:-}" "${4:-}"; }
log_info() { log "INFO" "$1" "${2:-RUN_SCRIPT}" "${3:-}" "${4:-}"; }

# Timing function
time_command() {
    local start_time=$(date +%s.%N)
    local cmd="$1"
    eval "$cmd"
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time $start_time" | awk '{result = ($1 - $2) * 1000; printf "%.0f", result}')
    echo "$duration"
}

log_info "======================================" "SCRIPT_START"
log_info "Rust WebUI Application - Build Script" "SCRIPT_START"
log_info "======================================" "SCRIPT_START"
log_info "Script started at: $TIMESTAMP" "SCRIPT_START" "" "{\"log_format\":\"${LOG_FORMAT:-text}\", \"log_file\":\"$LOG_FILE\"}"

# Check if required tools are installed
check_prerequisites() {
    local prereq_start=$(date +%s.%N)
    log_step "Checking prerequisites..." "PREREQ_CHECK"
    
    local context="{}"

    # Check for Bun
    if ! command -v bun &> /dev/null; then
        log_error "Bun is not installed. Please install Bun from https://bun.sh/" "PREREQ_CHECK"
        exit 1
    fi
    local bun_version=$(bun --version)
    log_status "Bun found: $bun_version" "PREREQ_CHECK"
    if command -v jq >/dev/null 2>&1; then
        context=$(echo "$context" | jq '.bun_version="'$bun_version'"' 2>/dev/null || echo '{"bun_version":"'$bun_version'"}')
    else
        # If jq is not available, just add to context string
        context="{\"bun_version\":\"$bun_version\"}"
    fi

    # Check for Cargo/Rust
    if ! command -v cargo &> /dev/null; then
        log_error "Cargo is not installed. Please install Rust from https://rustup.rs/" "PREREQ_CHECK"
        exit 1
    fi
    local cargo_version=$(cargo --version)
    log_status "Cargo found: $cargo_version" "PREREQ_CHECK"
    if command -v jq >/dev/null 2>&1; then
        context=$(echo "$context" | jq '.cargo_version="'$cargo_version'"' 2>/dev/null || echo '{"cargo_version":"'$cargo_version'"}')
    else
        # If jq is not available, just add to context string
        context="{\"cargo_version\":\"$cargo_version\"}"
    fi

    local prereq_end=$(date +%s.%N)
    local prereq_duration=$(echo "$prereq_end $prereq_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    
    log_info "Prerequisites check completed" "PREREQ_CHECK" "$prereq_duration" "$context"
}

# Install frontend dependencies if needed
install_frontend_deps() {
    local deps_start=$(date +%s.%N)
    log_step "Installing frontend dependencies..." "FRONTEND_DEPS"
    
    if [ ! -d "frontend/node_modules" ]; then
        log_status "Installing npm packages..." "FRONTEND_DEPS"
        local install_duration=$(time_command "cd frontend && bun install")
        log_status "Frontend dependencies installed!" "FRONTEND_DEPS" "$install_duration"
    else
        log_status "Frontend dependencies already installed." "FRONTEND_DEPS"
    fi

    local deps_end=$(date +%s.%N)
    local deps_duration=$(echo "$deps_end $deps_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Frontend dependencies installation completed" "FRONTEND_DEPS" "$deps_duration"
}

# Build frontend
build_frontend() {
    local frontend_start=$(date +%s.%N)
    log_step "Building frontend..." "FRONTEND_BUILD"

    if [ ! -f "build-frontend.js" ]; then
        log_error "build-frontend.js not found!" "FRONTEND_BUILD"
        exit 1
    fi

    local build_duration=$(time_command "bun build-frontend.js")

    if [ ! -d "frontend/dist" ]; then
        log_error "Frontend build failed - dist directory not found!" "FRONTEND_BUILD"
        exit 1
    fi

    log_status "Frontend build completed!" "FRONTEND_BUILD" "$build_duration"

    local frontend_end=$(date +%s.%N)
    local frontend_duration=$(echo "$frontend_end $frontend_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Frontend build process completed" "FRONTEND_BUILD" "$frontend_duration"
}

# Build Rust application
build_rust() {
    local clean_flag="$1"
    local rust_start=$(date +%s.%N)
    log_step "Building Rust application..." "RUST_BUILD"
    
    # Clean previous build artifacts if requested
    if [ "$clean_flag" == "--clean" ]; then
        log_status "Cleaning previous Rust build..." "RUST_CLEAN"
        cargo clean
    fi

    # Build the Rust application
    local build_duration=$(time_command "cargo build")

    if [ ! -f "target/debug/rustwebui-app" ] && [ ! -f "target/debug/app" ]; then
        log_error "Rust build failed - executable not found!" "RUST_BUILD"
        exit 1
    fi

    log_status "Rust build completed!" "RUST_BUILD" "$build_duration"

    local rust_end=$(date +%s.%N)
    local rust_duration=$(echo "$rust_end $rust_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Rust build process completed" "RUST_BUILD" "$rust_duration" "{\"clean_requested\":\"$clean_flag\"}"
}

# Run post-build script
post_build() {
    local post_start=$(date +%s.%N)
    log_step "Running post-build steps..." "POST_BUILD"

    if [ -f "post-build.sh" ]; then
        local post_duration=$(time_command "chmod +x post-build.sh && ./post-build.sh")
        log_status "Post-build completed!" "POST_BUILD" "$post_duration"
    else
        log_warning "post-build.sh not found - skipping post-build steps" "POST_BUILD"
    fi

    local post_end=$(date +%s.%N)
    local post_duration=$(echo "$post_end $post_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Post-build process completed" "POST_BUILD" "$post_duration"
}

# Build release version
build_release() {
    local release_start=$(date +%s.%N)
    log_step "Building release version..." "RELEASE_BUILD"

    # Build frontend for production
    local frontend_build_duration=$(time_command "cd frontend && bun install && bun run build:incremental")
    log_info "Frontend release build completed" "RELEASE_BUILD" "$frontend_build_duration"

    # Build Rust in release mode
    local rust_build_duration=$(time_command "cargo build --release")
    log_info "Rust release build completed" "RELEASE_BUILD" "$rust_build_duration"

    # Run post-build for release
    if [ -f "post-build.sh" ]; then
        local post_duration=$(time_command "chmod +x post-build.sh && ./post-build.sh")
        log_info "Post-build for release completed" "RELEASE_BUILD" "$post_duration"
    fi

    log_status "Release build completed!" "RELEASE_BUILD"

    local release_end=$(date +%s.%N)
    local release_duration=$(echo "$release_end $release_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Release build process completed" "RELEASE_BUILD" "$release_duration"
}

# Run the application
run_app() {
    local run_start=$(date +%s.%N)
    log_step "Running application..." "APP_RUN"

    # Determine which executable to run
    if [ -f "target/debug/app" ]; then
        log_status "Running debug version..." "APP_RUN"
        ./target/debug/app
    elif [ -f "target/release/app" ]; then
        log_status "Running release version..." "APP_RUN"
        ./target/release/app
    elif [ -f "target/debug/rustwebui-app" ]; then
        log_warning "Using unrenamed executable..." "APP_RUN"
        ./target/debug/rustwebui-app
    else
        log_error "No executable found. Please build first." "APP_RUN"
        exit 1
    fi

    local run_end=$(date +%s.%N)
    local run_duration=$(echo "$run_end $run_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Application run process completed" "APP_RUN" "$run_duration"
}

# Clean all build artifacts
clean_all() {
    local clean_start=$(date +%s.%N)
    log_step "Cleaning all build artifacts..." "CLEAN_ALL"

    local total_clean_duration=0

    # Clean Rust build
    if [ -d "target" ]; then
        local rust_clean_duration=$(time_command "cargo clean")
        log_status "Rust build artifacts cleaned" "CLEAN_RUST" "$rust_clean_duration"
        total_clean_duration=$(echo "$total_clean_duration $rust_clean_duration" | awk '{print $1 + $2}')
    fi

    # Clean frontend build
    if [ -d "frontend/dist" ]; then
        local frontend_clean_duration=$(time_command "rm -rf frontend/dist")
        log_status "Frontend dist cleaned" "CLEAN_FRONTEND" "$frontend_clean_duration"
        total_clean_duration=$(echo "$total_clean_duration $frontend_clean_duration" | awk '{print $1 + $2}')
    fi

    # Clean caches
    if [ -d "frontend/node_modules/.cache" ]; then
        local cache_clean_duration=$(time_command "rm -rf frontend/node_modules/.cache")
        log_status "Frontend cache cleaned" "CLEAN_CACHE" "$cache_clean_duration"
        total_clean_duration=$(echo "$total_clean_duration $cache_clean_duration" | awk '{print $1 + $2}')
    fi

    # Remove lock files
    if [ -f "Cargo.lock" ]; then
        rm -f Cargo.lock
        log_info "Removed Cargo.lock" "CLEAN_LOCK"
    fi

    log_status "All build artifacts cleaned!" "CLEAN_ALL"

    local clean_end=$(date +%s.%N)
    local clean_duration=$(echo "$clean_end $clean_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
    log_info "Cleanup process completed" "CLEAN_ALL" "$clean_duration" "{\"total_clean_duration_ms\":\"$total_clean_duration\"}"
}

# Show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Master build and run script for Rust WebUI React project"
    echo "Enhanced with detailed logging system"
    echo ""
    echo "Options:"
    echo "  (no option)      Build and run the application (default)"
    echo "  --build           Build only (frontend + Rust)"
    echo "  --build-frontend  Build frontend only"
    echo "  --build-rust     Build Rust only"
    echo "  --release        Build release version"
    echo "  --run            Run the application (requires build)"
    echo "  --clean          Clean all build artifacts"
    echo "  --rebuild        Clean and rebuild everything"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  LOG_FORMAT        Set log format (text|json) - defaults to text"
    echo "  LOG_FILE          Set log file name - defaults to run-[timestamp].log"
    echo ""
    echo "Examples:"
    echo "  $0               # Build and run"
    echo "  $0 --build       # Build only"
    echo "  $0 --rebuild     # Clean and rebuild"
    echo "  $0 --release     # Build release version"
    echo "  LOG_FORMAT=json $0 --build  # Build with JSON logging"
    echo ""
}

# Main execution
main() {
    case "${1:-}" in
        --build)
            check_prerequisites
            install_frontend_deps
            build_frontend
            build_rust
            post_build
            ;;
        --build-frontend)
            check_prerequisites
            install_frontend_deps
            build_frontend
            ;;
        --build-rust)
            check_prerequisites
            build_rust
            post_build
            ;;
        --release)
            check_prerequisites
            build_release
            ;;
        --run)
            run_app
            ;;
        --clean)
            clean_all
            ;;
        --rebuild)
            clean_all
            check_prerequisites
            install_frontend_deps
            build_frontend
            build_rust
            post_build
            ;;
        --help|-h)
            show_help
            ;;
        "")
            # Default: build and run
            check_prerequisites
            install_frontend_deps
            build_frontend
            build_rust
            post_build
            run_app
            ;;
        *)
            log_error "Unknown option: $1" "SCRIPT_ERROR"
            show_help
            exit 1
            ;;
    esac
    
    log_info "======================================" "SCRIPT_END"
    log_info "Script completed successfully!" "SCRIPT_END"
    log_info "Log file: $LOG_FILE" "SCRIPT_END"
    log_info "======================================" "SCRIPT_END"
}

# Run main function with all arguments
main "$@"
