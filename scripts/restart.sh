#!/bin/bash

# ============================================
# Private Connect - Restart Script
# ============================================
# Usage:
#   ./scripts/restart.sh          # Restart in dev mode (default)
#   ./scripts/restart.sh dev      # Restart in dev mode
#   ./scripts/restart.sh docker   # Restart docker containers
#   ./scripts/restart.sh all      # Restart everything
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════╗"
    echo "║        Private Connect - Restart           ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Show usage
show_usage() {
    echo "Usage: $0 [mode]"
    echo ""
    echo "Modes:"
    echo "  dev      Restart in development mode (default)"
    echo "  docker   Restart Docker containers"
    echo "  all      Restart dev servers + demo server"
    echo ""
    echo "Examples:"
    echo "  $0           # Restart dev mode"
    echo "  $0 dev       # Restart dev mode"
    echo "  $0 docker    # Restart Docker containers"
    echo "  $0 all       # Restart everything"
}

# Restart in dev mode
restart_dev() {
    print_header
    print_status "Restarting development servers..."
    echo ""

    # Stop dev processes
    "$SCRIPT_DIR/stop.sh" dev 2>/dev/null || true

    # Small delay to ensure ports are released
    sleep 1

    # Start dev
    exec "$SCRIPT_DIR/start.sh" dev
}

# Restart Docker
restart_docker() {
    print_header
    print_status "Restarting Docker containers..."
    echo ""

    # Stop Docker
    "$SCRIPT_DIR/stop.sh" docker

    # Small delay
    sleep 1

    # Start Docker
    exec "$SCRIPT_DIR/start.sh" docker
}

# Restart all
restart_all() {
    print_header
    print_status "Restarting all services..."
    echo ""

    # Stop all
    "$SCRIPT_DIR/stop.sh" all

    # Small delay
    sleep 1

    # Start all
    exec "$SCRIPT_DIR/start.sh" all
}

# Main
MODE="${1:-dev}"

case "$MODE" in
    dev)
        restart_dev
        ;;
    docker)
        restart_docker
        ;;
    all)
        restart_all
        ;;
    -h|--help|help)
        show_usage
        ;;
    *)
        echo -e "${RED}✗${NC} Unknown mode: $MODE"
        show_usage
        exit 1
        ;;
esac

