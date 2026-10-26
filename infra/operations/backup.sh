#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR="${SNORLAXDEN_PROJECT_DIR:-/home/ubuntu/Project/snorlaxden/app}"
BACKUP_ROOT="${SNORLAXDEN_BACKUP_ROOT:-/home/ubuntu/Project/snorlaxden/backups}"
SECRET_FILE="${SNORLAXDEN_BACKUP_SECRET_FILE:-$PROJECT_DIR/.secrets/backup/backup.env}"
COMPOSE_FILE="$PROJECT_DIR/compose.production.yaml"
IMAGE="${SNORLAXDEN_ARCHIVE_IMAGE:-app-web:latest}"
RETENTION_DAYS="${SNORLAXDEN_BACKUP_RETENTION_DAYS:-14}"

fail() { echo "BACKUP_FAILED code=$1" >&2; exit 1; }
[[ "$BACKUP_ROOT" == /home/ubuntu/Project/snorlaxden/backups ]] || fail INVALID_BACKUP_ROOT
[[ -r "$SECRET_FILE" ]] || fail SECRET_FILE_MISSING
# shellcheck disable=SC1090
source "$SECRET_FILE"
[[ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]] || fail PASSPHRASE_MISSING
export BACKUP_ENCRYPTION_PASSPHRASE
for command in docker openssl sha256sum tar flock node; do command -v "$command" >/dev/null || fail "COMMAND_MISSING_${command}"; done

mkdir -p "$BACKUP_ROOT" "$BACKUP_ROOT/drills"
chmod 700 "$BACKUP_ROOT" "$BACKUP_ROOT/drills"
exec 9>"$BACKUP_ROOT/.backup.lock"
flock -n 9 || fail BACKUP_ALREADY_RUNNING

COMMIT="$(git -C "$PROJECT_DIR" rev-parse --short=12 HEAD)"
BATCH_ID="$(date -u +%Y%m%dT%H%M%SZ)-$COMMIT"
STAGING="$(mktemp -d "$BACKUP_ROOT/.staging-${BATCH_ID}.XXXXXX")"
FINAL="$BACKUP_ROOT/$BATCH_ID"
PLAIN_ARCHIVE="$BACKUP_ROOT/.${BATCH_ID}.tar"
cleanup() {
  rm -rf "$STAGING"
  rm -f "$PLAIN_ARCHIVE"
  if [[ -d "$FINAL" && ! -f "$FINAL/SUCCESS" ]]; then rm -rf "$FINAL"; fi
}
trap cleanup EXIT

cd "$PROJECT_DIR"
docker compose -f "$COMPOSE_FILE" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' > "$STAGING/database.dump"
docker compose -f "$COMPOSE_FILE" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "	" -c "select '\''users'\'',count(*) from users union all select '\''posts'\'',count(*) from posts union all select '\''projects'\'',count(*) from projects union all select '\''media'\'',count(*) from media union all select '\''source_materials'\'',count(*) from source_materials order by 1"' > "$STAGING/database-counts.tsv"

for volume in media_data content_data private_media_data; do
  docker run --rm --user 0 \
    -v "app_${volume}:/source:ro" -v "$STAGING:/backup" "$IMAGE" \
    tar -C /source -czf "/backup/${volume}.tar.gz" .
done
tar -C "$PROJECT_DIR/content/public-garden" -czf "$STAGING/public-garden.tar.gz" .
SNORLAXDEN_ENV_FILE="$PROJECT_DIR/.env" node "$PROJECT_DIR/infra/operations/cos-inventory.mjs" "$STAGING/cos-source-inventory.json"

printf 'batch_id=%s\ncommit=%s\ncreated_at=%s\n' "$BATCH_ID" "$COMMIT" "$(date -u +%FT%TZ)" > "$STAGING/batch.meta"
(cd "$STAGING" && sha256sum database.dump database-counts.tsv media_data.tar.gz content_data.tar.gz private_media_data.tar.gz public-garden.tar.gz cos-source-inventory.json batch.meta > plaintext.sha256)
tar -C "$STAGING" -cf "$PLAIN_ARCHIVE" .
mkdir "$FINAL"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "$PLAIN_ARCHIVE" -out "$FINAL/backup.tar.enc" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
ENCRYPTED_SHA="$(sha256sum "$FINAL/backup.tar.enc" | cut -d' ' -f1)"
OBJECT_COUNT="$(node -e "const d=require(process.argv[1]); console.log(d.objects.length)" "$STAGING/cos-source-inventory.json")"
DB_SIZE="$(stat -c %s "$STAGING/database.dump")"
ARCHIVE_SIZE="$(stat -c %s "$FINAL/backup.tar.enc")"
cat > "$FINAL/manifest.json" <<EOF
{"batchId":"$BATCH_ID","commit":"$COMMIT","createdAt":"$(date -u +%FT%TZ)","databaseBytes":$DB_SIZE,"encryptedBytes":$ARCHIVE_SIZE,"encryptedSha256":"$ENCRYPTED_SHA","cosSourceObjectCount":$OBJECT_COUNT,"encryption":"AES-256-CBC/PBKDF2-SHA256/200000","components":["postgres","media_data","content_data","private_media_data","public-garden","cos-source-inventory"]}
EOF
chmod 600 "$FINAL/backup.tar.enc" "$FINAL/manifest.json"

SNORLAXDEN_ENV_FILE="$PROJECT_DIR/.env" node "$PROJECT_DIR/infra/operations/cos-backup-upload.mjs" "$FINAL" "$BATCH_ID"
printf '%s\n' "$BATCH_ID" > "$FINAL/SUCCESS"
chmod 600 "$FINAL/SUCCESS"
ln -sfn "$BATCH_ID" "$BACKUP_ROOT/latest"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20????????T??????Z-*' -mtime "+$RETENTION_DAYS" -exec rm -rf -- {} +
echo "BACKUP_OK batch=$BATCH_ID encrypted_bytes=$ARCHIVE_SIZE cos_objects=$OBJECT_COUNT"
