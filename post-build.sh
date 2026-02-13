#!/usr/bin/env bash

# Post-build script to rename the executable and prepare distribution
# Enhanced with detailed logging system
# This script runs after cargo build completes

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="post-build-${TIMESTAMP}.log"

# Enhanced logging functions
log() {
    local level=$1
    local message=$2
    local module=${3:-"POST_BUILD"}
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

log_info() { log "INFO" "$1" "${2:-POST_BUILD}" "${3:-}" "${4:-}"; }
log_warn() { log "WARN" "$1" "${2:-POST_BUILD}" "${3:-}" "${4:-}"; }
log_error() { log "ERROR" "$1" "${2:-POST_BUILD}" "${3:-}" "${4:-}"; }
log_debug() { log "DEBUG" "$1" "${2:-POST_BUILD}" "${3:-}" "${4:-}"; }
log_step() { log "STEP" "$1" "${2:-POST_BUILD}" "${3:-}" "${4:-}"; }

# Timing function
time_command() {
    local start_time=$(date +%s.%N)
    local cmd="$1"
    eval "$cmd"
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time $start_time" | awk '{result = ($1 - $2) * 1000; printf "%.0f", result}')
    echo "$duration"
}

log_info "=============================================" "POST_BUILD_START"
log_info "Post-build Configuration" "POST_BUILD_START"
log_info "=============================================" "POST_BUILD_START"
log_info "Post-build started at: $TIMESTAMP" "POST_BUILD_START" "" "{\"log_format\":\"${LOG_FORMAT:-text}\", \"log_file\":\"$LOG_FILE\"}"

# Read executable name from config
config_read_start=$(date +%s.%N)
EXECUTABLE_NAME=$(grep -A1 '\[executable\]' app.config.toml 2>/dev/null | grep 'name' | cut -d'=' -f2 | tr -d ' "' || echo "app")

if [ -z "$EXECUTABLE_NAME" ]; then
    EXECUTABLE_NAME="app"
fi

# Get the package name from Cargo.toml
PACKAGE_NAME=$(grep '^name = ' Cargo.toml | head -1 | cut -d'"' -f2)

config_read_end=$(date +%s.%N)
config_read_duration=$(echo "$config_read_end $config_read_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')

log_info "Configured executable name: $EXECUTABLE_NAME" "CONFIG_READ" "$config_read_duration"
log_info "Package name: $PACKAGE_NAME" "CONFIG_READ" "$config_read_duration"

# Define source and target paths
SOURCE_BIN="target/debug/$PACKAGE_NAME"
SOURCE_BIN_RELEASE="target/release/$PACKAGE_NAME"
TARGET_BIN="target/debug/$EXECUTABLE_NAME"
TARGET_BIN_RELEASE="target/release/$EXECUTABLE_NAME"

# Rename debug build
rename_debug_start=$(date +%s.%N)
if [ -f "$SOURCE_BIN" ]; then
    if [ "$SOURCE_BIN" != "$TARGET_BIN" ]; then
        log_info "Renaming debug binary: $PACKAGE_NAME -> $EXECUTABLE_NAME" "RENAME_DEBUG"
        mv "$SOURCE_BIN" "$TARGET_BIN"
        log_info "Debug binary renamed successfully" "RENAME_DEBUG"
    else
        log_info "Debug binary already named: $EXECUTABLE_NAME" "RENAME_DEBUG"
    fi
else
    log_warn "Debug binary not found: $SOURCE_BIN" "RENAME_DEBUG"
fi
rename_debug_end=$(date +%s.%N)
rename_debug_duration=$(echo "$rename_debug_end $rename_debug_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
log_info "Debug binary renaming completed" "RENAME_DEBUG" "$rename_debug_duration"

# Rename release build
rename_release_start=$(date +%s.%N)
if [ -f "$SOURCE_BIN_RELEASE" ]; then
    if [ "$SOURCE_BIN_RELEASE" != "$TARGET_BIN_RELEASE" ]; then
        log_info "Renaming release binary: $PACKAGE_NAME -> $EXECUTABLE_NAME" "RENAME_RELEASE"
        mv "$SOURCE_BIN_RELEASE" "$TARGET_BIN_RELEASE"
        log_info "Release binary renamed successfully" "RENAME_RELEASE"
    else
        log_info "Release binary already named: $EXECUTABLE_NAME" "RENAME_RELEASE"
    fi
else
    log_warn "Release binary not found: $SOURCE_BIN_RELEASE" "RENAME_RELEASE"
fi
rename_release_end=$(date +%s.%N)
rename_release_duration=$(echo "$rename_release_end $rename_release_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
log_info "Release binary renaming completed" "RENAME_RELEASE" "$rename_release_duration"

# Also handle Windows .exe files
rename_windows_start=$(date +%s.%N)
if [ -f "$SOURCE_BIN.exe" ]; then
    log_info "Renaming debug binary (Windows): $PACKAGE_NAME.exe -> $EXECUTABLE_NAME.exe" "RENAME_WINDOWS"
    mv "$SOURCE_BIN.exe" "$TARGET_BIN.exe"
    log_info "Windows debug binary renamed successfully" "RENAME_WINDOWS"
else
    log_debug "Windows debug binary not found: $SOURCE_BIN.exe" "RENAME_WINDOWS"
fi

if [ -f "$SOURCE_BIN_RELEASE.exe" ]; then
    log_info "Renaming release binary (Windows): $PACKAGE_NAME.exe -> $EXECUTABLE_NAME.exe" "RENAME_WINDOWS"
    mv "$SOURCE_BIN_RELEASE.exe" "$TARGET_BIN_RELEASE.exe"
    log_info "Windows release binary renamed successfully" "RENAME_WINDOWS"
else
    log_debug "Windows release binary not found: $SOURCE_BIN_RELEASE.exe" "RENAME_WINDOWS"
fi
rename_windows_end=$(date +%s.%N)
rename_windows_duration=$(echo "$rename_windows_end $rename_windows_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
log_info "Windows binary renaming completed" "RENAME_WINDOWS" "$rename_windows_duration"

# Verify static linking (Linux)
verify_linking_start=$(date +%s.%N)
if [ -f "$TARGET_BIN_RELEASE" ]; then
    log_info "Verifying static linking..." "LINKING_VERIFY"
    if command -v ldd &> /dev/null; then
        log_info "Library dependencies for release build:" "LINKING_VERIFY"
        deps_output=$(ldd "$TARGET_BIN_RELEASE" 2>&1 | head -20)
        log_info "$deps_output" "LINKING_VERIFY"
    else
        log_warn "ldd command not available, skipping linking verification" "LINKING_VERIFY"
    fi
else
    log_warn "Release binary not found for linking verification: $TARGET_BIN_RELEASE" "LINKING_VERIFY"
fi
verify_linking_end=$(date +%s.%N)
verify_linking_duration=$(echo "$verify_linking_end $verify_linking_start" | awk '{printf "%.0f", ($1 - $2) * 1000}')
log_info "Linking verification completed" "LINKING_VERIFY" "$verify_linking_duration"

log_info "=============================================" "POST_BUILD_END"
log_info "Post-build configuration complete!" "POST_BUILD_END"
log_info "=============================================" "POST_BUILD_END"
log_info "Executable: $EXECUTABLE_NAME" "POST_BUILD_END" "" "{\"executable\":\"$EXECUTABLE_NAME\", \"package\":\"$PACKAGE_NAME\"}"
log_info "Log file: $LOG_FILE" "POST_BUILD_END"
log_info "=============================================" "POST_BUILD_END"
