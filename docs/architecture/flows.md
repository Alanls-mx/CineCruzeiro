# Fluxos transversais iniciais

As setas descrevem o caminho de manutenção. Elas não representam todos os ramos de erro. Os controles de origem, sessão, CSRF, permissões e rate limit ficam no [dispatcher](../../backend/server.js); confirme a regra por método antes de editar.

## Compra de ingressos

Ação: seleção em [CheckoutPage](../../src/components/CheckoutPage.tsx) → [cinemaApi.createCheckoutPayment](../../src/services/cinemaApi.ts) → proxy [Next API](../../src/app/api/[...path]/route.ts) → `POST /api/payments/pix` ou `POST /api/payments/card` em [server.js](../../backend/server.js) → reserva/validações no dispatcher e [sessionSeatAvailability](../../backend/services/sessionSeatAvailability.js) → [paymentService](../../backend/services/paymentService.js) → `orders`, `payments`, `tickets` em [schema](../../backend/db/migrations/001_init.sql) → confirmação por webhook assinado ou retorno autorizado → `finalizePaidOrder` e [fila de e-mail](operations.md). `POST /api/orders` está **desativado (410)**; a função `recordTicketOrder` ainda existe em `cinemaApi.ts`, mas não possui chamadas no código rastreado. Testes: [smoke](../../scripts/smoke-tests.js), [E2E](../../e2e/checkout-payment.spec.js), [webhook](../../scripts/mercado-pago-webhook-tests.js). Não alterar HMAC, idempotência ou conciliação apenas para mover código.

## Créditos do Clube

Ação: [CheckoutPage](../../src/components/CheckoutPage.tsx) → `POST /api/checkout/club-credit` em [server.js](../../backend/server.js) → identidade do cliente, elegibilidade e saldo → funções de crédito do Clube no servidor e [clubDomainService](../../backend/services/clubDomainService.js) → `subscriptions`, créditos, uso, pedido e ingressos via [postgresStore](../../backend/db/postgresStore.js) → e-mail após commit → HTTP 201 após persistência. Cancelamento devolve créditos na transação própria. Testes: [smoke](../../scripts/smoke-tests.js), [concorrência](../../scripts/postgres-concurrency-tests.js), [E2E](../../e2e/club-credit.spec.js).

## Cancelamento de pedidos

Ação: painel [admin.js](../../backend/public/admin.js) → `DELETE /api/orders/:id` em [server.js](../../backend/server.js) → permissão e motivo → [orderRefundService](../../backend/services/orderRefundService.js) e restauração de estoque/crédito conforme o pedido → `orders`, `tickets`, créditos e pagamentos em [PostgreSQL](../../backend/db/postgresStore.js) → resposta depois do commit. Testes: [smoke](../../scripts/smoke-tests.js), [concessões](../../tests/concession-cancellation.test.mjs). Reembolso externo é uma operação separada; conferir estados intermediários.

## Entrega de ingressos por e-mail

Ação: pedido pago em `finalizePaidOrder` → `ticketEmailRequested` no pedido → [trigger 051](../../backend/db/migrations/051_ticket_email_jobs.sql) na mesma transação → [ticketEmailJobRepository](../../backend/repositories/ticketEmailJobRepository.js) reivindica o trabalho → [ticketEmailWorker](../../backend/services/ticketEmailWorker.js) chama entrega em [server.js](../../backend/server.js) / [emailService](../../backend/services/emailService.js) → estado `emailDeliveredAt` e job concluído. Reenvio manual: `POST /api/orders/:id/resend-ticket-email`. Testes: [unidade](../../tests/ticket-email-worker.test.mjs), [PostgreSQL](../../tests/database-persistence-postgres.test.mjs). Limites em [operação](operations.md).

## Validação de ingressos

Ação: leitor no [admin.js](../../backend/public/admin.js) → `POST /api/tickets/validate` em [server.js](../../backend/server.js) → permissão `tickets.validate`, sessão e QR → `validateTicket` → `tickets` em [PostgreSQL](../../backend/db/postgresStore.js) → resposta após commit. Testes: [segurança](../../tests/ticket-security.test.mjs), [smoke](../../scripts/smoke-tests.js).

## Publicação de filmes e sessões

