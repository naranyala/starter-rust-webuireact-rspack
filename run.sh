#!/bin/bash

# Master build and run script for Rust WebUI Vue project
# This script handles the complete build pipeline for frontend and backend

set -e  # Exit on any error

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================"
echo "Rust WebUI Application - Build Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[BUILD]${NC} $1"
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

# Check if required tools are installed
check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check for Bun
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed. Please install Bun from https://bun.sh/"
        exit 1
    fi
    print_status "Bun found: $(bun --version)"

    # Check for Cargo/Rust
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo is not installed. Please install Rust from https://rustup.rs/"
        exit 1
    fi
    print_status "Cargo found: $(cargo --version)"

    echo ""
}

# Install frontend dependencies if needed
install_frontend_deps() {
    print_step "Installing frontend dependencies..."

    if [ ! -d "frontend/node_modules" ]; then
        print_status "Installing npm packages..."
        cd frontend
        bun install
        cd ..
        print_status "Frontend dependencies installed!"
    else
        print_status "Frontend dependencies already installed."
    fi

    echo ""
}

# Build frontend
build_frontend() {
    print_step "Building frontend..."

    if [ ! -f "build-frontend.js" ]; then
        print_error "build-frontend.js not found!"
        exit 1
    fi

    bun build-frontend.js

    if [ ! -d "frontend/dist" ]; then
        print_error "Frontend build failed - dist directory not found!"
        exit 1
    fi

    print_status "Frontend build completed!"

    echo ""
}

# Build Rust application
build_rust() {
    print_step "Building Rust application..."

    # Clean previous build artifacts if requested
    if [ "$1" == "--clean" ]; then
        print_status "Cleaning previous Rust build..."
        cargo clean
    fi

    # Build the Rust application
    cargo build

    if [ ! -f "target/debug/rustwebui-app" ]; then
        print_error "Rust build failed - executable not found!"
        exit 1
    fi

    print_status "Rust build completed!"

    echo ""
}

# Run post-build script
post_build() {
    print_step "Running post-build steps..."

    if [ -f "post-build.sh" ]; then
        chmod +x post-build.sh
        ./post-build.sh
        print_status "Post-build completed!"
    else
        print_warning "post-build.sh not found - skipping post-build steps"
    fi

    echo ""
}

# Build release version
build_release() {
    print_step "Building release version..."

    # Build frontend for production
    cd frontend
    bun install
    bun run build:incremental
    cd ..

    # Build Rust in release mode
    cargo build --release

    # Run post-build for release
    if [ -f "post-build.sh" ]; then
        chmod +x post-build.sh
        ./post-build.sh
    fi

    print_status "Release build completed!"

    echo ""
}

# Run the application
run_app() {
    print_step "Running application..."

    # Determine which executable to run
    if [ -f "target/debug/app" ]; then
        print_status "Running debug version..."
        ./target/debug/app
    elif [ -f "target/release/app" ]; then
        print_status "Running release version..."
        ./target/release/app
    elif [ -f "target/debug/rustwebui-app" ]; then
        print_warning "Using unrenamed executable..."
        ./target/debug/rustwebui-app
    else
        print_error "No executable found. Please build first."
        exit 1
    fi
}

# Clean all build artifacts
clean_all() {
    print_step "Cleaning all build artifacts..."

    # Clean Rust build
    if [ -d "target" ]; then
        cargo clean
        print_status "Rust build artifacts cleaned"
    fi

    # Clean frontend build
    if [ -d "frontend/dist" ]; then
        rm -rf frontend/dist
        print_status "Frontend dist cleaned"
    fi

    # Clean caches
    if [ -d "frontend/node_modules/.cache" ]; then
        rm -rf frontend/node_modules/.cache
        print_status "Frontend cache cleaned"
    fi

    # Remove lock files
    rm -f Cargo.lock

    print_status "All build artifacts cleaned!"

    echo ""
}

# Show help
show_help() {
    echo "Usage: $0 [OPTION]"
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
    echo "Examples:"
    echo "  $0               # Build and run"
    echo "  $0 --build       # Build only"
    echo "  $0 --rebuild     # Clean and rebuild"
    echo "  $0 --release     # Build release version"
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
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
