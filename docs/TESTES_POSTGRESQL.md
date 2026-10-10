# Persistência dos testes

O fluxo principal usa PostgreSQL. `npm test` executa a suíte unitária, o smoke HTTP, a concorrência e os testes de repositório em **três bancos descartáveis diferentes**. O modo JSON é legado e só é executado por `npm run test:legacy:json`.

## Configuração local

Configure `TEST_POSTGRES_ADMIN_URL` apontando para um PostgreSQL **local e comprovadamente descartável** (`localhost`, `127.0.0.1` ou `::1`), banco de manutenção `postgres`, com o role dedicado `cine_test_admin`, não-superusuário e com permissão `CREATEDB`. Não utilize uma URL de produção, desenvolvimento, túnel para VPS ou um role de aplicação. Mantenha a credencial fora do repositório. O harness recusa URLs com parâmetros de query, role diferente ou host remoto. `localhost` sozinho não autoriza testes: antes de `CREATE DATABASE`, ele exige o token `CINE_TEST_SERVER_TOKEN` correspondente à tabela `cine_test_server_marker` criada **no contêiner descartável por um canal fora da conexão TCP**. Uma porta local encaminhada a outro servidor não terá essa marca. O banco temporário recebe ainda seu próprio marcador de execução.

Exemplo de formato, sem credencial real:

```text
TEST_POSTGRES_ADMIN_URL=postgresql://cine_test_admin:<senha>@127.0.0.1:<porta>/postgres
CINE_TEST_SERVER_TOKEN=<token aleatório de 32 caracteres hexadecimais instalado no contêiner de teste>
```

O role e a marca da instância devem ser criados **somente num contêiner novo reservado a testes**. No CI, `scripts/setup-ci-postgres.js` usa o ID do serviço Docker fornecido pelo GitHub Actions, verifica imagem e porta, instala o role e a marca via `docker exec`, e confirma a identidade pela conexão TCP antes de disponibilizar a URL ao harness. Nenhuma credencial de cinema é usada. Localmente, a preparação equivalente deve ser feita apenas num contêiner descartável sob controle do desenvolvedor. O harness cria um banco `cinecruzeiro_test_<16 hex>` para cada execução, instala um marcador de execução, aplica migrations e seed sintético, e remove apenas esse banco ao terminar. `DATABASE_URL`, `POSTGRES_URL` e `TEST_DATABASE_URL` herdados fazem o harness falhar antes de conectar. Um `TEST_DATABASE_URL` informado manualmente sem ambas as marcas é rejeitado. Não há fallback para JSON.

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
- O workflow `.github/workflows/postgres-integration.yml` executa esses três comandos em serviço PostgreSQL 16 exclusivo, em push da branch de refatoração e em pull requests. A execução no GitHub Actions deve ser conferida separadamente; sucesso local não comprova sucesso no CI.
- `scripts/db-import-json.js` lê `backend/data/db.json` como ferramenta explícita de importação. Deve permanecer disponível para recuperação/migração de dados existentes.
- `scripts/generate-social-studio-posts.mjs` lê esse JSON para geração manual; pode ser migrado para leitura PostgreSQL em tarefa separada, com validação das saídas antes de remover o caminho legado.
- `scripts/e2e-dev-server.js` e testes HTTP JSON usam arquivos temporários próprios; são ambientes de compatibilidade, não a validação principal.
- Nenhum script de teste deve executar migrations ou resets em `DATABASE_URL`/`POSTGRES_URL` operacional. Para execução destrutiva, use apenas o harness acima.
