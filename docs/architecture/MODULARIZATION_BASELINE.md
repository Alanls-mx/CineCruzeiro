# Linha de base da modularização profunda

**Revisão:** 05/11/2026. **Branch:** `codex/cine-modularizacao-profunda`, derivada de `codex/modularize-server-admin` em `0dda3b1e7de4385748e614b27663123b82ff3634`. O SHA indicado no pedido (`719b1ed5a83b3cb1fa78cfacd2b660c15dd0d204`) é anterior ao HEAD publicado. Esta etapa inventaria o código e adiciona medição; não muda rotas, regras ou UI.

## Como reproduzir

Após `npm ci`, execute `npm run docs:modularization:baseline`. O script `scripts/measure-modularization.mjs` usa o parser TypeScript, dependência direta de desenvolvimento, e conta linhas físicas em LF/CRLF. Rode `node scripts/measure-modularization.mjs --symbols`, `--listeners`, `--routes`, `--conditions`, `--files` ou `--json` para o inventário integral, com arquivo e linha **da revisão medida**. As linhas servem para auditoria pontual; o mapa de arquitetura não as usa como identificador permanente. Literais `/api/` e condições são **candidatos estáticos**, não prova de que cada combinação de método e caminho seja alcançável. Regex, caminhos interpolados, autenticação e ordem do dispatcher exigem leitura do código.

| Arquivo | Linhas físicas | Bytes UTF-8 | Meta |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 17.324 | 859.670 | 3.000–5.000 |
| `backend/public/admin.js` | 11.980 | 627.415 | 2.000–3.500 |
| `backend/public/admin.html` | 3.299 | 204.316 | Não é alvo de corte nesta etapa |
| `backend/start.js` | 26 | 1.185 | Manter o portão de startup |
| `src/components/CheckoutPage.tsx` | 1.963 | 107.586 | Contrato de checkout, fora do corte inicial |
| `src/services/cinemaApi.ts` | 1.023 | 34.951 | Contrato HTTP do cliente, fora do corte inicial |

O parser encontrou em `server.js` **573 funções com nome inferível**, 990 callbacks anônimos, nenhuma classe declarada, 103 imports `require`, 16 pontos de listener/timer e 119 literais `/api/` distintos em 240 ocorrências. Em `admin.js`: **564 funções com nome inferível**, 910 callbacks anônimos, nenhuma classe declarada, 205 propriedades diretas de `state`, 342 pontos de listener/timer/conexão e 40 literais `/api/` distintos em 45 ocorrências. Estes totais incluem funções internas e propriedades-função; não são contagem de endpoints nem de responsabilidades independentes. `handleApi` ocupa 6.137 linhas e `bindEvents` 1.100. O inventário `--symbols` lista também cada callback anônimo e classe encontrada, permitindo comparar revisões sem uma lista de mil nomes desatualizada neste documento.

## Entradas, inicialização e estado compartilhado

| Entrada/bloco | Função e dependências observadas | Limite que a extração deve manter |
| --- | --- | --- |
| `backend/start.js` | Seleciona `quiescent`/`normal`, confere instalação e SHA; importa `server.js` apenas no modo normal. | Não carregar DB, WS ou workers no modo fechado. |
| Topo de `server.js` | Importa serviços/repositórios, cria `requestContext` e `mutationContext` (`AsyncLocalStorage`), mapas de holds, reconciliação, handoff móvel, jobs de e-mail e referências de workers; define armazenamento, caminhos e provedores. | Não capturar configuração antes de `loadEnvFiles`; nenhum módulo deve importar `server.js` de volta. |
| `handleApi` | OPTIONS/health, rate limit, exceções de transação, origem/CSRF, leitura do snapshot, autenticação/permissões e sequência de handlers/rotas. | Ordem de guards, status/headers, commit antes de sucesso e assinatura de webhook. |
| `http.createServer` | Contexto por request, telemetria, log persistido, roteamento `/api/`, arquivos/admin, erro público e resposta 404. | Logs após `finish` não fazem parte do commit da requisição; preservar CSP e headers. |
| Listener WS e startup | `createSeatRealtimeService`, `server.on(error)`, `listen`, manutenção de Clube/imagens/anexos/logs, recuperação Studio, workers de e-mail/CRM, saúde Discord e SIGTERM. | Dreno e efeitos em curso não são garantidos por `stop()`/`server.close()`; não mover startup junto com rota de negócio. |
| `admin.html` | 17 scripts na ordem `jsQR` → 14 `admin-modules` → `admin.js` → `social-studio.js`; painéis, forms e diálogos usam IDs lidos no JS. | CSP sem handlers inline, ordem dos scripts e IDs/`data-*` existentes. |
| `admin.js` | `API_BASE`, `state` único com 205 campos, fábricas `CineAdminModules`, `renderAll`, `bindEvents`, `initAdmin`. | Um registro de eventos, um dono por timer/conexão, `state` passado por referência e renderização após carga/autorização. |

