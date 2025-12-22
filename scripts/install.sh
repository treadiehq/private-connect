#!/bin/bash
set -e

# Private Connect CLI Installer
# Usage: curl -fsSL https://privateconnect.co/install.sh | bash

DOWNLOAD_BASE="https://privateconnect.co/releases"
BINARY_NAME="connect"
INSTALL_DIR="/usr/local/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════╗"
echo "║     Private Connect CLI Installer          ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Detect OS
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$OS" in
  darwin) OS="darwin" ;;
  linux) OS="linux" ;;
  *)
    echo -e "${RED}Error: Unsupported operating system: $OS${NC}"
    echo "Supported: macOS (darwin), Linux"
    exit 1
    ;;
esac

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
    echo "Supported: x64, arm64"
    exit 1
    ;;
esac

echo -e "Detected: ${GREEN}${OS}-${ARCH}${NC}"

# Build download URL
BINARY_FILE="${BINARY_NAME}-${OS}-${ARCH}"
DOWNLOAD_URL="${DOWNLOAD_BASE}/${BINARY_FILE}"

# Create temp directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# Download binary
echo "Downloading ${BINARY_FILE}..."
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$BINARY_NAME"; then
  echo -e "${RED}Error: Failed to download binary${NC}"
  echo "URL: $DOWNLOAD_URL"
  echo ""
  echo "This could mean:"
  echo "  - The binary for your platform is not available"
  echo "  - Network connectivity issues"
  exit 1
fi

# Make executable
chmod +x "$TMP_DIR/$BINARY_NAME"

# Install
echo "Installing to ${INSTALL_DIR}..."
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_DIR/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
else
  echo -e "${YELLOW}Requires sudo to install to ${INSTALL_DIR}${NC}"
  sudo mv "$TMP_DIR/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
fi

# Verify installation
if command -v $BINARY_NAME &> /dev/null; then
  echo ""
  echo -e "${GREEN}✓ Private Connect installed successfully!${NC}"
  echo ""
  echo "Get started:"
  echo -e "  ${CYAN}connect up${NC}              # Start agent and authenticate"
  echo -e "  ${CYAN}connect expose${NC} <target> # Expose a local service"
  echo -e "  ${CYAN}connect reach${NC} <service> # Test & connect to a service"
  echo -e "  ${CYAN}connect --help${NC}          # Show all commands"
  echo ""
else
  echo -e "${RED}Error: Installation failed${NC}"
  exit 1
fi
