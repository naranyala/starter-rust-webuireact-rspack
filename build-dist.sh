#!/usr/bin/env bash

#===============================================================================
# Cross-Platform Distribution Build Script
# Builds self-contained executables for Windows, macOS, and Linux
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME=""
APP_VERSION="1.0.0"
DIST_DIR="dist"
PLATFORM=""
ARCH=""

# Platform detection
detect_platform() {
    case "$(uname -s)" in
        Linux*)     PLATFORM="linux";;
        Darwin*)    PLATFORM="macos";;
        CYGWIN*|MINGW*|MSYS*) PLATFORM="windows";;
        *)          PLATFORM="unknown";;
    esac
    echo "Detected platform: $PLATFORM"
}

# Architecture detection
detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)   ARCH="x64";;
        aarch64|arm64)  ARCH="arm64";;
        armv7l)         ARCH="arm";;
        *)              ARCH="x64";;
    esac
    echo "Detected architecture: $ARCH"
}

# Print colored output
print_status() {
    echo -e "${GREEN}[DIST]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Read configuration from app.config.toml
read_config() {
    print_step "Reading configuration..."

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

    print_status "App name: $APP_NAME"
    print_status "App version: $APP_VERSION"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."

    local missing=0

    # Check for Cargo
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo is not installed. Please install Rust from https://rustup.rs/"
        missing=1
    else
        print_status "Cargo found: $(cargo --version)"
    fi

    # Check for Bun (frontend build)
    if ! command -v bun &> /dev/null; then
        print_warning "Bun is not installed. Frontend build may fail."
        print_warning "Install Bun from https://bun.sh/"
    else
        print_status "Bun found: $(bun --version)"
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi
}

# Build frontend
build_frontend() {
    print_step "Building frontend..."

    if [ ! -d "frontend" ]; then
        print_warning "Frontend directory not found, skipping frontend build"
        return 0
    fi

    # Install frontend dependencies if needed
    if [ ! -d "frontend/node_modules" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        bun install
        cd ..
    fi

    # Build frontend
    if [ -f "build-frontend.js" ]; then
        bun build-frontend.js
        print_status "Frontend built successfully"
    else
        print_warning "build-frontend.js not found, skipping frontend build"
    fi

    cd "$SCRIPT_DIR"
}

# Build Rust application
build_rust() {
    print_step "Building Rust application..."

    local build_type="${1:-release}"

    if [ "$build_type" = "release" ]; then
        cargo build --release
    else
        cargo build
    fi

    print_status "Rust build completed"
}

# Build for current platform
build_current_platform() {
    local build_type="${1:-release}"

    print_step "Building for current platform ($PLATFORM-$ARCH)..."

    # Build frontend
    build_frontend

    # Build Rust
    build_rust "$build_type"

    print_status "Build completed for $PLATFORM-$ARCH"
}

# Create distribution package
create_dist_package() {
    local build_type="${1:-release}"
    local output_dir="$DIST_DIR/${APP_NAME}-${APP_VERSION}-${PLATFORM}-${ARCH}"

    print_step "Creating distribution package..."

    # Clean and create output directory
    rm -rf "$output_dir"
    mkdir -p "$output_dir"

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
        print_error "Executable not found: $source_exe"
        return 1
    fi

    # Copy executable
    cp "$source_exe" "${output_dir}/${exe_name}"
    chmod +x "${output_dir}/${exe_name}"
    print_status "Copied executable: $exe_name"

    # Copy static files (frontend)
    if [ -d "static" ]; then
        cp -r static "$output_dir/"
        print_status "Copied static files"
    fi

    # Copy database (if exists)
    if [ -f "app.db" ]; then
        cp app.db "$output_dir/"
        print_status "Copied database"
    fi

    # Copy configuration
    if [ -f "app.config.toml" ]; then
        cp app.config.toml "$output_dir/"
        print_status "Copied configuration"
    fi

    # Create README for the package
    create_readme "$output_dir"

    # Create startup script (for convenience)
    create_startup_script "$output_dir"

    # Create archive
    create_archive "$output_dir"

    print_status "Distribution package created: $output_dir"

    # Print package size
    local size=$(du -sh "$output_dir" 2>/dev/null | cut -f1 || echo "unknown")
    print_status "Package size: $size"
}

# Create README for distribution
create_readme() {
    local dir="$1"
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

    print_status "Created README.txt"
}

# Create startup script
create_startup_script() {
    local dir="$1"
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
    print_status "Created startup script: start.sh"
}

# Create archive
create_archive() {
    local dir="$1"
    local archive_name=$(basename "$dir")

    print_step "Creating archive..."

    cd "$DIST_DIR"

    case "$PLATFORM" in
        linux)
            tar -czf "${archive_name}.tar.gz" "$archive_name"
            print_status "Created: ${archive_name}.tar.gz"
            ;;
        macos)
            tar -czf "${archive_name}.tar.gz" "$archive_name"
            print_status "Created: ${archive_name}.tar.gz"
            ;;
        windows)
            if command -v zip &> /dev/null; then
                zip -rq "${archive_name}.zip" "$archive_name"
                print_status "Created: ${archive_name}.zip"
            else
                print_warning "zip not found, skipping zip archive"
            fi
            ;;
    esac

    cd "$SCRIPT_DIR"
}

