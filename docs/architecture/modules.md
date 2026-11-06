# Índice de módulos extraídos

O [server.js](../../backend/server.js) ainda faz roteamento, autenticação, autorização, CSRF e tratamento central de erros. Os handlers abaixo recebem dependências; não devem importá-lo de volta.

Os arquivos públicos, trailers, imagens, uploads e a seleção do shell Admin são servidos por [staticAssetHandler](../../backend/services/staticAssetHandler.js), composto no `server.js` com armazenamento, leitura do banco, autenticação Admin e resposta já existentes. O módulo não cria sessão nem escreve no banco. [Caracterização HTTP](../../tests/static-http-contract-characterization.test.mjs). Risco: exposição de arquivo ou shell por mudança de caminho/autenticação; a decisão de encaminhar a rota permanece no servidor.

Downloads do app desktop são servidos por [desktopUpdateHandler](../../backend/services/desktopUpdateHandler.js), com diretório público, verificação de caminho, resposta e cabeçalhos injetados. O rate limit e a posição da rota continuam no dispatcher; não há persistência nem efeito externo. [Teste do handler](../../tests/desktop-update-handler.test.mjs). Risco: caminho fora do diretório ou mudança no cache do manifesto/binário.

Fase 13.1: [db-migrate.js](../../scripts/db-migrate.js) invoca [guarded-migration.js](../../scripts/guarded-migration.js) somente com `--guarded-pilot`; valida identidade, origem, role, ownership, release, historico e esquema antes de DDL. [start.js](../../backend/start.js) seleciona explicitamente `quiescent` ou `normal`; [maintenanceServer.js](../../backend/maintenanceServer.js) nao importa o servidor operacional. Testes: [guard PG](../../scripts/postgres-guard-tests.js), [guard unitario](../../tests/guarded-migration.test.mjs) e [pausa](../../tests/maintenance-startup.test.mjs). Risco: a release antiga e os jobs in-flight nao sao drenados por estes modulos.

Fase 13.2: [ensaio sintético de proxy](../../scripts/phase13-proxy-isolation-test.mjs) executa Nginx em contêiner para verificar precedência do corte por prefixo e ausência de impacto em rotas vizinhas. Não lê configuração da VPS, não mede dreno nem implementa pausa operacional; ver [Portão D](../FASE13_2_PORTAO_D_CORTE_DRENO.md).

Na Fase 9, a orquestração da intenção Point (`claimPointCreation`, `markPointRequestSent`, `attemptPointCreation`) permanece em `server.js`; [cardTerminalProvider](../../backend/services/cardTerminalProvider.js) continua responsável pela API externa. Não foi criada uma segunda máquina de estados ou uma extração estrutural ampla. O [ensaio de restauração](../../scripts/postgres-backup-restore-test.js) é um script de teste, não um worker operacional. A [segunda instância de smoke](../../scripts/point-smoke-second-instance.js) usa o mesmo PostgreSQL descartável e um provedor simulado; não é um processo de produção.

Na Fase 11, `cardTerminalProvider` limita a descricao da Order a 150 caracteres e compoe a impressao com nome de cinema recebido de `server.js`, sem marca fixa no modulo compartilhado. [Teste Point](../../scripts/mercado-pago-point-tests.js); [relatorio do piloto](../FASE11_HOMOLOGACAO_PILOTO.md). Nao houve endpoint, permissao ou escritor novo.

