set -Eeuo pipefail

BASE=/home/ubuntu/projects/cinecruzeiro
RELEASES="$BASE/releases"
SHARED="$BASE/shared"
COMMIT="$1"
STAMP="$(date -u +%Y%m%d%H%M%S)"
RELEASE="$RELEASES/${STAMP}-${COMMIT:0:7}"
PREVIOUS="$(readlink -f "$BASE/current" || true)"
SWITCHED=0

rollback() {
  code=$?
  if [ "$SWITCHED" = 1 ] && [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$BASE/current.next"
    mv -Tf "$BASE/current.next" "$BASE/current"
    pm2 reload "$BASE/ecosystem.config.cjs" --only cinecruzeiro-backend --update-env >/dev/null 2>&1 || true
    pm2 reload "$BASE/ecosystem.config.cjs" --only cinecruzeiro-frontend --update-env >/dev/null 2>&1 || true
  fi
  echo "DEPLOY_FAILED=$code"
  exit "$code"
}

trap rollback ERR
mkdir -p "$RELEASES"

git clone --quiet https://github.com/Alanls-mx/CineCruzeiro.git "$RELEASE"
git -C "$RELEASE" checkout --quiet --detach "$COMMIT"
test "$(git -C "$RELEASE" rev-parse HEAD)" = "$COMMIT"

cd "$RELEASE"
npm ci --silent

set -a
. "$SHARED/backend.runtime.env"
if [ -f "$SHARED/backend.env.local" ]; then
  . "$SHARED/backend.env.local"
fi
set +a

export NODE_ENV=production
export NEXT_PUBLIC_BASE_PATH=/projects/cinecruzeiro
export NEXT_BASE_PATH=/projects/cinecruzeiro
export CINE_BACKEND_URL=http://127.0.0.1:4100
export NEXT_PUBLIC_SITE_URL=https://lumixengine.com/projects/cinecruzeiro

npm run db:migrate
npm run build

ln -sfn "$RELEASE" "$BASE/current.next"
mv -Tf "$BASE/current.next" "$BASE/current"
SWITCHED=1

pm2 reload "$BASE/ecosystem.config.cjs" --only cinecruzeiro-backend --update-env
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:4100/api/health/ready >/dev/null && break
  sleep 1
done
curl -fsS http://127.0.0.1:4100/api/health/ready >/dev/null

pm2 reload "$BASE/ecosystem.config.cjs" --only cinecruzeiro-frontend --update-env
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3100/projects/cinecruzeiro/filmes >/dev/null && break
  sleep 1
done
curl -fsS http://127.0.0.1:3100/projects/cinecruzeiro/filmes >/dev/null

# O proxy TLS pode sobrescrever os headers enviados pelo frontend. Preserve o
# HSTS de um ano no vhost ativo e valide o Nginx antes de publicar a troca.
NGINX_SITE=/etc/nginx/sites-enabled/lumixengine
if [ -f "$NGINX_SITE" ] && ! sudo grep -Fq 'max-age=31536000; includeSubDomains' "$NGINX_SITE"; then
  sudo cp "$NGINX_SITE" "$NGINX_SITE.bak.codex-hsts"
  sudo sed -i '/add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;/a\    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;' "$NGINX_SITE"
fi
sudo nginx -t
sudo nginx -s reload

curl -fsS https://lumixengine.com/projects/cinecruzeiro/api/health/ready >/dev/null
curl -fsS https://lumixengine.com/projects/cinecruzeiro/filmes >/dev/null

find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
  | sort -r \
  | tail -n +3 \
  | while IFS= read -r old; do
      [ -n "$old" ] && rm -rf -- "$RELEASES/$old"
    done

trap - ERR
printf 'DEPLOY_OK=%s\n' "$(git -C "$BASE/current" rev-parse HEAD)"
printf 'CURRENT=%s\n' "$(readlink -f "$BASE/current")"
printf 'RELEASE_COUNT=%s\n' "$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | wc -l)"
