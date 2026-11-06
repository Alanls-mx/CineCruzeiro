# Preparação da modularização profunda do Admin

Branch `codex/cine-modularizacao-profunda`. Esta etapa audita o painel e protege seu ciclo de inicialização; não move formulários financeiros, não altera rotas nem exige build de frontend. O código-fonte prevalece sobre este mapa. As contagens são reproduzíveis com `node scripts/measure-modularization.mjs --summary`, `--symbols` e `--listeners`; os números de linha não são identificadores permanentes.

## Linha de base e fronteira do shell

| Medida | Antes | Após a guarda de inicialização |
| --- | ---: | ---: |
| `backend/public/admin.js` (linhas físicas) | 11.980 | 11.985 |
| Funções nomeadas/callbacks inferidos pelo parser | 564 / 910 | 564 / 911 |
| Campos diretos de `state` | 205 | 205 |
| Sítios estáticos de eventos/timers/conexões | 342 | 342 |
| `bindEvents` | 1.100 linhas | 1.100 linhas |

Esta fase **não é uma redução de linhas**. O alvo futuro é 2.000–3.500, exigindo transferir aproximadamente 8.485–9.985 linhas sem concentrá-las em outro arquivo. O shell deve conservar: `state` único, `API_BASE`, transporte `api`, autenticação/RBAC de apresentação, navegação, `renderAll`, composição dos módulos e registro único dos eventos. `initAdmin()` agora retorna a mesma Promise nas chamadas repetidas; a primeira mantém a ordem anterior: logo → `bindEvents` → controles de desempenho → bilheteria → `/api/admin/me`/2FA → conteúdo → restauração Point. O guard não cria timer, listener ou request novo.

Inventário AST: 533 declarações de função no nível do arquivo; 83 nomes de apresentação (`render`/`fill`/`format`), 44 de formulário/comando (`save`/`create`/`delete`/`update`/`upload`), 36 de navegação (`activate`/`set*Tab`/`change*Page`/`open`/`close`) e 18 de carga/polling (`load`/`fetch`/`poll`/`refresh`). São grupos heurísticos sobre nomes, não uma prova de pureza nem uma partição exaustiva. `bindEvents` contém 249 chamadas estáticas a `addEventListener`, inclusive dentro de loops; não significa 249 listeners ativos simultâneos. Renderizações como `renderManualSeatMap`, `renderConcessionCounterSale` e `renderTicketValidationResult` também ligam eventos a nós recriados; revisar o ciclo de substituição do DOM antes de extrair.

`state` combina dados carregados (`content`, `dashboard`, `payments`, `integrations`), seleção/filtros/paginação, rascunhos de filmes/sessões/salas, formulários de campanha, bilheteria e recursos vivos (`manualSeatRealtimeChannels`, timers Point, stream QR). Fora dele, `performanceLoading`, `performanceEventSource`, `performanceIntervalMs`, `performanceHistoryCache` e `emailCampaignResolutionTimer` são mutáveis no escopo do arquivo. O shell também expõe comandos legados em `window.*` para HTML dinâmico e scripts adjacentes; cada exportação precisa de consumidor comprovado antes de ser removida. A função `$` resolve IDs do DOM, e os módulos recebem `state` por referência, `api`, `$`, `adminCan` e comandos específicos em vez de importar `admin.js`.

## Contrato de carregamento existente

`admin.html` carrega `jsQR.js`, os 24 scripts locais abaixo, `admin.js` e então `social-studio.js`, sem bundler e sem handler HTML inline. Cada módulo publica uma API congelada em `window.CineAdminModules.<nome>` e também via CommonJS para testes. `admin.js` instancia as factories após todos os scripts de módulo; `social-studio.js` é um controlador posterior com estado/eventos próprios. A ordem, os IDs, `data-*` e a CSP (`script-src-attr 'none'`) são contrato. [Teste de composição](../../tests/admin-module-composition.test.mjs) verifica ordem, nomes, exportações e ausência de handlers inline.