| Responsabilidade | Módulo | Verificação |
| --- | --- | --- |
| Indicadores administrativos | [adminDashboardService](../../backend/services/adminDashboardService.js) | [teste do dashboard](../../tests/admin-dashboard-module.test.mjs) |
| Filmes e sessões | [movieCatalogHandler](../../backend/services/movieCatalogHandler.js) | [publicação](../../tests/movie-publication-policy.test.mjs) |
| Salas, limpeza e tipos de ingresso | [venueConfigurationHandler](../../backend/services/venueConfigurationHandler.js) | [conflitos](../../tests/session-room-conflict.test.mjs) |
| Bomboniere, promoções, anúncios | [commercialCatalogHandler](../../backend/services/commercialCatalogHandler.js) | [catálogo HTTP](../../tests/commercial-catalog-http.test.mjs) |
| Catálogo comercial público | [commercialCatalogPresenter](../../backend/services/commercialCatalogPresenter.js), [accessPolicy](../../backend/services/commercialCatalogAccessPolicy.js) | [integração](../../tests/commercial-catalog-integration.test.mjs) |
| Logs administrativos | [adminLogsHandler](../../backend/services/adminLogsHandler.js) | [apresentação UI](../../tests/admin-log-events.test.mjs) |
| Leitura administrativa do Clube | [adminSubscriptionPresenter](../../backend/services/adminSubscriptionPresenter.js) | [teste do presenter](../../tests/admin-subscription-presenter.test.mjs) |
| Busca administrativa de clientes | [adminCustomerSearchService](../../backend/services/adminCustomerSearchService.js) | [teste de busca](../../tests/admin-customer-search.test.mjs), [smoke HTTP](../../scripts/smoke-tests.js) |
| Apresentação pública de poltronas | [publicSessionSeatPresenter](../../backend/services/publicSessionSeatPresenter.js) | [teste do presenter](../../tests/public-session-seat-presenter.test.mjs), [teste HTTP](../../tests/public-seat-state-http.test.mjs) |
| Projecao de campanhas de e-mail | [emailCampaignPresenter](../../backend/services/emailCampaignPresenter.js) | [teste de campos publicos/detalhados](../../tests/email-campaign-presenter.test.mjs) |
| Entrega de ingressos | [ticketEmailWorker](../../backend/services/ticketEmailWorker.js), [ticketEmailJobRepository](../../backend/repositories/ticketEmailJobRepository.js) | [unidade](../../tests/ticket-email-worker.test.mjs), [PostgreSQL](../../tests/database-persistence-postgres.test.mjs) |
| Identidade visual da classe Google Wallet | [googleWalletPassLayoutService](../../backend/services/googleWalletPassLayoutService.js) recebe nome da instalacao e URL do logo; [server.js](../../backend/server.js) verifica a marca antes de consultar o Google | [teste Wallet](../../tests/google-wallet-integration.test.mjs); nenhuma chamada externa faz parte do teste local |
| Campanhas automáticas Studio | [CampaignOrchestrator](../../backend/services/social-studio/automation/orchestrator.js), [repositório](../../backend/repositories/socialStudioAutomationRepository.js) | [teste](../../tests/social-studio-automation.test.mjs) |

O [admin.html](../../backend/public/admin.html) carrega módulos locais antes de [admin.js](../../backend/public/admin.js). `bindEvents` continua o registro único de eventos; módulos recebem estado, DOM e comandos explicitamente.

| Responsabilidade do painel | Módulo | Verificação |
| --- | --- | --- |
| Dashboard | [dashboard-view](../../backend/public/admin-modules/dashboard-view.js) | [teste](../../tests/admin-dashboard-module.test.mjs) |
| Telemetria | [performance-view](../../backend/public/admin-modules/performance-view.js) | [teste](../../tests/admin-performance-module.test.mjs) |
| Clube | [club-view](../../backend/public/admin-modules/club-view.js) | [teste](../../tests/admin-club-module.test.mjs) |
| Vendas bomboniere | [concession-sales-view](../../backend/public/admin-modules/concession-sales-view.js) | [teste](../../tests/admin-concession-sales-view.test.mjs) |
| Cupons | [promotions-view](../../backend/public/admin-modules/promotions-view.js) | [teste](../../tests/admin-promotions-view.test.mjs) |
| Anúncios | [ads-view](../../backend/public/admin-modules/ads-view.js) | [teste](../../tests/admin-ads-view.test.mjs) |
| Eventos de filmes | [movie-catalog-events](../../backend/public/admin-modules/movie-catalog-events.js) | [teste](../../tests/admin-movie-catalog-events.test.mjs) |
| Ações de sessões e ingressos | [session-ticket-actions](../../backend/public/admin-modules/session-ticket-actions.js) | [teste](../../tests/admin-session-ticket-actions.test.mjs) |
| Logs | [log-presentation](../../backend/public/admin-modules/log-presentation.js), [log-events](../../backend/public/admin-modules/log-events.js) | [teste](../../tests/admin-log-events.test.mjs) |
| Repasse de bilheteria | [ticket-finance-view](../../backend/public/admin-modules/ticket-finance-view.js) | [teste](../../tests/admin-ticket-finance-view.test.mjs) |
| Contas de clientes | [customer-accounts-view](../../backend/public/admin-modules/customer-accounts-view.js) | [teste](../../tests/admin-customer-accounts-view.test.mjs) |
| Lista de sessões do filme | [movie-sessions-view](../../backend/public/admin-modules/movie-sessions-view.js) | [teste](../../tests/admin-movie-sessions-view.test.mjs) |
| Lista de salas | [room-list-view](../../backend/public/admin-modules/room-list-view.js) | [teste](../../tests/admin-room-list-view.test.mjs) |

Próximos candidatos, ainda **não extraídos**: outras consultas administrativas do Clube, gestão de clientes, formulários de sessão e grupos de listeners do painel. Auditar dependências e cobertura antes de mover.
