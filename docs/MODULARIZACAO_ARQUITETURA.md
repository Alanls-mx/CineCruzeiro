# Modularizacao estrutural: Cine Cruzeiro

## Referencia funcional

- Base: `codex/multi-cinema-rollout` em `ea7c5df`. Essa linha inclui os ajustes recentes de assinatura dos webhooks, SDK de pagamentos, CSP e seguranca.
- Branch de trabalho: `codex/modularize-server-admin`.
- Esta etapa altera organizacao de codigo, nao contratos HTTP, calculos, interface ou dados persistidos.
- O pedido desta refatoracao proibe deploy automatico. A branch sera validada localmente.

## Inventario anterior

| Arquivo | Linhas | Funcoes de topo | Principal concentracao |
| --- | ---: | ---: | --- |
| `backend/server.js` | 18.421 | 495 | `handleApi`: 6.877 linhas de rotas em sequencia |
| `backend/public/admin.js` | 14.337 | 607 | `bindEvents`: 1.171 linhas de listeners |

O backend mistura entrada HTTP, autenticacao administrativa e de clientes, seguranca, persistencia, catalogo, bilheteria, pagamentos, Clube, automacoes, integracoes, relatatorios, observabilidade, WebSocket e manutencao. Ja existem 123 arquivos em `backend/services` e 12 repositorios; uma nova extracao deve reutilizar essas fronteiras antes de criar outras. `server.js` importa servicos e repositorios, mas nao foi identificado `require` de volta para ele nesses diretorios.

O painel usa um objeto `state` compartilhado para selecao, filtros, edicao, vendas, leitura de QR, campanhas, telemetria e atualizacao da interface. A inicializacao em `initAdmin` depende de `bindEvents`, dos elementos em `admin.html` e da ordem atual `jsQR.js` -> `admin-modules/*` -> `admin.js` -> `social-studio.js`. Os eventos delegados e a CSP sem handlers inline devem permanecer. Timers do QR, pagamentos presenciais, busca de clientes, campanhas e refresh, alem de SSE de telemetria e WebSocket de poltronas, continuam sob controle do script principal.

## Fronteiras criticas

- `requiredAdminPermission`, `adminAuthRequired`, `ensureAdmin`, origem, CSRF, rate limiting e tratamento de erros ficam na entrada ate haver testes de contrato que cubram toda a tabela de rotas. Modulos de rota nao podem contornar essa verificacao.
- Webhook Mercado Pago em `handleApi` permanece intocado nesta primeira fase: headers, HMAC, `data.id`, consulta ao provedor, idempotencia e reconciliacao sao controles de seguranca financeira.
- `readDb`, `withCriticalMutation`, repositorios direcionados e WebSocket tem ordem e concorrencia sensiveis; dependencias devem ser injetadas, sem importar `server.js` de um modulo.
- A configuracao por instalacao vem de ambiente e banco; modulos compartilhados nao devem codificar uma marca ou credencial.
- `loadEnvFiles` antecede o listen, mas muitos objetos sao criados antes; novos modulos nao devem capturar variaveis de ambiente no carregamento se a configuracao depende desse passo.

## Acoplamento dos testes

Ha testes que inspecionam texto/funcoes de `server.js` e `admin.js`, alem dos testes HTTP e de navegador. Exemplos: catalogo e sessoes, seguranca CSP/XSS, logs, importacao TMDB e operacao financeira. Quando uma funcao mudar de arquivo, o teste estrutural deve apontar para a nova fonte sem relaxar suas assercoes. Testes de comportamento HTTP devem permanecer iguais.

## Etapas de extracao

1. Apresentacao dos logs do admin: funcoes puras e sem estado em um script local carregado antes de `admin.js`; API explicita em um namespace unico, sem etapa nova de build.
2. Composicao do dashboard administrativo no backend: mover a funcao de agregacao sem alterar expressoes financeiras; injetar somente as dependencias que ela realmente usa.
3. Rotas de catalogo, salas e sessoes: extrair por grupo preservando a ordem atual, a verificacao central de permissao, codigos e respostas. Testar HTTP, conflitos de sala e historico de vendas.
4. Um controlador de UI coeso do admin, depois de mapear suas referencias de `state` e listeners. Evitar criar um segundo registro global de eventos.
5. Reavaliar areas sensiveis restantes (auth, pagamentos, reservas, WebSocket) somente com cobertura especifica. Checkout e persistencia PostgreSQL ficam fora da primeira fase.

Cada etapa recebe um commit separado e regressao direcionada. Nenhuma migracao de banco deve ser necessaria para a modularizacao.

## Linha de base executada

- `npm run lint` e `npm run build`: passaram.
- Permissoes: 4/4; metadata de pagamentos: 7/7; conflitos de sessoes: 10/10.
- Catalogo/operacoes: 15 passaram, 1 PostgreSQL ignorado sem `TEST_DATABASE_URL`.
- Repositorios admin: 6 passaram, 3 PostgreSQL ignorados sem `TEST_DATABASE_URL`.
- 2FA administrativo e assinaturas de webhook Mercado Pago: passaram.
- `npm run test:security:local`: 19/19, mais os scripts de imagens, webhooks e poltronas.