# Build and package for current platform
build_and_package() {
    local build_type="${1:-release}"

    print_step "Building and packaging for $PLATFORM-$ARCH..."

    build_current_platform "$build_type"
    create_dist_package "$build_type"

    print_status "Build and package complete!"
}

# Cross-compilation setup (advanced)
setup_cross_compile() {
    print_step "Setting up cross-compilation..."

    case "$1" in
        windows)
            print_info "To cross-compile for Windows from Linux:"
            print_info "  rustup target add x86_64-pc-windows-gnu"
            print_info "  cargo build --release --target x86_64-pc-windows-gnu"
            ;;
        macos)
            print_info "Cross-compilation for macOS requires macOS build machine"
            print_info "or use osxcross (https://github.com/tpoechtrager/osxcross)"
            ;;
        linux)
            print_info "For Linux ARM builds:"
            print_info "  rustup target add aarch64-unknown-linux-gnu"
            print_info "  cargo build --release --target aarch64-unknown-linux-gnu"
            ;;
    esac
}

# Full build for all platforms (requires CI/CD or multiple machines)
build_all_platforms() {
    print_error "Full cross-platform build requires:"
    print_error "  1. Multiple build machines (Windows, macOS, Linux)"
    print_error "  2. Or use GitHub Actions for CI/CD"
    print_error ""
    print_info "Recommended approach: Use GitHub Actions workflow"
    print_info "See: .github/workflows/cross-build.yml"

    print_step "Building for current platform only..."
    build_and_package "release"
}

# Verify self-contained nature
verify_self_contained() {
    local dir="${1:-$DIST_DIR}/${APP_NAME}-${APP_VERSION}-${PLATFORM}-${ARCH}"

    print_step "Verifying self-contained package..."

    if [ ! -d "$dir" ]; then
        print_error "Directory not found: $dir"
        return 1
    fi

    # Check for executable
    if [ ! -f "$dir/${APP_NAME}" ]; then
        if [ "$PLATFORM" = "windows" ]; then
            if [ ! -f "$dir/${APP_NAME}.exe" ]; then
                print_error "Executable not found"
                return 1
            fi
        else
            print_error "Executable not found"
            return 1
        fi
    fi

    # Check for static files
    if [ ! -d "$dir/static" ]; then
        print_warning "Static files directory not found"
    fi

    # Verify no external library dependencies (Linux)
    if [ "$PLATFORM" = "linux" ] && command -v ldd &> /dev/null; then
        print_info "Checking library dependencies..."
        local exe_path="$dir/${APP_NAME}"
        if [ -f "$exe_path" ]; then
            ldd "$exe_path" 2>/dev/null | grep -v "=> /" | grep -v "statically linked" || true
        fi
    fi

    print_status "Verification complete"
}

# Clean distribution directory
clean_dist() {
    print_step "Cleaning distribution directory..."

    if [ -d "$DIST_DIR" ]; then
        rm -rf "$DIST_DIR"
        print_status "Cleaned $DIST_DIR"
    else
        print_status "$DIST_DIR already clean"
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Cross-Platform Distribution Build Script"
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
    echo ""
    echo "Examples:"
    echo "  $0 build-release  # Build release package (default)"
    echo "  $0 build-debug     # Build debug package"
    echo "  $0 verify          # Verify package"
    echo "  $0 clean           # Clean dist directory"
    echo ""
    echo "Note: Full cross-platform builds (Windows/macOS/Linux) require"
    echo "      building on each platform or using CI/CD like GitHub Actions."
}

# Main function
main() {
    echo "========================================"
    echo "Cross-Platform Distribution Builder"
    echo "========================================"
    echo ""

    # Detect platform and architecture
    detect_platform
    detect_arch

    # Read configuration
    read_config

    # Show header
    echo ""
    echo "----------------------------------------"
    echo "Building: $APP_NAME v$APP_VERSION"
    echo "Platform: $PLATFORM-$ARCH"
    echo "----------------------------------------"
    echo ""

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
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main with all arguments
main "$@"
