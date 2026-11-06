# Índice técnico de símbolos

Índice **curado**, não completo. Cada símbolo abaixo é uma declaração real conferida no código e validada sintaticamente por `npm run docs:check`. Uma declaração existir não comprova que todas as chamadas e efeitos estejam documentados. Referências de dependência são relações verificadas nos módulos/handlers, não inferências de nomes.

| Símbolo | Arquivo | Função / impacto |
| --- | --- | --- |
| `createCustomerAccountsView` | [customer-accounts-view.js](../../backend/public/admin-modules/customer-accounts-view.js) | Lista e formulário de clientes no painel; estado compartilhado com admin.js. |
| `createMovieSessionsView` | [movie-sessions-view.js](../../backend/public/admin-modules/movie-sessions-view.js) | Renderização e paginação das sessões de um filme, sem listeners próprios. |
| `createRoomListView` | [room-list-view.js](../../backend/public/admin-modules/room-list-view.js) | Lista e paginação de salas; eventos e formulário permanecem em admin.js. |
| `createEmailCampaignPresenter` | [emailCampaignPresenter.js](../../backend/services/emailCampaignPresenter.js) | Projeção pública/detalhada da campanha, com normalizador de marca injetado. |
| `adminHasPermission` | [adminPermissionService.js](../../backend/services/adminPermissionService.js) | Verificação granular de permissões; chamada por `ensureAdmin` em server.js. |
| `archiveExpiredCoupons` | [couponLifecycleService.js](../../backend/services/couponLifecycleService.js) | Ciclo de validade de cupom. |
| `findSessionRoomConflicts` | [sessionRoomConflictService.js](../../backend/services/sessionRoomConflictService.js) | Sobreposição de sessões e intervalo de limpeza. |
| `roomCleanupMinutes` | [sessionRoomConflictService.js](../../backend/services/sessionRoomConflictService.js) | Normaliza intervalo configurado por sala. |
| `sessionSeatAvailability` | [sessionSeatAvailability.js](../../backend/services/sessionSeatAvailability.js) | Poltronas vendidas versus temporariamente reservadas. |
| `reserveCredits` | [clubDomainService.js](../../backend/services/clubDomainService.js) | Reserva de crédito do Clube; impacto financeiro. |
| `releaseOrderCredits` | [clubDomainService.js](../../backend/services/clubDomainService.js) | Devolução de créditos em cancelamento/expiração. |
| `verifyWebhookRequest` | [paymentService.js](../../backend/services/paymentService.js) | Validação da origem/assinatura do webhook. |
| `createMercadoPagoOrderPayment` | [paymentService.js](../../backend/services/paymentService.js) | Criação de Order no provedor; idempotência e metadados. |
| `CampaignOrchestrator` | [orchestrator.js](../../backend/services/social-studio/automation/orchestrator.js) | Fila, estágios, renderização e recuperação de campanhas. |
| `SocialStudioAutomationRepository` | [socialStudioAutomationRepository.js](../../backend/repositories/socialStudioAutomationRepository.js) | Claim/heartbeat/fencing persistente. |
| `createTicketEmailWorker` | [ticketEmailWorker.js](../../backend/services/ticketEmailWorker.js) | Drenagem, backoff e conclusão de jobs. |
| `createTicketEmailJobRepository` | [ticketEmailJobRepository.js](../../backend/repositories/ticketEmailJobRepository.js) | Lease PostgreSQL e atualização condicional da entrega. |
| `claimPointCreation` | [pointCreationCoordinator](../../backend/services/pointCreationCoordinator.js) | Reivindica a intenção Point sob lock PostgreSQL; impede envio concorrente durante o lease. |
| `markPointRequestSent` | [pointCreationCoordinator](../../backend/services/pointCreationCoordinator.js) | Confirma o registro pré-envio antes do POST ao provedor; falha no commit impede a chamada. |
| `attemptPointCreation` | [pointCreationCoordinator](../../backend/services/pointCreationCoordinator.js) | Valida terminal/conta e reusa a referência e chave persistidas fora da transação. |

`backend/server.js` possui funções de orquestração e muitos efeitos entre domínios. Seus símbolos ainda não formam API interna estável; para uma rota, comece pelo [catálogo](endpoints.md) e siga as chamadas reais. Para módulos do painel, o registro único de eventos permanece em [admin.js](../../backend/public/admin.js).
