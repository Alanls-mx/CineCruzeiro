#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/home/ubuntu/projects/cinecruzeiro"
RELEASE_TAG_BASE="$(date -u +%Y%m%d-%H%M)"
TMP_CLONE_DIR="$BASE_DIR/releases/tmp-clone-$$"

# 1. Database backup
echo "=== [1/6] Performing database backup ==="
export $(grep -v '^#' "$BASE_DIR/shared/backend.runtime.env" | xargs -d '\n')
BACKUP_FILE="$BASE_DIR/backups/cinecruzeiro-$(date -u +%Y%m%dT%H%MZ)-pre-deploy.dump"
pg_dump -d "$DATABASE_URL" -Fc -f "$BACKUP_FILE"
ls -lh "$BACKUP_FILE"

# 2. Clone repository & determine commit
echo "=== [2/6] Cloning repo ==="
git clone --quiet https://github.com/Alanls-mx/CineCruzeiro.git "$TMP_CLONE_DIR"
TARGET_COMMIT="${1:-$(git -C "$TMP_CLONE_DIR" rev-parse HEAD)}"
COMMIT_SHORT="${TARGET_COMMIT:0:7}"
RELEASE_TAG="${RELEASE_TAG_BASE}-${COMMIT_SHORT}"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_TAG"
rm -rf "$RELEASE_DIR"
mv "$TMP_CLONE_DIR" "$RELEASE_DIR"
cd "$RELEASE_DIR"
git checkout "$TARGET_COMMIT"

echo "=== [3/6] Deploying commit $COMMIT_SHORT ($RELEASE_TAG) ==="

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
