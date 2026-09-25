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
  docker compose exec -T n8n sh -lc 'rm -rf /tmp/n8n-workflows && n8n export:workflow --backup --output=/tmp/n8n-workflows' >/dev/null
  docker cp "$container:/tmp/n8n-workflows" "$backup/workflows" >/dev/null
fi

docker compose pull
docker compose up -d --remove-orphans
for workflow in /workflows/*.json; do
  docker compose exec -T n8n n8n import:workflow --input="$workflow"
done
docker compose ps
