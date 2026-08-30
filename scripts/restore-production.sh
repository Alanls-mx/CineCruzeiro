#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

require() {
  [ -n "${!1:-}" ] || { echo "Variavel obrigatoria ausente: $1" >&2; exit 2; }
}

require BACKUP_FILE
require RESTORE_DATABASE_URL
[ "${RESTORE_CONFIRM:-}" = "RESTORE_TO_ISOLATED_TARGET" ] || {
  echo "Defina RESTORE_CONFIRM=RESTORE_TO_ISOLATED_TARGET." >&2
  exit 2
}
[ -f "$BACKUP_FILE" ] || { echo "Backup nao encontrado." >&2; exit 2; }
if [ -n "${DATABASE_URL:-}" ] && [ "$RESTORE_DATABASE_URL" = "$DATABASE_URL" ] && [ "${ALLOW_PRODUCTION_RESTORE:-}" != "YES_I_UNDERSTAND" ]; then
  echo "Restauracao no banco de producao bloqueada. Use um banco isolado." >&2
  exit 2
fi
command -v gpg >/dev/null
command -v pg_restore >/dev/null

WORK="$(mktemp -d "${TMPDIR:-/tmp}/cine-restore.XXXXXX")"
cleanup() { rm -rf -- "$WORK"; }
trap cleanup EXIT

gpg --batch --output "$WORK/backup.tar.gz" --decrypt "$BACKUP_FILE"
tar -C "$WORK" -xzf "$WORK/backup.tar.gz"
(cd "$WORK" && sha256sum --check manifest.txt)
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$WORK/database.dump"

if [ -n "${RESTORE_UPLOADS_DIR:-}" ] && [ -f "$WORK/shared/uploads.tar.gz" ]; then
  TARGET="$(readlink -m "$RESTORE_UPLOADS_DIR")"
  [ ! -e "$TARGET" ] || { echo "Destino de uploads deve estar vazio/inexistente." >&2; exit 2; }
  mkdir -p "$TARGET"
  tar -C "$TARGET" --strip-components=1 -xzf "$WORK/shared/uploads.tar.gz"
fi

echo "RESTORE_OK=Banco e arquivos restaurados em destinos isolados. Execute migrations e smoke tests antes de qualquer promocao."
