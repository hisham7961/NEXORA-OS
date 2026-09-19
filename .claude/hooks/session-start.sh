#!/bin/bash
# NEXORA OS — SessionStart hook for Claude Code on the web.
# Brings the platform up on every session start/resume so the preview works:
#   Postgres (native) -> migrate -> seed-if-empty -> Next.js dev server on $APP_PORT.
# The remote container reclaims background processes when it idles, so this hook
# re-launches them on each resume. Idempotent: safe to run repeatedly.
set -uo pipefail

# Web/remote sessions only — do nothing on a local machine.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

LOG=/tmp/nexora-session-start.log
exec >>"$LOG" 2>&1
echo "=== NEXORA session-start $(date -u) (source=${1:-?}) ==="

PROJ="${CLAUDE_PROJECT_DIR:-/home/user/NEXORA-OS}"
cd "$PROJ" || exit 0

PGBIN=/usr/lib/postgresql/16/bin
PGDATA=/var/lib/postgresql/nexora-audit
PGPORT=5433
APP_PORT="${NEXORA_APP_PORT:-3000}"
export DATABASE_URL="postgresql://nexora@127.0.0.1:${PGPORT}/nexora?schema=public"
export NEXORA_SESSION_SECRET="${NEXORA_SESSION_SECRET:-nexora-web-preview-secret-0123456789abcdef}"
export NEXT_TELEMETRY_DISABLED=1

# Persist env for the interactive session too.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DATABASE_URL='${DATABASE_URL}'"
    echo "export NEXORA_SESSION_SECRET='${NEXORA_SESSION_SECRET}'"
    echo "export NEXORA_APP_PORT='${APP_PORT}'"
  } >> "$CLAUDE_ENV_FILE"
fi

# 1) Dependencies (cached in the container image after the hook completes).
npm install --no-audit --no-fund || true

# 2) PostgreSQL: init a data dir if missing, then start if not already listening.
mkdir -p /var/run/postgresql
chown -R postgres:postgres /var/run/postgresql 2>/dev/null || true
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "initdb (fresh data dir)"
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  runuser -u postgres -- "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null 2>&1 || true
fi
chown -R postgres:postgres "$PGDATA" 2>/dev/null || true
if ! runuser -u postgres -- psql -p "$PGPORT" -U postgres -d postgres -c 'select 1' >/dev/null 2>&1; then
  echo "starting postgres"
  runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGDATA" \
    -o "-p $PGPORT -k /var/run/postgresql -c listen_addresses=127.0.0.1" \
    -l "$PGDATA/startup.log" start >/dev/null 2>&1 || true
  sleep 4
fi

# Ensure the app role + database exist.
runuser -u postgres -- psql -p "$PGPORT" -U postgres -d postgres -tc \
  "SELECT 1 FROM pg_roles WHERE rolname='nexora'" 2>/dev/null | grep -q 1 || \
  runuser -u postgres -- psql -p "$PGPORT" -U postgres -d postgres -c \
  "CREATE ROLE nexora LOGIN SUPERUSER" >/dev/null 2>&1 || true
runuser -u postgres -- psql -p "$PGPORT" -U postgres -d postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='nexora'" 2>/dev/null | grep -q 1 || \
  runuser -u postgres -- psql -p "$PGPORT" -U postgres -d postgres -c \
  "CREATE DATABASE nexora OWNER nexora" >/dev/null 2>&1 || true

# 3) Prisma client + migrations.
npx prisma generate >/dev/null 2>&1 || true
npx prisma migrate deploy || true

# 4) Seed only when the database is empty (first run).
USERS=$(runuser -u postgres -- psql -p "$PGPORT" -U nexora -d nexora -At -c 'SELECT count(*) FROM "User"' 2>/dev/null || echo 0)
if [ "${USERS:-0}" = "0" ]; then
  echo "seeding (empty db)"
  npm run db:seed || true
fi

# 5) Start the Next.js dev server if it is not already answering.
if ! curl -sf "http://127.0.0.1:${APP_PORT}/api/v1/health/live" >/dev/null 2>&1; then
  echo "starting app on :${APP_PORT}"
  setsid bash -c "cd '$PROJ' && DATABASE_URL='${DATABASE_URL}' NEXORA_SESSION_SECRET='${NEXORA_SESSION_SECRET}' NEXT_TELEMETRY_DISABLED=1 exec npm run dev -- -p ${APP_PORT}" \
    >/tmp/nexora-app.log 2>&1 < /dev/null &
  disown 2>/dev/null || true
fi

echo "=== session-start finished $(date -u) ==="
exit 0