Os 342 sítios do Admin incluem `addEventListener`, `setTimeout`/`setInterval`, limpeza, `EventSource` e `WebSocket`; são **sítios estáticos**, não 342 listeners simultâneos. `bindEvents` contém delegação em `document` para navegação, paginação, comandos, seleção, modais e teclado, além de handlers diretos de formulários. Fora dele há visibilidade/resize/scroll, SSE de desempenho, WebSocket de poltronas, polling Point/bomboniere, busca de clientes, QR/câmera e tarefas de e-mail. `initAdmin` registra eventos, carrega a conta/2FA, depois conteúdo e restaura acompanhamento Point. A mesma ordem deve ser medida em E2E antes de dividir `bindEvents`.

### Dependências e closures que cruzam domínios

| Estado/contrato | Produtores e consumidores | Risco |
| --- | --- | --- |
| `requestContext`/`mutationContext`, `readDb`/`writeDb`, `withCriticalMutation` | Dispatcher, serviços injetados, repositórios e resposta HTTP | Responder antes do commit, perder ator/auditoria ou abrir transação em chamada externa. |
| `req.adminUser`, `req.repositoryMutation`, `req.commitResponseAfterMutation` | Guard central, handlers extraídos, Point/ordens | Bypass de permissão e mudança de semântica 200/202/503. |
| `memorySeatHolds`, `seatRealtimeService` | Assentos, reservas, checkout, bilheteria e WS | Hold duplicado/perdido e aviso realtime antes do commit. |
| `paymentReconciliationAttempts`, configuração dos provedores e chaves de idempotência | Checkout, consulta de pedido, webhooks, Point e refunds | Repetir cobrança/estorno ou aceitar status não autenticado. |
| `emailCampaignWorker`, `ticketEmailWorker`, `crmWebhookWorker` e orquestrador Studio | Startup, API, outbox e pós-commit | Disparo duplicado, job perdido, lease concorrente e efeito externo incerto. |
| `state.content`, `state.adminUser`, seleção/filtros/paginação | `renderAll`, módulos de view, formulários, `bindEvents` | Módulos podem ler snapshot velho ou registrar listener duas vezes. |
| `state.manualSeatRealtimeChannels`, `pointPaymentTimer`, `concessionCounterPaymentTimer`, `qr*`, `emailCampaign*` | Bilheteria, QR, campanhas e navegação Admin | Timers/WS sobrevivem à troca de painel; callback antigo altera painel novo. |

Há uma **declaração duplicada real** de `changeClubSubscriptionsPage` em `admin.js`; a segunda substitui a primeira no escopo atual e simplifica a lógica de paginação. Antes de extraí-la, fixar o comportamento observado em teste. A ferramenta também vê várias propriedades-função `matches` nas regras de rate limit; elas são objetos distintos, não uma duplicação de declaração. Não foi feita correção funcional nesta etapa.

## Rotas e domínios: situação atual

As famílias abaixo cobrem as entradas de negócio observadas em `handleApi`, nos quatro handlers já extraídos e no servidor HTTP. Para a relação estática de caminhos e condições, use `--routes` e `--conditions`; o [catálogo de endpoints](endpoints.md) documenta somente o subconjunto já verificado. Toda extração futura deve completar método, papéis, permissão, origem, persistência, resposta e teste **por rota concreta** antes de movê-la.

