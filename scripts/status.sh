#!/bin/bash

# ============================================
# Private Connect - Status Script
# ============================================
# Shows the status of all services
# ============================================

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
    echo "║        Private Connect - Status            ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if a port is in use
check_port() {
    local port=$1
    local name=$2
    
    if lsof -i :$port >/dev/null 2>&1; then
        local pid=$(lsof -ti :$port 2>/dev/null | head -1)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        echo -e "  ${GREEN}●${NC} $name (port $port): ${GREEN}Running${NC} [PID: $pid, Process: $process]"
        return 0
    else
        echo -e "  ${RED}○${NC} $name (port $port): ${RED}Stopped${NC}"
        return 1
    fi
}

# Check Docker containers
check_docker() {
    echo ""
    echo -e "${BLUE}Docker Containers:${NC}"
    
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠${NC} Docker is not installed"
        return
    fi

    if ! docker info >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠${NC} Docker daemon is not running"
        return
    fi

    # Use 'docker compose' (v2) if available
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    local containers=$($COMPOSE_CMD ps -q 2>/dev/null)
    
    if [ -z "$containers" ]; then
        echo -e "  ${YELLOW}○${NC} No containers running from docker-compose"
    else
        $COMPOSE_CMD ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || $COMPOSE_CMD ps
    fi
}

# Main
print_header

echo -e "${BLUE}Development Services:${NC}"
check_port 3000 "Web UI (Nuxt)"
check_port 3001 "API (NestJS)"
check_port 9000 "Demo Server"

check_docker

echo ""
echo -e "${BLUE}Quick Commands:${NC}"
echo "  Start:   ./scripts/start.sh [dev|docker|all]"
echo "  Stop:    ./scripts/stop.sh [dev|docker|all]"
echo "  Restart: ./scripts/restart.sh [dev|docker|all]"
echo ""

