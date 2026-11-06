# Admin: extrações de catálogo e marketing

Branch `codex/cine-modularizacao-profunda`. Esta etapa transferiu apresentação e comandos de equipe, filmes, sessões, salas, agenda, bomboniere e e-mail para módulos carregados por `admin.html`. Não alterou endpoints, contratos HTTP, regras financeiras, permissões no servidor ou persistência.

## Medição reproduzível

`node scripts/measure-modularization.mjs --summary` conta linhas físicas, inclusive comentários e vazias.

| Arquivo | Antes (`65f4a56`) | Depois | Diferença |
| --- | ---: | ---: | ---: |
| `backend/public/admin.js` | 11.985 | 8.925 | −3.060 (−25,5%) |

O arquivo permanece acima da meta final de 2.000–3.500 linhas. `bindEvents` ainda ocupa cerca de 1.100 linhas; bilheteria, Point, Clube, integrações, tickets e efeitos com timers/WebSocket continuam no shell. A próxima etapa precisa caracterizar esses ciclos antes de mover os comandos. Os maiores módulos desta etapa são `email-campaign-editor.js` (623 linhas), `email-campaign-template-engine.js` (467) e `room-seat-editor.js` (442); nenhum substitui o monólito por outro arquivo de milhares de linhas.

## Fronteiras extraídas

| Domínio e módulo | Entrada, permissão e escrita preservadas | Teste e risco residual |
| --- | --- | --- |
| Equipe: `team-accounts-view.js` | `/api/users`, `users.manage`; `/api/admin/security-policy`, permissão administrativa existente. A API e o repositório de usuários seguem como autoridade; a view só atualiza a coleção após resposta. | `admin-team-accounts-view.test.mjs`; papéis visuais não substituem RBAC do servidor. |
| Filmes: `movie-catalog-view.js`, `movie-catalog-commands.js` | `/api/movies` e ordenação, `movies.create`/`movies.edit`; persistência por `movieRepository` e política de publicação existentes. | Testes `admin-movie-catalog-*`, `admin-repositories`; callbacks tardios ligam filmes a sessões. |
| Sessões: `movie-sessions-view.js`, `session-schedule-view.js` | `/api/movies/:id/sessions`, `sessions.manage`, `sessionRepository`; agenda é apresentação local, sem API ou escritor novo. Conflito e limpeza continuam validados pelo backend. | `admin-movie-sessions-view`, `admin-session-schedule-view`, E2E de ações; mapa de poltronas permanece no shell. |
| Salas: `room-list-view.js`, `room-seat-editor.js` | `/api/rooms`, `rooms.create`/`rooms.edit`, `roomRepository`; atualização local só após resposta. | Testes de sala/mapa, E2E de sessão; rascunho de layout ainda compartilha `state`. |
| Produtos: `concession-products-view.js` | `/api/concessions`, `concessions.edit`, `concessionRepository`; preço e estoque passam pelo servidor. Vendas e reembolsos continuam em outro fluxo. | `admin-concession-products-view`, testes financeiros existentes; não confundir edição de catálogo com venda. |
| Campanhas: `email-campaign-template-engine.js`, `email-campaign-editor.js`, `email-campaign-history-view.js`, `email-template-library-view.js` | `/api/admin/email/*`, `marketing.view` para GET e `marketing.manage` para escrita; campanhas e destinatários seguem nos serviços e repositório existentes. Envio conserva confirmação, idempotência e retorno da API. | Testes `admin-email-*`, `email-template-library`, E2E de campanhas; timer de resolução no editor e polling de histórico na view exigem futura caracterização de teardown. |

`admin.js` mantém o único `state`, o transporte `api`, a composição de factories, `bindEvents`, navegação e guardas de apresentação. As factories recebem dependências explícitas; não importam `admin.js`, não registram listeners permanentes ao carregar o script e expõem APIs congeladas em `CineAdminModules`. O teste de composição verifica 24 scripts de módulo antes do shell. Eventos em nós recriados continuam associados aos próprios nós; não foi introduzido binder global paralelo.

## Verificação

Os testes que liam a implementação como texto passaram a procurar as mesmas regras nos módulos donos. O teste de seleção de filmes em campanhas executa as factories reais em um navegador, preservando os casos de seleção explícita, automática e ausência de filme.

| Comando | Resultado |
| --- | --- |
| `node --test tests/admin-*.test.mjs` | 74 aprovados, 3 ignorados por dependência de PostgreSQL, 0 falhas |
| `npm run test:unit` | Aprovado; os testes PostgreSQL sem ambiente descartável foram ignorados conforme a própria suíte |
| `npm run test:security:local` | Aprovado, inclusive contrato de IDs como atributos de dados e CSP sem handlers inline |
| `npm run lint`, `npm run build`, `npm run docs:check` | Aprovados |
| `npm run test:e2e` | 19 aprovados, 0 falhas |

Não se executaram testes PostgreSQL destrutivos nem chamadas a provedores operacionais, pois esta etapa altera somente o painel estático. O mapa de [módulos](modules.md), [dependências](dependencies.md) e o [plano](ADMIN_MODULARIZATION_PLAN.md) acompanham estas fronteiras.
