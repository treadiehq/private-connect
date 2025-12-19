#!/bin/bash

# ============================================
# Private Connect - Clean Script
# ============================================
# Removes node_modules and lockfiles to reset dependencies
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
    echo "║         Private Connect - Clean            ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_header

print_status "Removing node_modules directories..."
rm -rf node_modules
rm -rf apps/api/node_modules
rm -rf apps/web/node_modules
rm -rf apps/agent/node_modules
print_success "Removed node_modules"

print_status "Removing lockfiles..."
rm -f package-lock.json
rm -f apps/api/package-lock.json
rm -f apps/web/package-lock.json
rm -f apps/agent/package-lock.json
rm -f yarn.lock
rm -f apps/api/yarn.lock
rm -f apps/web/yarn.lock
rm -f apps/agent/yarn.lock
# Optionally remove pnpm-lock.yaml if having native binding issues
if [ "$1" = "--all" ]; then
    rm -f pnpm-lock.yaml
    print_status "Also removed pnpm-lock.yaml (use 'pnpm install' to regenerate)"
fi
print_success "Removed lockfiles"

print_status "Removing Nuxt cache..."
rm -rf apps/web/.nuxt
rm -rf apps/web/.output
print_success "Removed Nuxt cache"

print_status "Removing build outputs..."
rm -rf apps/api/dist
rm -rf apps/agent/dist
print_success "Removed build outputs"

echo ""
print_success "Clean complete! Run './scripts/start.sh' to reinstall and start."

