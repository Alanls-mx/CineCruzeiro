# Runbook de deploy - Cine Cruzeiro

Este documento registra o procedimento usado para publicar o Cine Cruzeiro no GitHub e, depois, promover o mesmo commit para a VPS. Ele descreve os caminhos, processos, dados persistentes, comandos executados, verificacoes, rollback e limpeza de releases.

> Nunca coloque neste arquivo o conteudo de chaves SSH, `DATABASE_URL`, tokens, senhas, secrets ou credenciais das integracoes.

## 1. Regra principal

O deploy segue obrigatoriamente esta ordem:

1. alterar e testar o projeto localmente;
2. criar um commit Git;
3. enviar o commit para `origin/main` no GitHub;
4. obter o hash completo do commit publicado;
5. a VPS clona o repositorio do GitHub em uma nova release;
6. a VPS faz checkout do hash exato;
7. a VPS instala, migra, compila, troca a release e reinicia os processos;
8. somente depois dos health checks as releases antigas sao excluidas.

Nao e usado `scp`, `rsync` ou envio direto dos arquivos locais para a aplicacao em producao. A VPS recebe o codigo pelo GitHub.

## 2. Destinos e identificadores

| Item | Valor atual |
| --- | --- |
| Repositorio | `https://github.com/Alanls-mx/CineCruzeiro.git` |
| Branch de producao | `main` |
| Usuario e VPS | `ubuntu@54.233.8.193` |
| Chave usada na maquina local | `C:\Users\alanl\Downloads\chaves\LumixEngineVPS.pem` |
| Diretorio base | `/home/ubuntu/projects/cinecruzeiro` |
| URL publica | `https://lumixengine.com/projects/cinecruzeiro` |
| Backend local na VPS | `http://127.0.0.1:4100` |
| Frontend local na VPS | `http://127.0.0.1:3100/projects/cinecruzeiro` |
| Processo PM2 do backend | `cinecruzeiro-backend` |
| Processo PM2 do frontend | `cinecruzeiro-frontend` |

A chave privada deve continuar fora do repositorio. Somente o caminho local aparece neste runbook.

## 3. Estrutura da VPS

