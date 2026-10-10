# Persistência dos testes

O fluxo principal usa PostgreSQL. `npm test` executa a suíte unitária, o smoke HTTP, a concorrência e os testes de repositório em **três bancos descartáveis diferentes**. O modo JSON é legado e só é executado por `npm run test:legacy:json`.

## Configuração local

Configure `TEST_POSTGRES_ADMIN_URL` apontando para um PostgreSQL **local** (`localhost`, `127.0.0.1` ou `::1`), banco de manutenção `postgres`, com o role dedicado `cine_test_admin`, não-superusuário e com permissão `CREATEDB`. Não utilize uma URL de produção, desenvolvimento, túnel para VPS ou um role de aplicação. Mantenha essa credencial fora do repositório. O harness recusa URLs com parâmetros de query, role diferente ou host remoto, e confere os atributos do role antes do `CREATE DATABASE`.

Exemplo de formato, sem credencial real:

```text
TEST_POSTGRES_ADMIN_URL=postgresql://cine_test_admin:<senha>@127.0.0.1:5432/postgres
```

O role dedicado deve ser criado e autorizado **somente no PostgreSQL local reservado a testes**. O harness cria um banco `cinecruzeiro_test_<16 hex>` para cada execução, instala um marcador com token aleatório, executa migrations e seed sintético, e remove apenas esse banco após o processo filho terminar. Antes de migrations, resets ou testes SQL diretos, o processo valida nome, host, role, `NODE_ENV=test` e marcador. Um `TEST_DATABASE_URL` informado manualmente sem token e marcador correspondentes é rejeitado. O comando falha quando a infraestrutura não está configurada; não volta ao JSON silenciosamente.

```text
npm run test:unit
npm run test:smoke:postgres
npm run test:postgres
npm run test:postgres:repositories
npm run test:legacy:json
npm test
```

O smoke JSON cria um arquivo e diretórios auxiliares em `%TEMP%`/`os.tmpdir()` e não lê, altera nem restaura `backend/data/db.json`. Ele cobre compatibilidade do modo JSON; não substitui o smoke PostgreSQL. Os testes PostgreSQL individuais que recebem `TEST_DATABASE_URL` também exigem o marcador antes de qualquer escrita.

## Limites e dependências restantes

- A validação desta fase usou um contêiner PostgreSQL 16 local e temporário, com role dedicado não-superusuário. Smoke, concorrência e testes de repositório passaram em bancos gerados e removidos pelo harness. Nenhum banco existente ou VPS foi usado.
- `scripts/db-import-json.js` lê `backend/data/db.json` como ferramenta explícita de importação. Deve permanecer disponível para recuperação/migração de dados existentes.
- `scripts/generate-social-studio-posts.mjs` lê esse JSON para geração manual; pode ser migrado para leitura PostgreSQL em tarefa separada, com validação das saídas antes de remover o caminho legado.
- `scripts/e2e-dev-server.js` e testes HTTP JSON usam arquivos temporários próprios; são ambientes de compatibilidade, não a validação principal.
- Nenhum script de teste deve executar migrations ou resets em `DATABASE_URL`/`POSTGRES_URL` operacional. Para execução destrutiva, use apenas o harness acima.
