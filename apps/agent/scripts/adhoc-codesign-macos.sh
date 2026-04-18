#!/usr/bin/env bash
# Re-sign a Bun `bun build --compile` Mach-O binary. Bun's built-in code signature
# can be invalid (e.g. truncated), which makes macOS send SIGKILL before main runs.
# Run after a compile where BUN_NO_CODESIGN_MACHO_BINARY=1 was set.
set -euo pipefail
binary="${1:-}"
if [[ -z "$binary" ]]; then
  echo "Usage: $0 <path-to-binary>" >&2
  exit 1
fi
if [[ "$(uname -s)" != "Darwin" ]]; then
  exit 0
fi
codesign --force --sign - "$binary"
codesign --verify --strict "$binary"
