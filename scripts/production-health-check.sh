#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${CINE_PUBLIC_URL:-https://lumixengine.com/projects/cinecruzeiro}"
DISK_PATH="${CINE_DISK_PATH:-/home/ubuntu/projects/cinecruzeiro}"
MAX_DISK_PERCENT="${MAX_DISK_PERCENT:-85}"
FAILURES=()
WARNINGS=()

check_url() {
  curl --fail --silent --show-error --max-time 12 "$1" >/dev/null || FAILURES+=("HTTP indisponivel: $1")
}

check_url "$BASE_URL/api/health/live"
check_url "$BASE_URL/api/health/ready"
check_url "$BASE_URL/filmes"

if command -v pm2 >/dev/null; then
  PM2_JSON="$(pm2 jlist 2>/dev/null || echo '[]')"
  PM2_JSON="$PM2_JSON" node - <<'NODE' || FAILURES+=("PM2 com processo offline ou reinicios excessivos")
const apps = JSON.parse(process.env.PM2_JSON || "[]");
const required = new Set(["cinecruzeiro-backend", "cinecruzeiro-frontend"]);
for (const app of apps) {
  if (!required.has(app.name)) continue;
  if (app.pm2_env?.status !== "online" || Number(app.pm2_env?.unstable_restarts || 0) > 3) process.exit(1);
  required.delete(app.name);
}
if (required.size) process.exit(1);
NODE
fi

DISK_PERCENT="$(df -P "$DISK_PATH" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
[ "${DISK_PERCENT:-100}" -lt "$MAX_DISK_PERCENT" ] || FAILURES+=("Disco em ${DISK_PERCENT}%")

BACKUP_DIR="${CINE_BACKUP_DIR:-${BACKUP_DESTINATION:-}}"
if [ -n "$BACKUP_DIR" ]; then
  BACKUP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cinecruzeiro-*.tar.gz.gpg' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d ' ' -f2-)"
  if [ -z "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
    FAILURES+=("Backup criptografado ausente")
  else
    SUCCESS_MARKER="$BACKUP_DIR/.last-success"
    MARKED_FILE="$(sed -n 's/^file=//p' "$SUCCESS_MARKER" 2>/dev/null | head -n 1)"
    if [ ! -s "$SUCCESS_MARKER" ] || [ "$MARKED_FILE" != "$(basename "$BACKUP_FILE")" ]; then
      FAILURES+=("Marcador do ultimo backup bem-sucedido ausente ou inconsistente")
    fi
    BACKUP_EPOCH="$(stat -c %Y "$BACKUP_FILE")"
    BACKUP_AGE_HOURS="$(( ($(date +%s) - BACKUP_EPOCH) / 3600 ))"
    BACKUP_SIZE="$(stat -c %s "$BACKUP_FILE")"
    if [ "$BACKUP_AGE_HOURS" -gt "${BACKUP_CRITICAL_HOURS:-12}" ]; then
      FAILURES+=("Backup atrasado: ${BACKUP_AGE_HOURS}h, ${BACKUP_SIZE} bytes")
    elif [ "$BACKUP_AGE_HOURS" -gt "${BACKUP_WARNING_HOURS:-8}" ]; then
      WARNINGS+=("Backup perto do limite: ${BACKUP_AGE_HOURS}h, ${BACKUP_SIZE} bytes")
    fi
    CHECKSUM_FILE="$BACKUP_FILE.sha256"
    if [ ! -s "$CHECKSUM_FILE" ] || ! (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "$CHECKSUM_FILE")" >/dev/null 2>&1); then
      FAILURES+=("Checksum do backup mais recente invalido ou ausente")
    fi
  fi
else
  WARNINGS+=("Monitor de backup sem CINE_BACKUP_DIR configurado")
fi

if [ "${#FAILURES[@]}" -gt 0 ]; then
  MESSAGE="Cine Cruzeiro: ${FAILURES[*]}"
  echo "$MESSAGE" >&2
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    SAFE_MESSAGE="$(printf '%s' "$MESSAGE" | sed 's/["\\]/ /g')"
    curl --silent --show-error --max-time 10 -H 'Content-Type: application/json' \
      --data "{\"text\":\"$SAFE_MESSAGE\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
  fi
  exit 1
fi

if [ "${#WARNINGS[@]}" -gt 0 ]; then
  WARNING_MESSAGE="Cine Cruzeiro: ${WARNINGS[*]}"
  echo "HEALTH_WARNING: ${WARNINGS[*]}" >&2
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    SAFE_WARNING="$(printf '%s' "$WARNING_MESSAGE" | sed 's/["\\]/ /g')"
    curl --silent --show-error --max-time 10 -H 'Content-Type: application/json' \
      --data "{\"text\":\"$SAFE_WARNING\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
  fi
fi
echo "HEALTH_OK"
