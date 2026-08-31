#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL obrigatoria}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL obrigatoria}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export GNUPGHOME="$WORK/gnupg"
mkdir -p "$GNUPGHOME" "$WORK/project/shared/uploads" "$WORK/backups"
chmod 700 "$GNUPGHOME"
printf 'upload-restoration-evidence\n' > "$WORK/project/shared/uploads/evidence.txt"
printf 'TEST_ONLY_SETTING=preserved-inside-encrypted-package\n' > "$WORK/project/shared/backend.runtime.env"

gpg --batch --passphrase '' --quick-generate-key 'Cine Backup Integration <backup-test@cine.local>' rsa2048 encrypt 1d >/dev/null 2>&1
RECIPIENT='backup-test@cine.local'
START_EPOCH="$(date +%s)"
BACKUP_OUTPUT="$(
  DATABASE_URL="$SOURCE_DATABASE_URL" \
  BACKUP_DESTINATION="$WORK/backups" \
  BACKUP_GPG_RECIPIENT="$RECIPIENT" \
  CINE_BASE="$WORK/project" \
  bash "$ROOT/scripts/backup-production.sh"
)"
BACKUP_FILE="${BACKUP_OUTPUT##*BACKUP_OK=}"
[ -s "$BACKUP_FILE" ]
[ -s "$BACKUP_FILE.sha256" ]
[ -s "$WORK/backups/.last-success" ]
! find "$WORK/backups" -maxdepth 1 -type f -name '*.tar.gz' | grep -q .
(cd "$WORK/backups" && sha256sum --check "$(basename "$BACKUP_FILE").sha256" >/dev/null)

RESTORE_UPLOADS="$WORK/restored-uploads"
BACKUP_FILE="$BACKUP_FILE" \
RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" \
RESTORE_UPLOADS_DIR="$RESTORE_UPLOADS" \
RESTORE_CONFIRM=RESTORE_TO_ISOLATED_TARGET \
bash "$ROOT/scripts/restore-production.sh" >/dev/null

[ "$(cat "$RESTORE_UPLOADS/evidence.txt")" = "upload-restoration-evidence" ]
SOURCE_ORDERS="$(psql "$SOURCE_DATABASE_URL" -Atc 'SELECT count(*) FROM orders')"
RESTORED_ORDERS="$(psql "$RESTORE_DATABASE_URL" -Atc 'SELECT count(*) FROM orders')"
SOURCE_TICKETS="$(psql "$SOURCE_DATABASE_URL" -Atc 'SELECT count(*) FROM tickets')"
RESTORED_TICKETS="$(psql "$RESTORE_DATABASE_URL" -Atc 'SELECT count(*) FROM tickets')"
SOURCE_USERS="$(psql "$SOURCE_DATABASE_URL" -Atc 'SELECT count(*) FROM users')"
RESTORED_USERS="$(psql "$RESTORE_DATABASE_URL" -Atc 'SELECT count(*) FROM users')"
[ "$SOURCE_ORDERS" = "$RESTORED_ORDERS" ]
[ "$SOURCE_TICKETS" = "$RESTORED_TICKETS" ]
[ "$SOURCE_USERS" = "$RESTORED_USERS" ]

DATABASE_URL="$RESTORE_DATABASE_URL" node "$ROOT/scripts/db-migrate.js" >/dev/null
END_EPOCH="$(date +%s)"
CHECKSUM="$(cut -d ' ' -f1 "$BACKUP_FILE.sha256")"
printf 'BACKUP_RESTORE_TEST_OK checksum=%s duration_seconds=%s orders=%s tickets=%s users=%s uploads=1\n' \
  "$CHECKSUM" "$((END_EPOCH - START_EPOCH))" "$RESTORED_ORDERS" "$RESTORED_TICKETS" "$RESTORED_USERS"
