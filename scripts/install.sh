#!/bin/bash
set -e

# Private Connect CLI Installer
# Usage: curl -fsSL https://get.privateconnect.io | bash

VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="connect"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}$1${NC}"; }
success() { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
error() { echo -e "${RED}$1${NC}"; exit 1; }

# Detect OS and architecture
detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    
    case "$OS" in
        Linux)  OS="linux" ;;
        Darwin) OS="darwin" ;;
        *)      error "Unsupported OS: $OS" ;;
    esac
    
    case "$ARCH" in
        x86_64|amd64)   ARCH="x64" ;;
        arm64|aarch64)  ARCH="arm64" ;;
        *)              error "Unsupported architecture: $ARCH" ;;
    esac
    
    PLATFORM="${OS}-${ARCH}"
}

# Check for required tools
check_deps() {
    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed"
    fi
}

# Download and install
install() {
    detect_platform
    check_deps
    
    echo ""
    info "Installing Private Connect CLI..."
    echo ""
    info "  Platform: $PLATFORM"
    info "  Install to: $INSTALL_DIR"
    echo ""
    
    # For now, we'll build locally since we don't have a release server yet
    # In production, this would download from a CDN:
    # DOWNLOAD_URL="https://releases.privateconnect.io/${VERSION}/connect-${PLATFORM}"
    
    # Check if we're installing from local build
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    LOCAL_BINARY="${SCRIPT_DIR}/../apps/agent/bin/connect-${PLATFORM}"
    LOCAL_DEFAULT="${SCRIPT_DIR}/../apps/agent/bin/connect"
    
    if [[ -f "$LOCAL_BINARY" ]]; then
        info "Installing from local build: $LOCAL_BINARY"
        BINARY_SOURCE="$LOCAL_BINARY"
    elif [[ -f "$LOCAL_DEFAULT" ]]; then
        info "Installing from local build: $LOCAL_DEFAULT"
        BINARY_SOURCE="$LOCAL_DEFAULT"
    else
        error "Binary not found. Build first with: cd apps/agent && pnpm run build:binary"
    fi
    
    # Install
    if [[ -w "$INSTALL_DIR" ]]; then
        cp "$BINARY_SOURCE" "$INSTALL_DIR/$BINARY_NAME"
        chmod +x "$INSTALL_DIR/$BINARY_NAME"
    else
        info "Requesting sudo access to install to $INSTALL_DIR..."
        sudo cp "$BINARY_SOURCE" "$INSTALL_DIR/$BINARY_NAME"
        sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"
    fi
    
    echo ""
    success "✓ Installed successfully!"
    echo ""
    info "  Run 'connect --help' to get started"
    info "  Or 'connect up' to connect your first agent"
    echo ""
}

# Run
install

