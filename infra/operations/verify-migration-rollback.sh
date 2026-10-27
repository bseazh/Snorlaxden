#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER="snorlaxden-migration-rollback-$$"
PORT="${MIGRATION_TEST_PORT:-55439}"
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PORT}/snorlaxden_migration_test"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --rm \
  --name "$CONTAINER" \
  --publish "127.0.0.1:${PORT}:5432" \
  --env POSTGRES_PASSWORD=postgres \
  --env POSTGRES_DB=snorlaxden_migration_test \
  postgres:17-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d snorlaxden_migration_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$CONTAINER" pg_isready -U postgres -d snorlaxden_migration_test >/dev/null 2>&1 || {
  echo "Isolated PostgreSQL did not become ready." >&2
  exit 1
}

cd "$ROOT_DIR"
export DATABASE_URL
export PAYLOAD_SECRET="migration-rollback-test-only-secret"
export NEXT_PUBLIC_SERVER_URL="http://127.0.0.1:3000"

pnpm payload migrate

MIGRATION_COUNT="$(docker exec "$CONTAINER" psql -U postgres -d snorlaxden_migration_test -Atc 'select count(*) from payload_migrations')"
pnpm payload migrate:down

MIGRATION_TABLE="$(docker exec "$CONTAINER" psql -U postgres -d snorlaxden_migration_test -Atc "select coalesce(to_regclass('public.payload_migrations')::text, '')")"
test -z "$MIGRATION_TABLE"

pnpm payload migrate

REAPPLIED="$(docker exec "$CONTAINER" psql -U postgres -d snorlaxden_migration_test -Atc 'select count(*) from payload_migrations')"
test "$REAPPLIED" = "$MIGRATION_COUNT"

echo "Verified ${MIGRATION_COUNT} migrations through isolated up -> down -> up."
