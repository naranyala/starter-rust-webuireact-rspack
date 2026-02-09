#!/usr/bin/env bash

# Post-build script to rename the executable and prepare distribution
# This script runs after cargo build completes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================="
echo "Post-build Configuration"
echo "============================================="

# Read executable name from config
EXECUTABLE_NAME=$(grep -A1 '\[executable\]' app.config.toml 2>/dev/null | grep 'name' | cut -d'=' -f2 | tr -d ' "' || echo "app")

if [ -z "$EXECUTABLE_NAME" ]; then
    EXECUTABLE_NAME="app"
fi

echo "Configured executable name: $EXECUTABLE_NAME"

# Get the package name from Cargo.toml
PACKAGE_NAME=$(grep '^name = ' Cargo.toml | head -1 | cut -d'"' -f2)

# Define source and target paths
SOURCE_BIN="target/debug/$PACKAGE_NAME"
SOURCE_BIN_RELEASE="target/release/$PACKAGE_NAME"
TARGET_BIN="target/debug/$EXECUTABLE_NAME"
TARGET_BIN_RELEASE="target/release/$EXECUTABLE_NAME"

# Rename debug build
if [ -f "$SOURCE_BIN" ]; then
    if [ "$SOURCE_BIN" != "$TARGET_BIN" ]; then
        echo "Renaming debug binary: $PACKAGE_NAME -> $EXECUTABLE_NAME"
        mv "$SOURCE_BIN" "$TARGET_BIN"
    else
        echo "Debug binary already named: $EXECUTABLE_NAME"
    fi
fi

# Rename release build
if [ -f "$SOURCE_BIN_RELEASE" ]; then
    if [ "$SOURCE_BIN_RELEASE" != "$TARGET_BIN_RELEASE" ]; then
        echo "Renaming release binary: $PACKAGE_NAME -> $EXECUTABLE_NAME"
        mv "$SOURCE_BIN_RELEASE" "$TARGET_BIN_RELEASE"
    else
        echo "Release binary already named: $EXECUTABLE_NAME"
    fi
fi

# Also handle Windows .exe files
if [ -f "$SOURCE_BIN.exe" ]; then
    echo "Renaming debug binary (Windows): $PACKAGE_NAME.exe -> $EXECUTABLE_NAME.exe"
    mv "$SOURCE_BIN.exe" "$TARGET_BIN.exe"
fi

if [ -f "$SOURCE_BIN_RELEASE.exe" ]; then
    echo "Renaming release binary (Windows): $PACKAGE_NAME.exe -> $EXECUTABLE_NAME.exe"
    mv "$SOURCE_BIN_RELEASE.exe" "$TARGET_BIN_RELEASE.exe"
fi

# Verify static linking (Linux)
if [ -f "$TARGET_BIN_RELEASE" ]; then
    echo ""
    echo "Verifying static linking..."
    if command -v ldd &> /dev/null; then
        echo "Library dependencies for release build:"
        ldd "$TARGET_BIN_RELEASE" 2>/dev/null | head -20 || echo "(statically linked or ldd not available)"
    fi
fi

echo ""
echo "============================================="
echo "Post-build configuration complete!"
echo "============================================="
echo "Executable: $EXECUTABLE_NAME"
echo ""
echo "To run:"
echo "  Debug:   ./$TARGET_BIN"
echo "  Release: ./$TARGET_BIN_RELEASE"
echo ""
echo "For distribution builds, run:"
echo "  ./build-dist.sh build-release"
echo "============================================="