```text
/home/ubuntu/projects/cinecruzeiro/
|-- current -> releases/<AAAAMMDDHHMMSS>-<commit-curto>
|-- releases/
|   |-- <release-atual>/
|   `-- <release-anterior>/
|-- shared/
|   |-- backend.runtime.env
|   |-- backend.env.local
|   |-- uploads/
|   `-- data/
|-- ecosystem.config.cjs
`-- current-release.txt
```

### Fonte de verdade da release ativa

A fonte de verdade e:

```bash
readlink -f /home/ubuntu/projects/cinecruzeiro/current
```

O arquivo `current-release.txt` e legado e pode estar desatualizado. Ele nao e lido pelo PM2 nem pelo script atual de deploy. Nao use esse arquivo para decidir qual release esta em producao.

## 4. Dados persistentes

Os itens abaixo ficam fora de `releases/` e nao sao apagados na limpeza normal:

### 4.1 PostgreSQL

O backend usa:

```text
DATA_STORE=postgres
DATABASE_URL=<segredo armazenado em backend.runtime.env>
```

Pedidos, clientes, filmes, sessoes, ingressos, pagamentos, assinaturas, configuracoes, integracoes, logs e demais registros persistidos pelo sistema ficam no PostgreSQL indicado por `DATABASE_URL`.

O deploy executa migrations, mas nao executa seed e nao importa o JSON local.

### 4.2 Uploads

Arquivos enviados pelo painel ficam no diretorio persistente:

```text
/home/ubuntu/projects/cinecruzeiro/shared/uploads
```

O backend recebe esse caminho por:

```text
CINE_UPLOADS_DIR=/home/ubuntu/projects/cinecruzeiro/shared/uploads
```

Por isso, imagens e outros uploads nao dependem da pasta da release e permanecem depois da troca de `current`.

### 4.3 Arquivos de ambiente

Os arquivos abaixo sao persistentes e nao pertencem ao Git:

```text
/home/ubuntu/projects/cinecruzeiro/shared/backend.runtime.env
/home/ubuntu/projects/cinecruzeiro/shared/backend.env.local
```

Chaves existentes em `backend.runtime.env`:

```text
BIND_HOST
CINE_PUBLIC_BACKEND_URL
CINE_UPLOADS_DIR
CORS_ORIGIN
DATABASE_URL
DATA_STORE
FRONTEND_URL
INTEGRATION_SECRET_KEY
JWT_SECRET
NEXT_PUBLIC_SITE_URL
NODE_ENV
PORT
TWO_FACTOR_SECRET_KEY
```

Chaves existentes em `backend.env.local`:

```text
TMDB_API_KEY
TMDB_BEARER_TOKEN
```

O `ecosystem.config.cjs` le os dois arquivos. Se a mesma chave existir nos dois, `backend.env.local` tem precedencia porque e carregado por ultimo.

Valores operacionais nao secretos atuais:

```text
NODE_ENV=production
PORT=4100
BIND_HOST=127.0.0.1
DATA_STORE=postgres
CINE_UPLOADS_DIR=/home/ubuntu/projects/cinecruzeiro/shared/uploads
FRONTEND_URL=https://lumixengine.com/projects/cinecruzeiro
NEXT_PUBLIC_SITE_URL=https://lumixengine.com/projects/cinecruzeiro
CINE_PUBLIC_BACKEND_URL=https://lumixengine.com/projects/cinecruzeiro
CORS_ORIGIN=https://lumixengine.com
```

### 4.4 Infraestrutura persistente

Tambem nao sao substituidos ou apagados no deploy normal:

- `/home/ubuntu/projects/cinecruzeiro/ecosystem.config.cjs`;
- configuracao do Nginx;
- certificados TLS;
- configuracao e historico do PM2;
- banco PostgreSQL e seus backups externos;
- arquivos em `shared/`.

## 5. Processos em producao

O arquivo persistente `ecosystem.config.cjs` aponta os dois processos para o symlink `current`.

### Backend

```text
cwd: /home/ubuntu/projects/cinecruzeiro/current
script: backend/server.js
host: 127.0.0.1
porta: 4100
env: shared/backend.runtime.env + shared/backend.env.local
```

### Frontend

```text
cwd: /home/ubuntu/projects/cinecruzeiro/current
script: npm
args: start -- -H 127.0.0.1
host: 127.0.0.1
porta: 3100
base path: /projects/cinecruzeiro
backend interno: http://127.0.0.1:4100
```

Versoes observadas na VPS quando este documento foi criado:

```text
Node.js v22.23.2
npm 10.9.8
PM2 7.0.3
```

## 6. Roteamento Nginx

O deploy da aplicacao nao altera o Nginx. A configuracao existente encaminha:

| Caminho publico | Destino |
| --- | --- |
| `/projects/cinecruzeiro/api/*` | backend `127.0.0.1:4100`, removendo o prefixo antes de `/api/*` |
| `/projects/cinecruzeiro/admin` e `/admin/*` | backend `127.0.0.1:4100` |
| `/projects/cinecruzeiro/uploads/*` | backend `127.0.0.1:4100` |
| `/projects/cinecruzeiro/images/*` | backend `127.0.0.1:4100` |
| `/projects/cinecruzeiro/trailers/*` | backend `127.0.0.1:4100` |
| demais caminhos em `/projects/cinecruzeiro/*` | frontend `127.0.0.1:3100` |

No caminho do admin, o Nginx permite camera somente para a propria origem com `Permissions-Policy: camera=(self)`.

## 7. Preparacao local

Na raiz local do projeto:

```powershell
Set-Location -LiteralPath 'C:\Users\alanl\Downloads\Cine Cruzeiro'
npm test
npm run lint
npm run build
git diff --check
git status --short
```

O resultado esperado e:

- testes sem falha;
- TypeScript sem erro;
- build Next.js concluido;
- nenhum erro de whitespace;
- somente os arquivos esperados modificados.

O build local pode modificar automaticamente `next-env.d.ts`. Antes do commit, confirme que ele continua apontando para:

```ts
import "./.next/types/routes.d.ts";
import "./.next/types/root-params.d.ts";
```

## 8. Publicacao no GitHub

```powershell
git add -- <arquivos-alterados>
git diff --cached --check
git diff --cached --stat
git commit -m "descricao objetiva da alteracao"
git push origin main
$Commit = git rev-parse HEAD
```

O hash completo retornado em `$Commit` e o unico commit que pode ser promovido. A VPS confirma depois do clone:

```bash
test "$(git -C "$RELEASE" rev-parse HEAD)" = "$COMMIT"
```

## 9. Script executado na VPS

O bloco abaixo representa o procedimento atual. Ele recebe o hash completo que ja foi enviado ao GitHub.

```bash
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
```

Execucao a partir do PowerShell local:

```powershell
$DeployScript = Get-Content -Raw -LiteralPath '.\deploy-script-temporario.sh'
$DeployScript = $DeployScript -replace "`r`n", "`n"
$DeployScript | ssh `
  -i 'C:\Users\alanl\Downloads\chaves\LumixEngineVPS.pem' `
  ubuntu@54.233.8.193 `
  "bash -s -- $Commit"
```

O arquivo `deploy-script-temporario.sh` e somente uma representacao do bloco Bash. No fluxo executado pelo agente, o conteudo e enviado pela entrada padrao do SSH e nao precisa ser gravado na VPS.

## 10. O que cada etapa executa

### `git clone` e checkout destacado

Cria uma pasta isolada como:

```text
releases/20260829172650-0e84fc6
```

O checkout fica em detached HEAD no commit exato. A release contem codigo, `.git`, dependencias e artefatos de build proprios.

### `npm ci --silent`

- remove eventual `node_modules` existente dentro da nova release;
- instala exatamente o `package-lock.json`;
- instala dependencias de runtime e de build;
- nao altera releases anteriores.

### Carregamento do ambiente

`set -a` exporta para os comandos seguintes todas as variaveis dos dois arquivos persistentes. Nenhum desses arquivos e copiado para a release.

### `npm run db:migrate`

Executa:

```bash
node scripts/db-migrate.js
```

As migrations SQL existentes sao aplicadas no PostgreSQL de `DATABASE_URL`. Migrations ja aplicadas aparecem como `skip`. Esse comando nao executa:

```text
npm run db:seed
npm run db:import-json
```

### `npm run build`

Executa `next build` com o base path e URL de producao. O resultado fica em `.next/` dentro da nova release.

### Troca atomica de release

Primeiro e criado `current.next`; depois `mv -Tf` substitui `current` de uma vez. Os processos nunca devem observar um symlink parcialmente alterado.

### Reload PM2

O backend e reiniciado primeiro. Depois que `/api/health/ready` confirma PostgreSQL e migrations, o frontend e reiniciado. `--update-env` faz o PM2 reler o ambiente definido no arquivo persistente de ecosystem.

## 11. Health checks

O deploy aguarda ate 30 tentativas, com intervalo de um segundo, para cada processo local:

```text
http://127.0.0.1:4100/api/health/ready
http://127.0.0.1:3100/projects/cinecruzeiro/filmes
```

Depois verifica pelo Nginx e HTTPS:

```text
https://lumixengine.com/projects/cinecruzeiro/api/health/ready
https://lumixengine.com/projects/cinecruzeiro/filmes
```

Uma falha nesses comandos aciona o rollback.

## 12. O que e excluido

A limpeza ocorre somente depois de migrations, build, troca, reload e health checks bem-sucedidos.

Este trecho:

```bash
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
  | sort -r \
  | tail -n +3
```

seleciona todas as releases depois das duas mais recentes. Para cada pasta selecionada e executado:

```bash
rm -rf -- "$RELEASES/$old"
```

Portanto, de uma release antiga sao excluidos:

- codigo-fonte daquele commit;
- `.git` clonado naquela release;
- `node_modules` daquela release;
- `.next` e demais artefatos de build daquela release;
- qualquer outro arquivo que esteja dentro da pasta antiga da release.

Sao mantidas exatamente duas pastas:

1. release atual;
2. release imediatamente anterior, usada para rollback rapido.

### O que nao e excluido

O comando de limpeza nao alcanca:

- o symlink `current`;
- `shared/backend.runtime.env`;
- `shared/backend.env.local`;
- `shared/uploads`;
- `shared/data`;
- PostgreSQL;
- `ecosystem.config.cjs`;
- Nginx, TLS ou outros projetos da VPS;
- logs e configuracao do PM2.

O deploy e restrito a `/home/ubuntu/projects/cinecruzeiro` e ao path publico `/projects/cinecruzeiro`.

## 13. Rollback automatico

Antes da troca, o script guarda:

```bash
PREVIOUS="$(readlink -f "$BASE/current" || true)"
```

Se ocorrer erro depois que `current` foi trocado:

1. `current` volta para `PREVIOUS` de forma atomica;
2. backend e frontend sao recarregados pelo PM2;
3. o script termina com `DEPLOY_FAILED=<codigo>`.

O rollback de arquivos nao desfaz migrations ja aplicadas. Por isso migrations devem ser retrocompativeis com a release anterior.

## 14. Falha antes da troca

Se clone, checkout, `npm ci`, migration ou build falhar antes de `SWITCHED=1`:

- `current` nao muda;
- os processos em producao continuam na release anterior;
- a pasta incompleta pode permanecer em `releases/`;
- ela deve ser removida manualmente somente depois de confirmar que nao e o destino de `current`.

Procedimento seguro:

```bash
BASE=/home/ubuntu/projects/cinecruzeiro
FAILED="$BASE/releases/<nome-da-release-incompleta>"
CURRENT="$(readlink -f "$BASE/current")"

test "$FAILED" != "$CURRENT"
test -d "$FAILED"
rm -rf -- "$FAILED"
test ! -e "$FAILED"
```

Nunca use `rm -rf` com variavel vazia, caminho calculado nao conferido ou alvo fora de `releases/`.

## 15. Verificacao final obrigatoria

```bash
BASE=/home/ubuntu/projects/cinecruzeiro

git -C "$BASE/current" rev-parse HEAD
readlink -f "$BASE/current"
find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r
pm2 status cinecruzeiro-backend cinecruzeiro-frontend --no-color
curl -fsS http://127.0.0.1:4100/api/health/live
curl -fsS http://127.0.0.1:4100/api/health/ready
curl -fsS http://127.0.0.1:3100/projects/cinecruzeiro/filmes >/dev/null
curl -fsS https://lumixengine.com/projects/cinecruzeiro/api/health/ready
curl -fsS https://lumixengine.com/projects/cinecruzeiro/filmes >/dev/null
```

Confirmar:

- hash ativo igual ao hash enviado ao GitHub;
- `current` apontando para a nova pasta;
- exatamente duas releases;
- os dois processos PM2 com status `online`;
- health local e publico respondendo;
- pagina publica respondendo com HTTP 200.

## 16. Diagnostico

```bash
pm2 logs cinecruzeiro-backend --lines 150 --nostream
pm2 logs cinecruzeiro-frontend --lines 150 --nostream
pm2 describe cinecruzeiro-backend
pm2 describe cinecruzeiro-frontend
sudo nginx -t
```

Ao analisar logs, diferencie mensagens antigas das mensagens geradas pelo PID e horario do deploy atual.

## 17. Operacoes proibidas no deploy normal

Nao executar como parte do deploy comum:

- editar credenciais diretamente dentro de uma release;
- copiar `.env` local para a VPS;
- executar `db:seed` em producao;
- executar `db:import-json` em producao;
- apagar `shared/`;
- apagar todas as releases;
- alterar Nginx sem tarefa especifica e validacao com `nginx -t`;
- usar `git reset --hard` sobre a release ativa;
- fazer deploy direto dos arquivos locais sem GitHub;
- imprimir secrets nos logs ou no terminal compartilhado.

## 18. Checklist resumido

- [ ] Testes, lint e build locais passaram.
- [ ] Diff revisado e sem secrets.
- [ ] Commit criado e enviado para `origin/main`.
- [ ] Hash completo confirmado.
- [ ] Nova release clonada do GitHub.
- [ ] Checkout exato confirmado.
- [ ] `npm ci` concluido.
- [ ] Ambiente persistente carregado.
- [ ] Migrations concluidas.
- [ ] Build de producao concluido.
- [ ] Symlink `current` trocado atomicamente.
- [ ] Backend online e health local aprovado.
- [ ] Frontend online e pagina local aprovada.
- [ ] Health e pagina publica aprovados.
- [ ] Somente duas releases mantidas.
- [ ] Commit ativo na VPS igual ao GitHub.
