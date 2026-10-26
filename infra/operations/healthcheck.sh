#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR="${SNORLAXDEN_PROJECT_DIR:-/home/ubuntu/Project/snorlaxden/app}"
BACKUP_ROOT="${SNORLAXDEN_BACKUP_ROOT:-/home/ubuntu/Project/snorlaxden/backups}"
STATE_ROOT="${SNORLAXDEN_OPS_STATE_ROOT:-/home/ubuntu/Project/snorlaxden/ops-state}"
MAX_BACKUP_AGE_HOURS="${SNORLAXDEN_MAX_BACKUP_AGE_HOURS:-26}"
MIN_FREE_PERCENT="${SNORLAXDEN_MIN_FREE_PERCENT:-20}"
CERT_MIN_DAYS="${SNORLAXDEN_CERT_MIN_DAYS:-21}"
errors=()

check() { local label="$1"; shift; "$@" >/dev/null 2>&1 || errors+=("$label"); }
mkdir -p "$STATE_ROOT"
chmod 700 "$STATE_ROOT"
check WEB curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3999/
DB_HEALTH="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' app-db-1 2>/dev/null || true)"
[[ "$DB_HEALTH" == healthy ]] || errors+=(DB)
RESTARTS="$(docker inspect -f '{{.RestartCount}}' app-web-1 2>/dev/null || echo -1)"
[[ "$RESTARTS" == 0 ]] || errors+=(WEB_RESTARTS)
FREE_PERCENT="$(df -P / | awk 'NR==2 {gsub("%","",$5); print 100-$5}')"
[[ "$FREE_PERCENT" -ge "$MIN_FREE_PERCENT" ]] || errors+=(DISK)
CERT_END="$(echo | openssl s_client -connect blog.snorlaxden.fun:443 -servername blog.snorlaxden.fun 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
CERT_EPOCH="$(date -d "$CERT_END" +%s 2>/dev/null || echo 0)"
CERT_DAYS="$(( (CERT_EPOCH - $(date +%s)) / 86400 ))"
[[ "$CERT_DAYS" -ge "$CERT_MIN_DAYS" ]] || errors+=(TLS_CERT)
LATEST_SUCCESS="$(readlink -f "$BACKUP_ROOT/latest/SUCCESS" 2>/dev/null || true)"
if [[ -z "$LATEST_SUCCESS" || ! -f "$LATEST_SUCCESS" ]]; then
  errors+=(BACKUP_MISSING)
else
  BACKUP_AGE="$(( ($(date +%s) - $(stat -c %Y "$LATEST_SUCCESS")) / 3600 ))"
  [[ "$BACKUP_AGE" -le "$MAX_BACKUP_AGE_HOURS" ]] || errors+=(BACKUP_STALE)
fi
SNORLAXDEN_ENV_FILE="$PROJECT_DIR/.env" node "$PROJECT_DIR/infra/operations/cos-health.mjs" >/dev/null 2>&1 || errors+=(COS)

status=ok
[[ ${#errors[@]} -eq 0 ]] || status=failed
tmp="$STATE_ROOT/.health.json.tmp"
printf '{"checkedAt":"%s","status":"%s","errors":"%s","db":"%s","webRestarts":%s,"freeDiskPercent":%s,"certificateDays":%s}\n' \
  "$(date -u +%FT%TZ)" "$status" "$(IFS=,; echo "${errors[*]}")" "$DB_HEALTH" "$RESTARTS" "$FREE_PERCENT" "$CERT_DAYS" > "$tmp"
mv "$tmp" "$STATE_ROOT/health.json"
if [[ "$status" != ok ]]; then echo "HEALTHCHECK_FAILED checks=$(IFS=,; echo "${errors[*]}")" >&2; exit 1; fi
echo "HEALTHCHECK_OK free_disk_percent=$FREE_PERCENT certificate_days=$CERT_DAYS"
