#!/usr/bin/env bash
set -euo pipefail

TARGET_COMMIT="58f47e8a639c410389994dade1ff769860d7f9e6"
COMMIT_SHORT="58f47e8"
RELEASE_TAG="$(date -u +%Y%m%d-%H%M)-$COMMIT_SHORT"
BASE_DIR="/home/ubuntu/projects/cinecruzeiro"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_TAG"
BACKUP_FILE="$BASE_DIR/backups/cinecruzeiro-$(date -u +%Y%m%dT%H%MZ)-pre-deploy-$COMMIT_SHORT.dump"

echo "=== [1/6] Starting deploy for commit $COMMIT_SHORT ($RELEASE_TAG) ==="

# 1. Database backup
echo "=== [2/6] Performing database backup ==="
export $(grep -v '^#' "$BASE_DIR/shared/backend.runtime.env" | xargs -d '\n')
pg_dump -d "$DATABASE_URL" -Fc -f "$BACKUP_FILE"
ls -lh "$BACKUP_FILE"

# 2. Clone repository & checkout target commit
echo "=== [3/6] Cloning repo to $RELEASE_DIR ==="
git clone --quiet https://github.com/Alanls-mx/CineCruzeiro.git "$RELEASE_DIR"
cd "$RELEASE_DIR"
git checkout "$TARGET_COMMIT"

# 3. Install dependencies & build
echo "=== [4/6] Installing dependencies and building ==="
npm ci --include=dev --silent
DATABASE_URL="$DATABASE_URL" npm run db:migrate
NEXT_PUBLIC_BASE_PATH=/projects/cinecruzeiro NEXT_BASE_PATH=/projects/cinecruzeiro NEXT_PUBLIC_SITE_URL=https://lumixengine.com/projects/cinecruzeiro npm run build

# 4. Atomically switch symlink
echo "=== [5/6] Atomically updating symlink ==="
ln -sfn "$RELEASE_DIR" "$BASE_DIR/current_tmp"
mv -Tf "$BASE_DIR/current_tmp" "$BASE_DIR/current"
echo "$RELEASE_TAG" > "$BASE_DIR/current-release"

# 5. Reload PM2
echo "=== [6/6] Reloading PM2 services ==="
pm2 reload "$BASE_DIR/ecosystem.config.cjs" --only cinecruzeiro-backend --update-env
pm2 reload "$BASE_DIR/ecosystem.config.cjs" --only cinecruzeiro-frontend --update-env

# 6. Cleanup old releases (keep 2 most recent)
echo "=== Cleaning up older releases (keeping 2 most recent) ==="
cd "$BASE_DIR/releases"
ls -dt */ | tail -n +3 | xargs -r rm -rf

echo "=== Deployment completed successfully ==="
