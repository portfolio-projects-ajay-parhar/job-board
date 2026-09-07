#!/usr/bin/env bash
# End-to-end smoke test (Phase 12) — see scripts/smoke.mjs for the flow.
# Prereqs: dev server on :3000 + seeded DB. Also checks EmailLog rows (local docker DB).
set -euo pipefail

npm run db:seed >/dev/null 2>&1 || true
node scripts/smoke.mjs

# EmailLog check (steps: confirmation + received + status-changed, SKIPPED ok)
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q '^${DB_CONTAINER:-jobboard-db}$'; then
  echo "--- EmailLog (most recent 3):"
  docker exec "${DB_CONTAINER:-jobboard-db}" psql -U postgres -d jobboard \
    -c 'SELECT "to", template, status FROM "EmailLog" ORDER BY "createdAt" DESC LIMIT 3'
fi