| Família / exemplos de padrão | Dono atual e efeito | Segurança/risco |
| --- | --- | --- |
| `/api/health/*`, `/api/desktop/update/*`, OPTIONS, estáticos/admin | `server.js`, `start.js`, `maintenanceServer.js` | Disponibilidade e CSP; baixo/médio. |
| `/api/auth/*`, `/api/me/*`, `/api/account/tickets`, OAuth | `server.js`, `userRepository`; cria sessão, altera conta/credenciais | Origem, rate limit, cookies/2FA; alto. |
| `/api/admin/login*`, `/logout`, `/me`, `/profile/photo`, `/2fa/*`, `/api/users/*`, segurança | `server.js`, `adminTwoFactorService`, `userRepository` | RBAC, sessão e recuperação; alto. |
| `/api/content`, `/api/settings`, `/api/admin/content`, imagens/trailers/TMDB/eventos | `server.js`, storage, mapper e repositórios | Upload, SSRF, publicidade e marca; médio/alto. |
| `/api/movies/*`, sessões, salas, tipos, bomboniere, promoções e anúncios | `movieCatalogHandler`, `venueConfigurationHandler`, `commercialCatalogHandler`, chamados após guard central | Escrita de catálogo, agenda, estoque e sessão; médio/alto. |
| `/api/sessions/*/seats`, holds e `/api/realtime/seats` | `server.js`, `sessionSeatAvailability`, `seatRealtimeService`, PostgreSQL | Concorrência e titularidade; alto. |
| `/api/orders`, `/api/checkout/*`, `/api/coupons/preview` | `server.js`, repositórios, Clube e preço | Pedido, reservas, crédito, estoque; financeiro crítico. |
| `/api/payments/{pix,card,config*}`, consultas de pedido | `server.js`, `paymentService`, `pagBankPaymentService` | Idempotência, provedor e confirmação; financeiro crítico. |
| `/api/webhooks/{mercado-pago,pag-bank}` | `server.js`, serviços de pagamento e conciliação | HMAC/autoridade, ordem de commit, replay; financeiro crítico. |
| `/api/subscription-plans`, `/api/subscriptions/*`, `/api/me/subscriptions/*`, `/api/admin/subscriptions/*` | `server.js`, `clubDomainService`, repositórios/MP | Créditos e recorrência; financeiro crítico. |
| `/api/me/tickets/*`, `/api/tickets/{manual,validate}`, Wallet | `server.js`, serviço de código/passe/atribuição | Emissão/validação/transferência; financeiro crítico. |
| `/api/orders/*` admin, refunds, cancelamento, arquivamento, exclusão | `server.js`, `orderRefundService`, `orderRepository` | Direitos, reembolso e auditoria; financeiro crítico. |
| `/api/box-office/*`, `/api/admin/concession-counter-sales`, `/api/admin/concession-sales/*` | `server.js`, `cardTerminalProvider`, estoque/ingressos | Point, impressão, venda/estorno; financeiro crítico. |
| `/api/admin/email/*`, `/api/email-automation/*`, `/api/email/unsubscribe` | `server.js`, serviços/repositório/worker de e-mail | Consentimento, lease, SMTP; alto. |
| `/api/studio/*`, `/api/admin/social-studio/*`, marketing/ads | `server.js`, Social Studio e repositório de automação | Token, arquivos, tarefas externas; médio/alto. |
| `/api/admin/integrations/*`, `/api/integrations/*`, CRM/Discord/Wallet | `server.js` e serviços de integração | Segredos, chamadas externas e teste que altera provedor; alto. |
| `/api/admin/dashboard`, `/api/admin/reports/*`, `/api/dashboard`, pagamentos/logs/performance | `server.js`, `adminDashboardService`, `adminLogsHandler`, presenters | Privacidade, métricas financeiras e SSE; médio/alto. |
| `/api/commercial/catalog`, anúncios/métricas | `commercialCatalogAccessPolicy`, `commercialCatalogPresenter`, `server.js` | Token/cors e métricas; médio. |

### Portões centrais de segurança e transação

`rateLimit` cobre login, cadastro, 2FA, recuperação, pagamentos, uploads, campanhas, relatórios e mutações admin. `adminAuthRequired`, `requiredAdminRoles`, `requiredAdminPermission`, `ensureAdmin` e `ensureAdminAction` definem acesso por rota/método. `adminOriginAllowed` e `customerMutationOriginAllowed` cobrem origem/CSRF; tokens próprios protegem Studio/e-mail/CRM e HMAC protege webhooks. `repositoryMutationRoute` e as exceções `selfManaged*` separam escrita direta, mutação crítica e efeitos externos. A ordem efetiva do dispatcher importa: health/OPTIONS → rate limit → wrapper transacional → origem → DB → autenticação → handlers e rotas. Não mover uma família isoladamente sem incluir sua linha nessa matriz e no mapa de persistência/transações.