Nao foi executado `npm test` integral nesta linha de base porque `scripts/smoke-tests.js` escreve no caminho fixo `backend/data/db.json`, compartilhado com o workspace. Os testes HTTP isolados usam arquivos temporarios e nao alteram os dados locais. A validacao PostgreSQL real ainda requer um banco de teste isolado.

## Fronteira de rotas e permissoes

`adminAuthRequired`, `requiredAdminRoles`, `requiredAdminPermission` e `ensureAdmin` permanecem em `server.js`. O dispatcher chama os novos handlers somente depois de `ensureAdmin`; a ordem entre os grupos extraidos e as rotas restantes foi preservada. A tabela resume as familias afetadas; a regra por metodo continua definida nas funcoes centrais.

| Familia de endpoints | Papel permitido | Permissao principal |
| --- | --- | --- |
| `/api/admin/dashboard` | owner, manager, operator | `dashboard.view` |
| `/api/movies`, `/api/movies/:id`, `/api/movies/order` | owner, manager | `movies.view/create/edit/delete` conforme metodo |
| `/api/movies/:id/sessions`, `/api/admin/sessions/autocorrect` | owner, manager | `sessions.manage`, `sessions.autocorrect` |
| `/api/rooms`, `/api/rooms/:id` | owner, manager | `rooms.view/create/edit/delete` |
| `/api/ticket-types`, `/api/ticket-types/:id` | owner, manager | `ticket_types.view/create/edit/delete` |
| `/api/concessions`, `/api/concessions/:id` | owner, manager | `concessions.view/edit/delete` |
| `/api/promotions`, `/api/ads` e subrotas | owner, manager | `marketing.view/manage` |
| `/api/admin/logs`, `/api/admin/logs/performance`, `/stream` | owner, manager (DELETE: owner) | `logs.view` (DELETE: `logs.delete`) |

Rotas de clientes, checkout, bilheteria, Clube, integracoes, automacoes e webhooks permanecem no dispatcher original. As excecoes de autenticacao para webhooks e automacoes continuam acompanhadas de suas verificacoes especificas de assinatura/token. O controle de origem/CSRF, a autenticacao 2FA e o rate limiting nao foram movidos.

## Resultado desta fase

| Arquivo principal | Antes | Depois | Reducao liquida |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 18.421 | 17.330 | 1.091 linhas |
| `backend/public/admin.js` | 14.337 | 12.356 | 1.981 linhas |

Foram extraidas 3.428 linhas em doze modulos. A diferenca entre codigo extraido e reducao liquida vem de factories, contratos de dependencia, adaptadores de rota e carregamento explicito. A extracao nao altera esquema de banco, payloads de pagamentos nem arquivos de configuracao por cinema.

| Modulo | Responsabilidade | Dependencias relevantes |
| --- | --- | --- |
| `backend/services/adminDashboardService.js` | Agregar indicadores administrativos | Reconhecimento financeiro e helpers injetados do dispatcher |
| `backend/services/movieCatalogHandler.js` | Filmes, sessoes e autocorrecao | Repositorios de filmes/sessoes, validadores e realtime injetados |
| `backend/services/venueConfigurationHandler.js` | Salas, limpeza e tipos de ingresso | Repositorios de salas/tipos e estado de poltronas |
| `backend/services/commercialCatalogHandler.js` | Catalogo de bomboniere, promocoes e anuncios | Repositorios comerciais e validadores existentes |
| `backend/services/adminLogsHandler.js` | Consulta, stream e retencao de logs administrativos | Monitor de desempenho por getter, persistencia de logs e auditoria injetados |
| `backend/public/admin-modules/log-presentation.js` | Textos e classificacao dos logs | Sem estado ou DOM |
| `backend/public/admin-modules/dashboard-view.js` | Indicadores e grafico do dashboard | `state` e helpers de DOM/formatacao injetados |
| `backend/public/admin-modules/performance-view.js` | KPIs, graficos e alertas de telemetria | Seletores/escape injetados; pico de CPU local ao modulo |
| `backend/public/admin-modules/club-view.js` | Apresentacao de planos, assinaturas e uso | `state` e helpers de renderizacao injetados |
| `backend/public/admin-modules/concession-sales-view.js` | Vendas diarias, estados de arquivamento e detalhes da bomboniere | `state`, DOM, API e comandos financeiros injetados |
| `backend/public/admin-modules/promotions-view.js` | Lista, formulario e historico de cupons | `state`, DOM, API e helpers de formulario injetados |
| `backend/public/admin-modules/ads-view.js` | Lista, formulario e controle de exibicao de anuncios | `state`, DOM, API e helpers de formulario injetados |

Os modulos de navegador usam um unico namespace explicito, `CineAdminModules`, carregado por scripts locais antes de `admin.js`. Nao ha segundo registro global de eventos ou etapa nova de build. Os handlers do backend recebem os servicos e repositorios por parametro; nenhum importa `server.js`, evitando ciclo de dependencia.

