#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin" "$WORK/backups" "$WORK/disk"

cat > "$WORK/bin/curl" <<'EOF'
#!/usr/bin/env bash
[ "${MOCK_HTTP_OFFLINE:-false}" != "true" ]
EOF
cat > "$WORK/bin/pm2" <<'EOF'
#!/usr/bin/env bash
status="${MOCK_PM2_STATUS:-online}"
restarts="${MOCK_PM2_RESTARTS:-0}"
printf '[{"name":"cinecruzeiro-backend","pm2_env":{"status":"%s","unstable_restarts":%s}},{"name":"cinecruzeiro-frontend","pm2_env":{"status":"online","unstable_restarts":0}}]\n' "$status" "$restarts"
EOF
cat > "$WORK/bin/df" <<'EOF'
#!/usr/bin/env bash
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\nmock 100 10 90 %s%% /\n' "${MOCK_DISK_PERCENT:-10}"
EOF
chmod +x "$WORK/bin/"*

BACKUP="$WORK/backups/cinecruzeiro-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.gpg"
printf 'encrypted-test-payload' > "$BACKUP"
(cd "$WORK/backups" && sha256sum "$(basename "$BACKUP")" > "$(basename "$BACKUP").sha256")
cat > "$WORK/backups/.last-success" <<EOF
created_at=$(date -u +%Y%m%dT%H%M%SZ)
file=$(basename "$BACKUP")
size=$(stat -c %s "$BACKUP")
sha256=$(cut -d ' ' -f1 "$BACKUP.sha256")
EOF

run_health() {
  PATH="$WORK/bin:$PATH" CINE_BACKUP_DIR="$WORK/backups" CINE_DISK_PATH="$WORK/disk" \
    bash "$ROOT/scripts/production-health-check.sh" 2>&1
}

run_health | grep -q 'HEALTH_OK'
if MOCK_HTTP_OFFLINE=true run_health >/dev/null; then exit 1; fi
if MOCK_PM2_STATUS=stopped run_health >/dev/null; then exit 1; fi
if MOCK_PM2_RESTARTS=4 run_health >/dev/null; then exit 1; fi
if MOCK_DISK_PERCENT=90 run_health >/dev/null; then exit 1; fi

touch -d '10 hours ago' "$BACKUP"
run_health | grep -q 'HEALTH_WARNING'
touch -d '13 hours ago' "$BACKUP"
if run_health >/dev/null; then exit 1; fi

echo "PRODUCTION_HEALTH_TESTS_OK"