Ação: [admin.js](../../backend/public/admin.js) → `/api/movies`, `/api/movies/:id/sessions`, `/api/rooms` em [movieCatalogHandler](../../backend/services/movieCatalogHandler.js) e [venueConfigurationHandler](../../backend/services/venueConfigurationHandler.js) → permissões centrais em [server.js](../../backend/server.js) → políticas de publicação, conflito e limpeza em [moviePublicationPolicy](../../backend/services/moviePublicationPolicy.js), [sessionRoomConflictService](../../backend/services/sessionRoomConflictService.js) → [movieRepository](../../backend/repositories/movieRepository.js) e [sessionRepository](../../backend/repositories/sessionRepository.js) → catálogo público. Testes: [publicação](../../tests/movie-publication-policy.test.mjs), [conflitos](../../tests/session-room-conflict.test.mjs), [agenda E2E](../../e2e/admin-session-actions.spec.js).

## Catálogo comercial

Ação: cliente autorizado → rota de catálogo em [server.js](../../backend/server.js) → token/CORS em [commercialCatalogAccessPolicy](../../backend/services/commercialCatalogAccessPolicy.js) → [commercialCatalogPresenter](../../backend/services/commercialCatalogPresenter.js) → filmes, sessões, ofertas e bomboniere em [PostgreSQL](../../backend/db/postgresStore.js) → resposta filtrada. Testes: [HTTP](../../tests/commercial-catalog-http.test.mjs), [integração](../../tests/commercial-catalog-integration.test.mjs).

## Campanhas automáticas

Ação: [painel](../../backend/public/admin.js) ou automação autenticada → `/api/admin/social-studio/automation/campaigns` em [server.js](../../backend/server.js) → [CampaignOrchestrator](../../backend/services/social-studio/automation/orchestrator.js) → [repositório](../../backend/repositories/socialStudioAutomationRepository.js) → renderização e QA → resultado persistido e consulta posterior. A execução é agendada após commit; recuperação paginada reivindica no máximo dois trabalhos simultâneos. Testes: [unidade](../../tests/social-studio-automation.test.mjs), [transação](../../tests/database-persistence-postgres.test.mjs). Ver [operação](operations.md).

## Clientes e equipe

Ação administrativa: [customer-accounts-view](../../backend/public/admin-modules/customer-accounts-view.js) → registro de eventos em [admin.js](../../backend/public/admin.js) → `/api/users` em [server.js](../../backend/server.js) → autenticação, 2FA, origem e `users.manage` → [userRepository](../../backend/repositories/userRepository.js) / tabela `users` → resposta e auditoria. Busca administrativa: `GET /api/admin/customers` → [adminCustomerSearchService](../../backend/services/adminCustomerSearchService.js) → resposta sanitizada. Cadastro público parte de [AccountModal](../../src/components/AccountModal.tsx) e tem validação de identidade própria; não confundir papéis. Testes: [permissões](../../tests/admin-permissions.test.mjs), [clientes UI](../../tests/admin-customer-accounts-view.test.mjs), [busca](../../tests/admin-customer-search.test.mjs).

## Edição de salas

Ação: [admin.js](../../backend/public/admin.js) → `PUT /api/rooms/:id` → `rooms.edit` no dispatcher → [venueConfigurationHandler](../../backend/services/venueConfigurationHandler.js) → [roomRepository](../../backend/repositories/roomRepository.js) → `rooms` → resposta após escrita do repositório. Intervalo de limpeza é consumido por [sessionRoomConflictService](../../backend/services/sessionRoomConflictService.js) na edição de sessões. Testes: [conflitos](../../tests/session-room-conflict.test.mjs), [mapa](../../tests/admin-session-seat-map.test.mjs).

## Bilheteria e bomboniere

Ação presencial: [admin.js](../../backend/public/admin.js) → `POST /api/box-office/sales`, `POST /api/admin/concession-counter-sales` ou `/api/tickets/manual` → autenticação administrativa e `box_office.sell` (cortesia exige `box_office.courtesy`) → orquestração ainda em [server.js](../../backend/server.js) → pedidos/pagamentos/ingressos/estoque → resposta, impressão Point e eventual entrega de ingressos. Cadastro de produto: `POST /api/concessions` → [commercialCatalogHandler](../../backend/services/commercialCatalogHandler.js) → [concessionRepository](../../backend/repositories/concessionRepository.js). Testes: [smoke](../../scripts/smoke-tests.js), [finanças](../../tests/concession-finance.test.mjs), [Point](../../scripts/mercado-pago-point-tests.js). **Limite de commit pendente de correção:** algumas respostas de bilheteria/Point podem ocorrer dentro da transação global; ver [auditoria](transactions.md).