## Validacao apos extracoes

- `npm run lint` e `npm run build`: passaram.
- Dashboard, catalogo, salas, configuracao de limpeza e catalogo comercial: testes HTTP em banco JSON isolado passaram. O primeiro teste de conta falhou intermitentemente ao renomear um arquivo temporario no Windows quando rodou em paralelo; passou nas repeticoes seriais.
- `test:permissions`: 4/4; `test:finance`: 50/50; `test:coupon`: 6/6; `test:payment-metadata`: 7/7; `test:session-conflicts`: 10/10; `test:google-wallet`: 17/17.
- `test:catalog-operations`: 15 passaram, 1 PostgreSQL ignorado. `test:admin-repositories`: 6 passaram, 3 PostgreSQL ignorados. `TEST_DATABASE_URL` nao esta disponivel; nenhum banco de producao foi usado como substituto.
- `test:security:local`: 19/19, mais scripts de imagem, assinatura Mercado Pago e realtime de poltronas. Testes de UI com Playwright no fluxo administrativo isolado passaram sem erro JavaScript; os modulos novos tem testes de renderizacao e de ordem de carregamento.
- Extracoes adicionais: vendas da bomboniere 3/3, cupons 2/2 e handler de logs 2/2. O teste HTTP isolado confirmou GET/DELETE de logs para dono e 403 para operador; o Playwright confirmou lista, formulario e filtro de cupons apos a extracao. A verificacao de CSP/XSS passou a ler tambem os novos scripts.
- Anuncios: 2/2 no teste do modulo; Playwright confirmou lista e formulario. A verificacao CSP/XSS incluiu o script de anuncios. `test:coupon` 6/6, `test:permissions` 4/4 e `deploy:validate` confirmaram as regras e o registro das instalacoes. `npm run lint`, `npm run build` e `test:security:local` foram repetidos apos essa etapa e passaram.
- Persistencia: 8 passaram, 2 PostgreSQL ignorados. Publicacao de filmes: 5/5; mapa de poltronas: 2/2; registro de instalacoes: 6/6; `deploy:validate`: `REGISTRY_OK=1`.
- `test:email-campaign`: 40 passaram, 7 ignorados, 1 falhou em `email-automation.test.mjs` por esperar `29/09 · 19:00` no HTML semanal. Nem o teste nem `emailAutomationService.js` mudaram em relacao a `ea7c5df`; a falha foi mantida fora do escopo desta refatoracao.
- Nao foi executado `npm test` integral pelo risco conhecido de escrita em `backend/data/db.json` pelo smoke test. Nao houve homologacao ao vivo com provedor de pagamento, PostgreSQL, PM2 ou Nginx; nenhum deploy foi feito, conforme solicitado.

## Pendencias de arquitetura

`handleApi` ainda concentra autenticacao, bilheteria, Clube, integracoes, pagamentos e webhooks; `bindEvents` ainda concentra os listeners do admin. Essas partes exigem testes de contrato, concorrencia e permissao mais completos antes de extracoes adicionais. Em particular, o webhook Mercado Pago funcional e o payload de Orders foram deliberadamente preservados. `CheckoutPage.tsx` e `postgresStore.js` permanecem fora desta fase. A compatibilidade multi-cinema foi verificada por ausencia de novos valores de ambiente, credenciais ou marca fixa nos handlers compartilhados; a validacao de cinco instalacoes em execucao continua pendente.

## Continuação: infraestrutura de testes

O teste de automação de e-mail passou a usar a mesma data planejada para selecionar filmes e renderizar as sessões (commit `c20ddd6`); a suíte `test:email-campaign` passou. O smoke antigo foi isolado em diretório temporário e atualizado para contratos atuais de impressão, rascunhos e batch de webhooks. O modo legado JSON passou integralmente, sem acesso ao `backend/data/db.json` do workspace. Uma retentativa limitada para `rename` com `EPERM`/`EBUSY` no Windows foi adicionada ao armazenamento JSON; não há fallback que apague o destino.

O fluxo padrão agora exige PostgreSQL descartável e marcado, conforme [TESTES_POSTGRESQL.md](TESTES_POSTGRESQL.md). `npm run test:unit` passou. Não há PostgreSQL local configurado neste host; smoke e concorrência PostgreSQL permanecem **não homologados**, e `npm test` falha de forma segura nessa ausência. A modularização adicional do `bindEvents` fica condicionada à execução do smoke PostgreSQL isolado. Nenhum deploy foi realizado.

## Commits

`c864d05` auditoria/baseline; `2596baf` logs do admin; `0f6117f` dashboard backend; `8555e17` dashboard UI; `068f17e` filmes/sessoes; `af1f8bf` telemetria UI; `ce11961` salas/tipos; `2d7cf66` Clube UI; `911f62f` catalogo comercial; `94fb19f` cobertura dos repositorios apos extracao; `71672f5` vendas da bomboniere UI; `94dac03` logs administrativos backend; `8b01228` cupons UI; `5f9dc67` anuncios UI; `078b243` relatorio intermediario.
