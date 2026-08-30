#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

require() {
  [ -n "${!1:-}" ] || { echo "Variavel obrigatoria ausente: $1" >&2; exit 2; }
}

require DATABASE_URL
require BACKUP_DESTINATION
require BACKUP_GPG_RECIPIENT
command -v pg_dump >/dev/null
command -v gpg >/dev/null
command -v sha256sum >/dev/null

BASE="${CINE_BASE:-/home/ubuntu/projects/cinecruzeiro}"
SHARED="$(readlink -f "${CINE_SHARED_DIR:-$BASE/shared}")"
DESTINATION="$(readlink -m "$BACKUP_DESTINATION")"
case "$SHARED" in "$BASE"/shared) ;; *) echo "Diretorio shared fora do projeto." >&2; exit 2 ;; esac
mkdir -p "$DESTINATION"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="cinecruzeiro-$STAMP"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/cine-backup.XXXXXX")"
cleanup() { rm -rf -- "$WORK"; }
trap cleanup EXIT

pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 --file="$WORK/database.dump"

mkdir -p "$WORK/shared"
[ ! -d "$SHARED/uploads" ] || tar -C "$SHARED" -czf "$WORK/shared/uploads.tar.gz" uploads
for file in backend.runtime.env backend.env.local; do
  [ ! -f "$SHARED/$file" ] || cp --preserve=mode,timestamps "$SHARED/$file" "$WORK/shared/$file"
done

cat > "$WORK/manifest.txt" <<EOF
created_at=$STAMP
hostname=$(hostname)
database_format=postgres_custom
uploads_included=$([ -f "$WORK/shared/uploads.tar.gz" ] && echo yes || echo no)
configuration_included=$([ -f "$WORK/shared/backend.runtime.env" ] && echo yes || echo no)
EOF
(cd "$WORK" && sha256sum database.dump shared/* >> manifest.txt 2>/dev/null || true)
tar -C "$WORK" -czf "$WORK/$NAME.tar.gz" database.dump shared manifest.txt
gpg --batch --yes --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" \
  --output "$DESTINATION/$NAME.tar.gz.gpg" --encrypt "$WORK/$NAME.tar.gz"
sha256sum "$DESTINATION/$NAME.tar.gz.gpg" > "$DESTINATION/$NAME.tar.gz.gpg.sha256"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-35}"
find "$DESTINATION" -maxdepth 1 -type f -name 'cinecruzeiro-*.tar.gz.gpg*' -mtime "+$RETENTION_DAYS" -delete
echo "BACKUP_OK=$DESTINATION/$NAME.tar.gz.gpg"
