#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR="${SNORLAXDEN_PROJECT_DIR:-/home/ubuntu/Project/snorlaxden/app}"
BACKUP_ROOT="${SNORLAXDEN_BACKUP_ROOT:-/home/ubuntu/Project/snorlaxden/backups}"
SECRET_FILE="${SNORLAXDEN_BACKUP_SECRET_FILE:-$PROJECT_DIR/.secrets/backup/backup.env}"
if [[ -n "${1:-}" ]]; then
  BATCH_ID="$1"
else
  BATCH_ID="$(basename "$(readlink -f "$BACKUP_ROOT/latest")")"
fi
BATCH_DIR="$BACKUP_ROOT/$BATCH_ID"
POSTGRES_IMAGE="mirror.ccs.tencentyun.com/library/postgres:17-alpine@sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb"

fail() { echo "RESTORE_DRILL_FAILED code=$1" >&2; exit 1; }
[[ "$BACKUP_ROOT" == /home/ubuntu/Project/snorlaxden/backups ]] || fail INVALID_BACKUP_ROOT
[[ "$BATCH_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$ ]] || fail INVALID_BATCH
[[ -r "$BATCH_DIR/backup.tar.enc" && -r "$BATCH_DIR/manifest.json" && -f "$BATCH_DIR/SUCCESS" ]] || fail INCOMPLETE_BATCH
# shellcheck disable=SC1090
source "$SECRET_FILE"
[[ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]] || fail PASSPHRASE_MISSING

WORK="$(mktemp -d "$BACKUP_ROOT/.restore-${BATCH_ID}.XXXXXX")"
CONTAINER="snorlaxden-restore-${BATCH_ID//[^a-zA-Z0-9]/}-$$"
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

EXPECTED_SHA="$(node -e "console.log(require(process.argv[1]).encryptedSha256)" "$BATCH_DIR/manifest.json")"
[[ "$(sha256sum "$BATCH_DIR/backup.tar.enc" | cut -d' ' -f1)" == "$EXPECTED_SHA" ]] || fail ENCRYPTED_CHECKSUM_MISMATCH
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$BATCH_DIR/backup.tar.enc" -out "$WORK/backup.tar" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
mkdir "$WORK/data"
tar -C "$WORK/data" -xf "$WORK/backup.tar"
(cd "$WORK/data" && sha256sum -c plaintext.sha256 >/dev/null) || fail PLAINTEXT_CHECKSUM_MISMATCH

docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=restore-only -e POSTGRES_DB=restore "$POSTGRES_IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$CONTAINER" pg_isready -U postgres -d restore >/dev/null 2>&1 && break; sleep 1; done
docker exec "$CONTAINER" pg_isready -U postgres -d restore >/dev/null 2>&1 || fail ISOLATED_DATABASE_NOT_READY
docker exec -i "$CONTAINER" pg_restore -U postgres -d restore --no-owner --no-privileges < "$WORK/data/database.dump"
docker exec "$CONTAINER" psql -U postgres -d restore -At -F $'\t' -c "select 'users',count(*) from users union all select 'posts',count(*) from posts union all select 'projects',count(*) from projects union all select 'media',count(*) from media union all select 'source_materials',count(*) from source_materials order by 1" > "$WORK/restored-counts.tsv"
cmp "$WORK/data/database-counts.tsv" "$WORK/restored-counts.tsv" >/dev/null || fail DATABASE_COUNTS_MISMATCH

for archive in media_data content_data private_media_data public-garden; do
  mkdir "$WORK/$archive"
  tar -C "$WORK/$archive" -xzf "$WORK/data/$archive.tar.gz"
done
ADMIN_COUNT="$(awk -F $'\t' '$1=="users" {print $2}' "$WORK/restored-counts.tsv")"
[[ "${ADMIN_COUNT:-0}" -ge 1 ]] || fail ADMIN_USER_MISSING
REPORT="$BACKUP_ROOT/drills/${BATCH_ID}-$(date -u +%Y%m%dT%H%M%SZ).json"
printf '{"batchId":"%s","testedAt":"%s","result":"passed","adminCount":%s,"databaseCountsVerified":true,"archivesExtracted":true}\n' \
  "$BATCH_ID" "$(date -u +%FT%TZ)" "$ADMIN_COUNT" > "$REPORT"
chmod 600 "$REPORT"
echo "RESTORE_DRILL_OK batch=$BATCH_ID admin_count=$ADMIN_COUNT report=$REPORT"
