#!/bin/bash
set -e

# Private Connect CLI Installer
# Usage: curl -fsSL https://privateconnect.co/install.sh | bash
#        curl -fsSL https://privateconnect.co/install.sh | bash -s -- --non-interactive
#        curl -fsSL https://privateconnect.co/install.sh | bash -s -- --non-interactive --api-key=YOUR_KEY

DOWNLOAD_BASE="https://privateconnect.co/releases"
BINARY_NAME="connect"
INSTALL_DIR="/usr/local/bin"

# Parse arguments
NON_INTERACTIVE=false
API_KEY=""
AUTO_DAEMON=false
EXPOSE_MOLTBOT=false

for arg in "$@"; do
  case $arg in
    --non-interactive|-n)
      NON_INTERACTIVE=true
      ;;
    --api-key=*)
      API_KEY="${arg#*=}"
      ;;
    --daemon)
      AUTO_DAEMON=true
      ;;
    --expose-moltbot)
      EXPOSE_MOLTBOT=true
      ;;
    --help|-h)
      echo "Private Connect Installer"
      echo ""
      echo "Usage: curl -fsSL https://privateconnect.co/install.sh | bash -s -- [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --non-interactive, -n   Skip prompts (for scripts/automation)"
      echo "  --api-key=KEY           Set API key for authentication"
      echo "  --daemon                Install and start background daemon"
      echo "  --expose-moltbot        Expose Moltbot gateway after install"
      echo "  --help, -h              Show this help"
      echo ""
      echo "Examples:"
      echo "  # Basic install"
      echo "  curl -fsSL https://privateconnect.co/install.sh | bash"
      echo ""
      echo "  # Non-interactive with API key and daemon"
      echo "  curl -fsSL https://privateconnect.co/install.sh | bash -s -- --non-interactive --api-key=pc_xxx --daemon"
      echo ""
      echo "  # Full Moltbot setup (for exe.dev VMs)"
      echo "  curl -fsSL https://privateconnect.co/install.sh | bash -s -- -n --api-key=pc_xxx --daemon --expose-moltbot"
      exit 0
      ;;
  esac
done

# Colors (disable in non-interactive mode for cleaner logs)
if [ "$NON_INTERACTIVE" = true ]; then
  RED=''
  GREEN=''
  YELLOW=''
  CYAN=''
  NC=''
else
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  NC='\033[0m'
fi

if [ "$NON_INTERACTIVE" = false ]; then
  echo -e "${CYAN}"
  echo "╔════════════════════════════════════════════╗"
  echo "║     Private Connect CLI Installer          ║"
  echo "╚════════════════════════════════════════════╝"
  echo -e "${NC}"
else
  echo "[Private Connect] Installing..."
fi

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
if ! command -v $BINARY_NAME &> /dev/null; then
  echo -e "${RED}Error: Installation failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Private Connect installed successfully!${NC}"

# Handle non-interactive setup
if [ "$NON_INTERACTIVE" = true ]; then
  # Configure API key if provided
  if [ -n "$API_KEY" ]; then
    echo "[Private Connect] Configuring API key..."
    mkdir -p ~/.config/privateconnect
    echo "$API_KEY" > ~/.config/privateconnect/api-key
    chmod 600 ~/.config/privateconnect/api-key
    echo "[Private Connect] ✓ API key configured"
  fi

  # Install daemon if requested
  if [ "$AUTO_DAEMON" = true ]; then
    echo "[Private Connect] Installing daemon..."
    $BINARY_NAME daemon install --non-interactive 2>/dev/null || true
    echo "[Private Connect] ✓ Daemon installed"
  fi

  # Expose Moltbot if requested
  if [ "$EXPOSE_MOLTBOT" = true ]; then
    echo "[Private Connect] Exposing Moltbot gateway..."
    # Wait a moment for daemon to start
    sleep 2
    $BINARY_NAME expose localhost:18789 --name moltbot 2>/dev/null || {
      echo "[Private Connect] Note: Moltbot gateway not found on :18789 (start Moltbot first)"
    }
    echo "[Private Connect] ✓ Setup complete"
  fi

  echo "[Private Connect] Installation complete"
else
  echo ""
  echo -e "${CYAN}Next step:${NC}"
  echo ""
  echo -e "  ${CYAN}connect up${NC}"
  echo ""
  echo "This will:"
  echo "  • Authenticate you (opens browser)"
  echo "  • Set up background service (auto-starts on login)"
  echo "  • Configure local DNS for *.connect domains"
  echo ""
  echo "Then you're ready:"
  echo -e "  ${CYAN}connect localhost:5432${NC}    # Expose a service (auto-named)"
  echo -e "  ${CYAN}connect prod-db${NC}           # Connect to a service"
  echo -e "  ${CYAN}connect clone alice${NC}       # Clone teammate's environment"
  echo ""
fi
