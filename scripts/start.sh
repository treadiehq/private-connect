#!/bin/bash

# ============================================
# Private Connect - Start Script
# ============================================
# Usage:
#   ./scripts/start.sh          # Start in dev mode (default)
#   ./scripts/start.sh dev      # Start in dev mode
#   ./scripts/start.sh docker   # Start using docker-compose
#   ./scripts/start.sh all      # Start dev servers + demo server
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
    echo "║        Private Connect - Start             ║"
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

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect package manager based on lockfiles
detect_package_manager() {
    if [ -f "pnpm-lock.yaml" ] || [ -f "pnpm-workspace.yaml" ]; then
        echo "pnpm"
    elif [ -f "yarn.lock" ]; then
        echo "yarn"
    elif [ -f "package-lock.json" ]; then
        echo "npm"
    else
        echo "pnpm"  # default
    fi
}

PKG_MANAGER=""

# Ensure pnpm is available via corepack
ensure_pnpm() {
    if ! command_exists pnpm; then
        print_status "Enabling pnpm via corepack..."
        corepack enable pnpm 2>/dev/null || npm install -g pnpm
    fi
}

# Check prerequisites for dev mode
check_dev_prerequisites() {
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ first"
        exit 1
    fi

    PKG_MANAGER=$(detect_package_manager)
    
    # If pnpm is needed but not available, try to enable it
    if [ "$PKG_MANAGER" = "pnpm" ]; then
        ensure_pnpm
    fi
    
    if ! command_exists "$PKG_MANAGER"; then
        print_error "$PKG_MANAGER is not installed. Please install it first"
        exit 1
    fi
    
    print_status "Using package manager: $PKG_MANAGER"
}

# Check prerequisites for docker mode
check_docker_prerequisites() {
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first"
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first"
        exit 1
    fi

    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not installed or available"
        exit 1
    fi
}

# Disable corepack's packageManager enforcement from parent directories
export COREPACK_ENABLE_PROJECT_PACKAGE_MANAGER=0

# Run package manager command
pkg_run() {
    $PKG_MANAGER "$@"
}

# Run package manager script
pkg_exec() {
    if [ "$PKG_MANAGER" = "npm" ]; then
        npm run "$@"
    else
        $PKG_MANAGER "$@"
    fi
}

# Ensure PostgreSQL is running (via Docker)
ensure_postgres() {
    if ! command_exists docker; then
        print_warning "Docker not installed - assuming PostgreSQL is running externally"
        return
    fi

    if ! docker info >/dev/null 2>&1; then
        print_warning "Docker not running - assuming PostgreSQL is running externally"
        return
    fi

    # Use 'docker compose' (v2) if available
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Check if postgres container is running
    if ! $COMPOSE_CMD ps postgres 2>/dev/null | grep -q "running\|Up"; then
        print_status "Starting PostgreSQL..."
        $COMPOSE_CMD up -d postgres
        
        # Wait for PostgreSQL to be ready
        print_status "Waiting for PostgreSQL to be ready..."
        local retries=30
        while [ $retries -gt 0 ]; do
            if $COMPOSE_CMD exec -T postgres pg_isready -U privateconnect >/dev/null 2>&1; then
                print_success "PostgreSQL is ready"
                return
            fi
            retries=$((retries - 1))
            sleep 1
        done
        print_error "PostgreSQL failed to start"
        exit 1
    else
        print_success "PostgreSQL is already running"
    fi
}

# Start in development mode
start_dev() {
    print_header
    print_status "Starting in development mode..."
    
    check_dev_prerequisites

    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_status "Installing root dependencies..."
        pkg_run install
    fi

    if [ ! -d "apps/api/node_modules" ]; then
        print_status "Installing API dependencies..."
        (cd apps/api && pkg_run install)
    fi

    if [ ! -d "apps/web/node_modules" ]; then
        print_status "Installing Web dependencies..."
        (cd apps/web && pkg_run install)
    fi

    # Generate Prisma client if needed
    if [ ! -d "apps/api/node_modules/.prisma" ]; then
        print_status "Generating Prisma client..."
        (cd apps/api && pkg_exec db:generate)
    fi

    # Ensure PostgreSQL is running
    ensure_postgres

    # Push database schema
    print_status "Syncing database schema..."
    (cd apps/api && pkg_exec db:push)

    print_success "Starting API (port 3001) and Web (port 3000)..."
    echo ""
    echo -e "${CYAN}Services will be available at:${NC}"
    echo -e "  ${GREEN}•${NC} Web UI:  http://localhost:3000"
    echo -e "  ${GREEN}•${NC} API:     http://localhost:3001"
    echo ""

    # Start both services
    pkg_exec dev
}

# Start using Docker
start_docker() {
    print_header
    print_status "Starting with Docker Compose..."
    
    check_docker_prerequisites

    # Use 'docker compose' (v2) if available, otherwise fall back to docker-compose
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    print_status "Building and starting containers..."
    $COMPOSE_CMD up --build -d

    echo ""
    print_success "Docker containers started!"
    echo ""
    echo -e "${CYAN}Services will be available at:${NC}"
    echo -e "  ${GREEN}•${NC} Web UI:  http://localhost:3000"
    echo -e "  ${GREEN}•${NC} API:     http://localhost:3001"
    echo ""

    print_status "Container status:"
    $COMPOSE_CMD ps
}

# Start all (dev + demo server)
start_all() {
    print_header
    print_status "Starting all services (dev mode + demo server)..."
    
    check_dev_prerequisites

    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        pkg_run install
    fi

    # Generate Prisma client if needed
    if [ ! -d "apps/api/node_modules/.prisma" ]; then
        print_status "Generating Prisma client..."
        (cd apps/api && pkg_exec db:generate)
    fi

    # Ensure PostgreSQL is running
    ensure_postgres

    # Push database schema
    print_status "Syncing database schema..."
    (cd apps/api && pkg_exec db:push)

    echo ""
    echo -e "${CYAN}Starting services:${NC}"
    echo -e "  ${GREEN}•${NC} Web UI:      http://localhost:3000"
    echo -e "  ${GREEN}•${NC} API:         http://localhost:3001"
    echo -e "  ${GREEN}•${NC} Demo Server: http://localhost:9000"
    echo ""

    # Start demo server in background
    print_status "Starting demo server in background..."
    node scripts/demo-server.js &
    DEMO_PID=$!
    echo $DEMO_PID > .demo-server.pid

    # Trap to clean up demo server on exit
    trap 'kill $DEMO_PID 2>/dev/null; rm -f .demo-server.pid' EXIT

    # Start dev servers
    pkg_exec dev
}

# Show usage
show_usage() {
    echo "Usage: $0 [mode]"
    echo ""
    echo "Modes:"
    echo "  dev      Start in development mode (default)"
    echo "  docker   Start using Docker Compose"
    echo "  all      Start dev servers + demo server"
    echo ""
    echo "Examples:"
    echo "  $0           # Start dev mode"
    echo "  $0 dev       # Start dev mode"
    echo "  $0 docker    # Start with Docker"
    echo "  $0 all       # Start everything including demo"
}

# Main
MODE="${1:-dev}"

case "$MODE" in
    dev)
        start_dev
        ;;
    docker)
        start_docker
        ;;
    all)
        start_all
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