| Módulo em `admin-modules/` | API consumida / papel | Efeito e ciclo atual |
| --- | --- | --- |
| `log-presentation.js` | `logPresentation`, funções de formatação | Apresentação pura; não registra evento. |
| `log-events.js` | `logEvents.bindLogEvents` | Binder de filtros/logs chamado por `bindEvents`; debounce em `state.logsSearchTimer`. |
| `ticket-finance-view.js` | `ticketFinanceView.createTicketFinanceView` | Render e comandos de GET/PUT/export; `bindEvents` da instância chamado uma vez pelo shell. |
| `customer-accounts-view.js` | `customerAccountsView.createCustomerAccountsView` | Render e CRUD de cliente via `api` injetada; PII/`users.manage`. |
| `team-accounts-view.js` | `teamAccountsView.createTeamAccountsView` | Render, formulário e comandos de equipe; presets apenas visuais; servidor mantém `users.manage`. Callback de clientes é tardio para preservar a composição sem ciclo. |
| `movie-sessions-view.js` | `movieSessionsView.createMovieSessionsView` | Render/paginação e editor com criação, edição, exclusão e confirmação de conflitos; o shell conserva `applySessionMutation`, programação global e registro de eventos. |
| `room-list-view.js` / `room-seat-editor.js` | Factories `createRoomListView` / `createRoomSeatEditor` | Lista e formulário de salas separados do editor de layout; API de sala só atualiza estado após resposta. `bindEvents` continua no shell. |
| `dashboard-view.js` | `dashboardView.createDashboardView` | Render/gráfico/dica; sem listener próprio permanente. |
| `performance-view.js` | `performanceView.createPerformanceView` | Render; SSE e controles permanecem no shell. |
| `club-view.js` | `clubView.createClubView` | Render do Clube; operações de crédito seguem no shell. |
| `concession-sales-view.js` | `concessionSalesView.createConcessionSalesView` | Render, consulta e abertura de pedido; refund e arquivamento injetados pelo shell. |
| `promotions-view.js` | `promotionsView.createPromotionsView` | Render, formulários e mutações via `api` injetada; permissões vêm do shell/servidor. |
| `ads-view.js` | `adsView.createAdsView` | Render, upload e mutações de anúncio via callbacks/API. |
| `concession-products-view.js` | `concessionProductsView.createConcessionProductsView` | Formulário e comandos de produto/estoque; vendas seguem separadas. |
| `session-schedule-view.js` | `sessionScheduleView.createSessionScheduleView` | Agenda, filtros, sugestão de horário, conflito e limpeza; listeners seguem presos a nós recriados. |
| `email-*` (quatro módulos) | Factories de modelo, editor, histórico e biblioteca | Formulário, prévia, comandos, filtros e modais de marketing; timer de resolução pertence ao editor, poll de histórico pertence à view. |
| `movie-catalog-events.js` | `movieCatalogEvents.bindMovieCatalogEvents` | Um binder de filtros e drag/drop chamado por `bindEvents`; sem disposer hoje. |
| `movie-catalog-view.js` / `movie-catalog-commands.js` | Factories `createMovieCatalogView` / `createMovieCatalogCommands` | Lista, assistente, edição e posição em módulos separados; comandos de criação, publicação e exclusão usam `api` injetada. Dependências cruzadas com sessões são callbacks tardios, sem novo estado global. |
| `session-ticket-actions.js` | `sessionTicketActions.createSessionTicketActionHandler` | Retorna handler delegado; o shell o chama dentro do clique global, sem registrar listener próprio. |

Interfaces para as próximas extrações: `createX({state, $, api, adminCan, formatters, commands})` recebe **o mesmo objeto `state`**, callbacks nomeados e somente as capacidades usadas. Métodos de apresentação recebem dados e retornam markup/atualizam um contêiner específico. Comandos assíncronos fazem o request por `api`, atualizam `state` após sucesso e pedem renderização. Um binder registra no máximo uma vez por ciclo do shell e retorna `dispose()` quando possuir listener, timer, stream ou socket; o shell guarda e chama esses disposers ao encerrar o ciclo. Módulos não importam `admin.js`, não criam outra cópia de `state` e não usam efeitos na avaliação do script. Isso é o **contrato proposto**, não uma afirmação de que todos os módulos já implementam `dispose`.

## Matriz de eventos e recursos

