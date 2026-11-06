# Extração da infraestrutura HTTP do backend

Branch `codex/cine-modularizacao-profunda`. Esta etapa isola entrega de arquivos, atualização desktop, stream SSE, respostas HTTP e rotas de infraestrutura. O código de autenticação, CSRF, origem, rate limit, pagamentos, webhooks e transações continua com o mesmo ponto de entrada e a mesma ordem no `server.js`. Nenhuma migration ou chamada a provedor operacional faz parte da alteração.

## Medição reproduzível

`node scripts/measure-modularization.mjs --summary` conta linhas físicas, incluindo comentários e linhas vazias.

| Arquivo | Antes | Depois | Diferença |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 17.324 | 17.135 | −189 |
| `backend/public/admin.js` | 11.980 | 11.980 | 0 |

| Novo módulo | Linhas | Responsabilidade |
| --- | ---: | --- |
| `backend/services/staticAssetHandler.js` | 114 | Arquivos, contenção de caminho e shell Admin |
| `backend/services/desktopUpdateHandler.js` | 29 | Conteúdo e cache do download desktop |
| `backend/services/performanceStreamService.js` | 45 | Conexões, limite, snapshot e broadcast SSE |
| `backend/services/httpResponseService.js` | 59 | JSON, 204, normalização de erro, CORS e resposta após commit |
| `backend/services/infrastructureRoutes.js` | 33 | Registro de health e desktop |

As factories recebem dependências do composition root; nenhum dos novos módulos importa `server.js`. As duas verificações de rotas de infraestrutura continuam nos seus pontos anteriores: health antes do rate limit; desktop depois. O dispatcher ainda chama os handlers de filme, sala, catálogo comercial e logs nos pontos existentes. A seleção da rota estática e o guard da rota SSE continuam fora dos módulos de entrega.

## Limites preservados

- `start.js` e `maintenanceServer.js` não mudaram. O modo quiescente não importa `server.js`, não inicia monitor, stream ou workers, e continua respondendo 503 às rotas operacionais.
- A sessão Admin usada para escolher o shell é consultada pelo mesmo `getAdminUser`, injetado. `ensureAdmin`, as matrizes de permissão, CSRF e origem não foram movidos nem copiados.
- `sendJson` mantém `requestContext` e `deferUntilPostgresCommit`; `sendNoContent` mantém a semântica anterior. A extração não muda escritores, snapshot, conexões ou fronteiras de transação.
- Nenhum caminho HTTP, método, cookie, header ou formato de payload foi alterado. O teste fixou o comportamento observado de cache: somente `latest.ini` na raiz da atualização desktop usa `no-store`.

## Verificação e limites

Testes dirigidos novos: estáticos/uploads e arquivo ausente, download desktop, SSE e limpeza, resposta HTTP pós-commit e despacho health/desktop. Os quatro testes de módulo foram incluídos em `npm run test:characterization` (10/10). `npm run test:unit`, `npm run test:security:local`, `npm run lint`, `npm run build`, `npm run docs:check` e `npm run test:e2e` passaram; E2E: 19/19. Parte dos testes PostgreSQL dentro de `test:unit` foi ignorada por falta de `TEST_DATABASE_URL`; o smoke PostgreSQL descartável foi executado separadamente. Os avisos de CSP `unsafe-eval` no servidor Next de desenvolvimento e webhook de e-mail não configurado apareceram no E2E sem falha de teste; não foram tratados nesta extração.

`node scripts/with-local-disposable-postgres.js smoke` passou: migrations e dados sintéticos em contêiner local marcado, removido pelo harness ao final. A suíte não chama provedores reais. Testes de produção, VPS e homologação externa não fazem parte desta etapa.

**Risco residual:** a redução é intencionalmente modesta. O dispatcher `handleApi` continua extenso e a resposta HTTP é central para fluxos financeiros; as próximas extrações devem continuar por família de rotas com caracterização própria, sem transferir o bloco inteiro a outro monólito. A meta final de 3.000–5.000 linhas ainda não foi alcançada.
