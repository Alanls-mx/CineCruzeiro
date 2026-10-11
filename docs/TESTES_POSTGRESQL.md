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
- O workflow `.github/workflows/postgres-integration.yml` executa esses três comandos em serviço PostgreSQL 16 exclusivo, em push da branch de refatoração e em pull requests. Os arquivos de teste de repositório rodam em série no mesmo banco descartável; os cenários de concorrência dentro deles continuam paralelos. A execução do commit `2a73982` passou no GitHub Actions (run `38096359199`), inclusive smoke, concorrência e repositórios. Uma execução anterior (`38096064338`) falhou de forma intermitente no smoke ao esperar 3 créditos do Clube restaurados após cancelamento e receber 0; essa instabilidade permanece aberta, sem skip ou relaxamento de asserção.
- O Docker Desktop desta estação não iniciou durante a Fase 3. A evidência PostgreSQL desta fase vem do CI, não de uma execução PostgreSQL local.
- `scripts/db-import-json.js` lê `backend/data/db.json` como ferramenta explícita de importação. Deve permanecer disponível para recuperação/migração de dados existentes.
- `scripts/generate-social-studio-posts.mjs` lê esse JSON para geração manual; pode ser migrado para leitura PostgreSQL em tarefa separada, com validação das saídas antes de remover o caminho legado.
- `scripts/e2e-dev-server.js` e testes HTTP JSON usam arquivos temporários próprios; são ambientes de compatibilidade, não a validação principal.
- Nenhum script de teste deve executar migrations ou resets em `DATABASE_URL`/`POSTGRES_URL` operacional. Para execução destrutiva, use apenas o harness acima.

## Atualizacao da Fase 4.2

O smoke PostgreSQL passou a afirmar que Pix e cartao (201), atribuicao manual de assinatura (201), validacao de ingresso (200) e exclusao permanente de pedido (200) ficam visiveis em uma leitura imediata. O CI reproduziu falhas reais no cancelamento logo apos Pix e na leitura de assinatura logo apos a atribuicao; os handlers foram ajustados para responder depois do commit, sem adicionar espera ou relaxar o teste. O job PostgreSQL do commit `d80b5d3` passou, assim como seguranca e Playwright no GitHub Actions.

O job de navegador em `.github/workflows/e2e.yml` e separado: usa processos e JSON sintetico temporario, nao substitui os testes PostgreSQL. `npm run test:e2e` isola tambem uploads, anexos e documentos, fecha os processos e guarda traces/screenshots em falhas no CI. O teste de variacao de dia fica em `tests/e2e-session-time.test.mjs`.

O teste de cache `tests/postgres-snapshot-cache-policy.test.mjs` cobre duas invalidacoes sucessivas com leitores paralelos e roda no job PostgreSQL. A verificacao de cinco instalacoes em `npm run deploy:validate` valida configuracao, nao os bancos ou servicos operacionais. Nenhum banco existente foi migrado, apagado ou sobrescrito, e nenhum deploy foi realizado.

## Atualizacao da Fase 5

A migration `051_ticket_email_jobs.sql` cria o trabalho de e-mail de ingresso na transacao do pedido pago. `tests/database-persistence-postgres.test.mjs` verifica que rollback nao deixa trabalho, que o commit cria um unico job e que reivindicacao/conclusao sao condicionais. O mesmo arquivo exercita 125 campanhas do Social Studio em paginas e dois claims concorrentes. Esses testes sao executados pelo smoke PostgreSQL isolado no CI; sem `TEST_DATABASE_URL` autorizado sao ignorados localmente, nunca redirecionados a um banco de desenvolvimento. O primeiro job da Fase 5 encontrou um cursor vazio tratado como UUID na consulta de recuperacao; o codigo agora envia `NULL` tipado. Nenhuma migration foi aplicada em ambiente operacional.