| Dono / entrada | Registro e comando | Limpeza observada | Risco e teste antes de extrair |
| --- | --- | --- | --- |
| Shell `initAdmin`/`bindEvents` | Delegação `document` (clique, input, tecla, foco, erro) e forms diretos; `bindAdminSubtabs`, uploads e controles responsivos | Página inteira; não há disposer global. Guarda de Promise impede segunda chamada de bind na mesma carga. | Clique/submit duplicado se um novo entrypoint rebinder; [E2E de ciclo](../../e2e/admin-session-actions.spec.js) mede registro e um GET por clique. |
| Filme/sessão/sala | `movieCatalogEvents`, formulário de filme, editor de sessão, layout de sala e seleção de poltrona | Modal/DOM recriado; listeners do binder não têm disposer. | Drag/drop, botão salvar ou edição duplicados; [E2E de sessão](../../e2e/admin-session-actions.spec.js), testes de catálogo/sala. |
| Equipe/conta/2FA | Forms e overlay registrados em `bindEvents`; `state.twoFactor*` | Fechamento do overlay; listeners vivem até sair da página. | Dupla alteração de senha/permissão; testes de conta/2FA, E2E de reabertura ainda faltante. |
| Bilheteria/Point | Formulário de venda e `state.pointPaymentTimer`; `stopPointPaymentPolling` cancela timeout, `restoreActivePointPayment` retoma no startup | Poll pode continuar fora da aba para acompanhar venda; não descartar sem preservar recuperação. | Cobrança/print duplicados; [E2E bilheteria](../../e2e/admin-box-office-realtime.spec.js), smoke Point. |
| Balcão/bomboniere | Formulário e `state.concessionCounterPaymentTimer`; `stopConcessionCounterPaymentPolling` cancela timeout | Acompanhamento pode persistir fora da aba. | Dupla venda, estoque ou impressão; testes financeiros e E2E dirigido antes de mover. |
| Mapa manual de poltronas | `WebSocket` por sessão, heartbeat, reconnect e pendências em `state.manualSeatRealtimeChannels` | `closeManualSeatRealtime` cancela timers, resolve pendências, libera lugares quando solicitado e fecha socket. | Hold perdido ou duplicado após navegação; E2E realtime e teste de reconexão. |
| Leitor QR | `getUserMedia`, `BarcodeDetector` ou `jsQR`, intervalos e stream em `state.qr*` | `stopQrReader` cancela timers, para tracks; troca de painel/aba chama stop. | Câmera ativa ou validação duplicada; falta E2E de permissão negada, reabertura e troca rápida. |
| Desempenho/logs | `setupPerformanceControls` registra `visibilitychange`; `EventSource` em escopo de arquivo; `logEvents` registra filtros e debounce | `stopPerformanceStream` fecha SSE em aba oculta/saída do painel. Listener de visibilidade e binder de logs ficam até descarregar a página; debounce não é limpo ao sair. | SSE duplo/busca obsoleta; [teste de módulo](../../tests/admin-performance-module.test.mjs), ciclo E2E. |
| E-mail/campanhas | Formulários em `bindEvents`; `state.emailCampaignHistoryTimer`, busca e `emailCampaignResolutionTimer` | Debounces anteriores são cancelados na nova busca/render; timer de história não é cancelado por toda troca de painel. | Poll de campanha obsoleta/submit duplicado; [E2E campanha](../../e2e/admin-email-campaign.spec.js) e teste de teardown faltante. |
| Desktop WebView2 | `window.cineDesktop.checkPrinter/printUrl`; evento global `cine-desktop-print-result` registrado na carga do script | Listener dura a página; IDs de job correlacionam resultado. | Impressão repetida ou resultado atribuído a venda errada; [teste de desktop](../../scripts/desktop-shell-tests.js), E2E com bridge simulada. |
| Social Studio | `social-studio.js` liga mensagem de iframe, resize e autosave após `admin.js` | Usa timers próprios; ciclo de desmontagem não é unificado com o shell. | Mensagem fora de origem/preview obsoleto; testes Studio existentes, auditoria própria antes da extração. |

Os 342 sítios estáticos incluem chamadas de limpeza e timers em funções distintas; não equivalem a 342 registros permanentes. `window.addEventListener('cine-desktop-print-result')` é top level e a inicialização idempotente **não** o registra novamente. `setupPerformanceControls` usa propriedades `onclick` atribuídas por JS, compatíveis com a CSP; não inserir `onclick=` no HTML.

## Autorização, efeitos e integrações

`adminCan` lê `state.adminUser.effectivePermissions` ou presets e trata `owner/master` como autoridade de apresentação. `applyRbacVisibility` oculta `data-permission`, painéis e botões; módulos recebem `adminCan` ou callbacks guardados. Isso **não substitui** `ensureAdmin`/`ensureAdminAction` no backend. Antes de extrair um comando, mapear método/rota/permissão em [endpoints](endpoints.md), escritor em [persistência](persistence.md) e momento de commit em [transações](transactions.md). Em particular, Point, refund, Clube e vendas não podem sair de `admin.js` só por parecerem lógica de view.

