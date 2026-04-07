#!/usr/bin/env bash
# One-time script: transition from `prisma db push` to `prisma migrate deploy`.
#
# `db push` applied schema DDL but never executed migration SQL files.
# This script marks schema-only migrations as applied (so they don't re-run),
# then runs `migrate deploy` to actually execute the remaining migrations
# (RLS policies, data backfills, etc.).
#
# Run ONCE before the first deploy that uses `prisma migrate deploy`:
#   DATABASE_URL="postgresql://..." bash scripts/baseline-migrations.sh
#
# After this, all future deploys use `prisma migrate deploy` via railway.toml.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL must be set"
  exit 1
fi

echo "=== Baselining migrations ==="
echo ""

# Migrations whose DDL was already fully applied by `db push`.
# These are safe to mark as applied without re-running.
ALREADY_APPLIED=(
  "20241230_add_agent_security_fields"
  "20260210_add_service_metadata"
  "20260224_add_client_type"
  "20260304_hash_api_keys"
  "20260309_add_device_allowlisting"
  "20260324_harden_grants"
  "20260326_add_service_groups"
)

for name in "${ALREADY_APPLIED[@]}"; do
  echo "  Marking as applied: $name"
  npx prisma migrate resolve --applied "$name" 2>&1 || echo "  (already recorded, skipping)"
done

echo ""
echo "=== Running pending migrations (RLS policies) ==="
echo ""

# These migrations were never executed and need to actually run:
#   20250202_add_row_level_security   (RLS for core tables)
#   20260324_add_rls_debug_packet     (RLS for DebugPacket, DebugAIMessage)
#   20260325_add_rls_grants           (RLS for Grant, GrantAccessLog)
#   20260325_add_resource_session     (CREATE TABLE + RLS)
npx prisma migrate deploy

echo ""
echo "Done. RLS is now active. Verify with:"
echo "  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"
