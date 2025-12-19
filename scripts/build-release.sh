#!/bin/bash
set -e

# Build release binaries for all platforms
# Requires: Bun installed (https://bun.sh)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENT_DIR="$PROJECT_ROOT/apps/agent"
OUTPUT_DIR="$PROJECT_ROOT/dist/release"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════╗"
echo "║     Private Connect Release Builder        ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for Bun
if ! command -v bun &> /dev/null; then
  echo -e "${RED}Error: Bun is required to build binaries${NC}"
  echo "Install it with: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

echo -e "Bun version: ${GREEN}$(bun --version)${NC}"

# Clean and create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

cd "$AGENT_DIR"

# Build for each platform
PLATFORMS=(
  "linux-x64:bun-linux-x64"
  "linux-arm64:bun-linux-arm64"
  "darwin-x64:bun-darwin-x64"
  "darwin-arm64:bun-darwin-arm64"
)

echo ""
echo "Building binaries..."
echo ""

for platform in "${PLATFORMS[@]}"; do
  NAME="${platform%%:*}"
  TARGET="${platform##*:}"
  OUTPUT_FILE="$OUTPUT_DIR/connect-$NAME"
  
  echo -n "  Building connect-$NAME... "
  
  if bun build src/cli.ts --compile --target="$TARGET" --outfile="$OUTPUT_FILE" 2>/dev/null; then
    SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "${GREEN}✓${NC} ($SIZE)"
  else
    echo -e "${RED}✗${NC}"
    echo -e "${YELLOW}    Note: Cross-compilation may require running on the target platform${NC}"
  fi
done

echo ""
echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Release binaries are in: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"

echo ""
echo -e "${CYAN}To create a GitHub release:${NC}"
echo "  1. Tag the release: git tag v0.1.0 && git push origin v0.1.0"
echo "  2. Create release on GitHub and upload binaries from dist/release/"
echo ""
echo "Or use GitHub CLI:"
echo "  gh release create v0.1.0 dist/release/* --title 'v0.1.0' --notes 'Release notes'"