O aplicativo Windows injeta `window.cineDesktop` via WebView2; `checkPrinter` e `printUrl` trafegam pelo protocolo da bridge e a resposta volta como `cine-desktop-print-result`. O navegador usa fallback de janela/print onde previsto. O leitor usa `getUserMedia` apenas em contexto seguro, tenta `BarcodeDetector` e recorre a `jsQR`; `stopQrReader` deve continuar obrigatório ao sair da área de validação. Nenhum desses contratos foi alterado nesta etapa. `admin.css` (10.226 linhas) e `admin-premium.css` (2.879) definem o layout por classes/IDs usados nas views; futuras extrações JS não devem renomear hooks sem teste visual/responsivo.

## Sequência de extração e critérios

1. **Shell e estado:** documentar proprietários de grupos de `state`; extrair apenas funções puras de formatação com fixtures, mantendo o objeto único e a ordem de `renderAll`. Não criar um segundo store global.
2. **Views já separadas:** medir entradas/saídas de cada factory; mover renderização ainda concentrada por domínio, módulos de até ~600 linhas. Testar DOM/markup, permissão visível, paginação e estado após reload.
3. **Formulários não financeiros:** conta/equipe, filme/sessão/sala, marketing e campanhas em commits pequenos. Cada controller recebe `api`, `state` e callbacks, mantém payload/feedback e possui teste de submit único, erro, reabertura e navegação.
4. **Eventos:** migrar binder junto com seu domínio. `bindEvents` continua o único ponto de composição e chama cada binder uma vez; novo binder retorna disposer se criar recursos. Testar alternância de painéis, modal repetido e ausência de listeners/timers acumulados.
5. **Câmera, WebSocket, Point e financeiro:** só após testes de negação de câmera, reconnect/hold, impressão, pagamento pendente e repetição de comando. Preservar `clientRequestId`, correlação de print, saldo/estoque e autoridade do servidor.

O alvo final do Admin depende destas etapas posteriores. A presente guarda e os testes protegem a composição; não demonstram ainda equivalência de todos os formulários, lifecycle de cada recurso nem prontidão operacional. [Relatório consolidado](../RELATORIO_FINAL_REFATORACAO.md) e [checklist da Fase 8](../FASE8_HOMOLOGACAO.md) continuam separados da medição de linhas.

## Avanço de catálogo e marketing

A etapa seguinte extraiu equipe, filmes, sessões, salas, agenda global, catálogo de produtos e campanhas para módulos coesos. A medição passou de 11.985 para 8.925 linhas físicas em `admin.js` (−3.060). O [resultado da etapa](ADMIN_MODULARIZATION_STAGE1_RESULT.md) relaciona cada módulo a endpoint, permissão, persistência, teste e risco residual. A meta de 7.000–9.000 linhas foi atingida; a meta final de 2.000–3.500 permanece para as próximas etapas. Os candidatos prioritários são o registro de eventos do shell, interfaces de bilheteria/Point, Clube e integrações, todos dependentes de testes de ciclo de vida e segurança antes de extração.

## Evidência desta etapa

`node --test tests/admin-*.test.mjs` aprovou 58 testes, ignorou 3 que dependem de PostgreSQL e não apresentou falhas. Uma asserção antiga de layout ainda procurava o markup de sessão em `admin.js`; o markup já pertence a `movie-sessions-view.js`. O teste passou a ler esse módulo, preservando a mesma regex e os mesmos critérios visuais. `npm run test:characterization` aprovou 12 testes, incluindo a nova verificação de scripts e APIs. `npx playwright test e2e/admin-session-actions.spec.js` aprovou os dois casos, incluindo a chamada repetida de `initAdmin`, alternância de painel, estabilidade da contagem de listeners e um único GET no botão de relatório. `npm run test:unit`, `npm run test:security:local`, `npm run lint`, `npm run build` e `npm run docs:check` passaram. `npm run test:e2e` passou 19/19. A primeira execução com um caso E2E adicional de login teve 19 aprovações e falha de rate limit no 20º; incorporar a caracterização ao teste existente preservou o limite de tentativas e a suíte final passou. Os três casos PostgreSQL ignorados no lote Admin não foram executados nesta etapa, pois não houve mudança de persistência ou transação.
