#!/bin/bash

# ============================================
# Private Connect - Stop Script
# ============================================
# Usage:
#   ./scripts/stop.sh           # Stop all (dev processes + docker)
#   ./scripts/stop.sh dev       # Stop dev processes only
#   ./scripts/stop.sh docker    # Stop docker containers only
#   ./scripts/stop.sh all       # Stop everything
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
    echo "║         Private Connect - Stop             ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Stop development processes
stop_dev() {
    print_status "Stopping development processes..."

    # Kill processes by port (excludes PostgreSQL which is managed by Docker)
    local ports=(3000 3001 9000)
    local killed=0

    for port in "${ports[@]}"; do
        # Find PIDs listening on the port
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null || true
            print_success "Stopped process on port $port"
            killed=$((killed + 1))
        fi
    done

    # Kill by process name patterns
    local patterns=("nest start" "nuxt dev" "demo-server")
    for pattern in "${patterns[@]}"; do
        local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null || true
            killed=$((killed + 1))
        fi
    done

    # Remove demo server PID file if exists
    if [ -f ".demo-server.pid" ]; then
        local demo_pid=$(cat .demo-server.pid)
        kill -9 $demo_pid 2>/dev/null || true
        rm -f .demo-server.pid
    fi

    if [ $killed -eq 0 ]; then
        print_warning "No development processes were running"
    else
        print_success "Development processes stopped"
    fi
}

# Stop Docker containers
stop_docker() {
    print_status "Stopping Docker containers..."

    # Check if docker is available
    if ! command -v docker >/dev/null 2>&1; then
        print_warning "Docker is not installed, skipping..."
        return
    fi

    if ! docker info >/dev/null 2>&1; then
        print_warning "Docker daemon is not running, skipping..."
        return
    fi

    # Use 'docker compose' (v2) if available, otherwise fall back to docker-compose
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Check if there are any containers to stop
    if $COMPOSE_CMD ps -q 2>/dev/null | grep -q .; then
        $COMPOSE_CMD down
        print_success "Docker containers stopped"
    else
        print_warning "No Docker containers were running"
    fi
}

# Stop everything
stop_all() {
    print_header
    print_status "Stopping all services..."
    echo ""
    
    stop_dev
    echo ""
    stop_docker
    
    echo ""
    print_success "All services stopped!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [mode]"
    echo ""
    echo "Modes:"
    echo "  all      Stop everything (default)"
    echo "  dev      Stop dev processes only"
    echo "  docker   Stop docker containers only"
    echo ""
    echo "Examples:"
    echo "  $0           # Stop everything"
    echo "  $0 dev       # Stop dev processes"
    echo "  $0 docker    # Stop Docker containers"
}

# Main
MODE="${1:-all}"

case "$MODE" in
    all)
        stop_all
        ;;
    dev)
        print_header
        stop_dev
        ;;
    docker)
        print_header
        stop_docker
        ;;
    -h|--help|help)
        show_usage
        ;;
    *)
        print_error "Unknown mode: $MODE"
        show_usage
        exit 1
        ;;
esac

