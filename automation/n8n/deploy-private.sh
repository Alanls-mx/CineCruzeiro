#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Crie automation/n8n/.env a partir de .env.example antes do deploy." >&2
  exit 1
fi

backup="$ROOT/backups/$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
docker compose config > "$backup/compose.resolved.yaml"
if docker compose ps --status running --quiet | grep -q .; then
  container="$(docker compose ps -q n8n)"
  if docker compose exec -T n8n sh -lc 'rm -rf /tmp/n8n-workflows && n8n export:workflow --backup --output=/tmp/n8n-workflows' >/dev/null 2>&1; then
    docker cp "$container:/tmp/n8n-workflows" "$backup/workflows" >/dev/null
  else
    printf '%s\n' 'Nenhum workflow existente para incluir no backup.' > "$backup/workflows.empty"
  fi
fi

docker compose pull
docker compose up -d --remove-orphans

for attempt in $(seq 1 60); do
  container="$(docker compose ps -q n8n)"
  status="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || true)"
  [[ "$status" == healthy ]] && break
  if [[ "$status" == unhealthy || "$attempt" == 60 ]]; then
    docker compose logs --tail=80 n8n >&2
    echo "O n8n não ficou saudável a tempo; os workflows não foram importados." >&2
    exit 1
  fi
  sleep 2
done

for workflow in workflows/*.json; do
  docker compose exec -T n8n n8n import:workflow --input="/workflows/$(basename "$workflow")"
done
docker compose ps