## Extrações existentes e arquivos que podem virar novos monólitos

Já existem 135 arquivos `.js` em `backend/services` (incluindo subpastas), 13 repositórios, 56 arquivos de DB e 14 módulos de Admin. Foram extraídos catálogo de filmes/sessões, salas, catálogo comercial, logs, dashboard, presenters de clientes/assinaturas/assentos/campanhas, workers de e-mail e automação Studio; no navegador, dashboard, desempenho, Clube, vendas da bomboniere, cupons, anúncios, clientes, listas de salas/sessões, logs, finanças e ações de sessão. `server.js` ainda concentra composição, autenticação, rotas financeiras e bootstrap; `admin.js` ainda concentra forms, comandos, estado, poltronas, QR, Point, campanhas, integrações e bind de eventos.

| Arquivo | Linhas | Risco de crescimento |
| --- | ---: | --- |
| `scripts/smoke-tests.js` | 3.476 | Dividir cenários por domínio sem afrouxar o harness PostgreSQL descartável. |
| `backend/public/admin.html` | 3.299 | Seccionar markup somente com teste de IDs, ordem de scripts e CSP. |
| `backend/public/admin.css` | 10.226 | Separar estilos por painel após snapshots visuais; não contaminar este corte de JS. |
| `backend/public/social-studio.js` | 2.172 | UI Studio também concentra estado; planejar após `admin.js`. |
| `src/components/CheckoutPage.tsx` | 1.963 | Limite financeiro da UI; não alterar contrato agora. |
| `backend/db/postgresStore.js` | 1.727 | Snapshot e escritor de tabelas, lock e pós-commit no mesmo arquivo. |
| `backend/services/socialStudioService.js` | 1.133 | Já excede o orçamento recomendado para novo módulo. |
| `src/services/cinemaApi.ts` | 1.023 | Cliente de múltiplos domínios; mudanças exigem contrato HTTP. |
| `backend/services/paymentService.js` | 920 | Provedor sensível; evitar extração cosmética. |

`backend/public/jsQR.js` tem 10.102 linhas, mas é biblioteca vendorizada; tamanho não representa responsabilidade própria do Admin. A medição examina 517 arquivos fonte selecionados. `--files` lista todos por linhas; o resumo também mostra os maiores por bytes.

## Cobertura e lacunas antes da primeira extração

Há 125 arquivos de teste na raiz `tests/`, 68 scripts diretos e 8 specs E2E; o smoke principal PostgreSQL está em `scripts/smoke-tests.js`. Existem testes de catálogo/sessão, RBAC/2FA, origem, assentos, webhook MP, Point, reembolsos, Clube, e-mail, Studio e views Admin. O Mapa Inteligente declara cobertura **parcial**; `docs:coverage` não mede equivalência semântica. Faltam uma matriz completa método×rota×permissão/CSRF/status, failpoints de todos os ramos de estorno e respostas externas, contrato de origem/token de todos os callbacks, navegação E2E de cada modal/form do Admin, teste para a função duplicada de paginação e prova de limpeza de timers/WS ao trocar de painel. Os testes PostgreSQL destrutivos continuam restritos a `TEST_DATABASE_URL` e banco descartável identificado. Nenhum banco, VPS ou provedor foi acessado nesta auditoria.

O [plano progressivo](DEEP_MODULARIZATION_PLAN.md) trata essas lacunas como pré-condições por domínio. O [relatório consolidado](../RELATORIO_FINAL_REFATORACAO.md) e a [Fase 8](../FASE8_HOMOLOGACAO.md) separam prontidão técnica de homologação operacional.

## Validação desta etapa

`npm ci`, `npm run docs:modularization:baseline`, `npm run docs:check` (21 documentos), `npm run lint`, `npm run test:unit`, `npm run test:security:local` (25/25) e `npm run build` passaram no worktree isolado. O trecho final de `test:unit` registrou 42/49 cenários de e-mail aprovados e 7 PostgreSQL condicionais ignorados sem `TEST_DATABASE_URL`; outras suítes do comando passaram. Não foram executados smoke PostgreSQL destrutivo, E2E ou chamadas externas: esta mudança só acrescenta documentação, um medidor estático e seu comando npm. Isso não é homologação funcional dos próximos módulos.
