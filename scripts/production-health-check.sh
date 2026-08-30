#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${CINE_PUBLIC_URL:-https://lumixengine.com/projects/cinecruzeiro}"
DISK_PATH="${CINE_DISK_PATH:-/home/ubuntu/projects/cinecruzeiro}"
MAX_DISK_PERCENT="${MAX_DISK_PERCENT:-85}"
FAILURES=()

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

echo "HEALTH_OK"
