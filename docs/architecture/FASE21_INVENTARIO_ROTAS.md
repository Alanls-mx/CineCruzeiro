# Fase 21 — inventário do dispatcher e de `server.js`

**Revisão auditada:** `715839fce442dd59d0438ff88b418cee0b5f0b31`, branch `codex/cine-backend-finalizacao`, derivada do HEAD publicado de `codex/cine-modularizacao-profunda`. A auditoria é estática e local. O código é a fonte de verdade; os números de posição abaixo são identificadores de ordem **desta revisão**, não referências permanentes para outros módulos.

## Escopo e medição reproduzível

`node scripts/measure-modularization.mjs --summary` mediu `backend/server.js` em **13.529 linhas físicas / 660.183 bytes** e `backend/public/admin.js` em **3.421 linhas**, sem alteração no Admin. `handleApi` ocupa **5.636 linhas**; o corpo possui **202 instruções de primeiro nível**, das quais **154 são `if`**, na ordem reproduzida ao fim deste documento por `node scripts/fase21-route-snapshot.mjs --markdown`. O [relatório estático](MODULARIZATION_CHARACTERIZATION_REPORT.md) conta 229 predicados candidatos (inclui handlers separados), 124 literais de caminho distintos e só 32 pares método/caminho verificados manualmente em `endpoints.md`. Esses números não são a quantidade de rotas alcançáveis.

O [relatório final anterior](../RELATORIO_FINAL_MODULARIZACAO_PROFUNDA.md), o [resultado backend](BACKEND_MODULARIZATION_RESULT.md), o [mapa financeiro](FINANCIAL_TRANSACTION_MAP.md), o [relatório de extrações financeiras](FINANCIAL_EXTRACTION_REPORT.md), os [limites transacionais](transactions.md) e a [matriz de cobertura](modularization-coverage.json) foram usados para confrontar o código. Documentação histórica não substitui o predicado executado atualmente.

### Ordem real dos portões

1. `http.createServer` cria `requestContext`, instala observação de `finish`, registra o sinal de ataque e devolve `410 MODULE_REMOVED` para a antiga família WhatsApp. Requests não `/api/` seguem para estáticos/404. O log de conclusão pode gravar `system_logs` **após** a resposta mesmo em GET; chamar uma rota de leitura de “sem efeito” refere-se ao fluxo de negócio, não à telemetria.
2. Em `handleApi`, `OPTIONS` vem primeiro; `/api/commercial/catalog` pode ler configuração para CORS. Health (`GET /api/health`, `/live`, `/ready`) vem depois, com `200` ou `503` e `no-store`, antes de rate limit. Rate limit roda uma vez por request por `req.rateLimitChecked`: `429 RATE_LIMITED` com `Retry-After` e `RateLimit-Policy`. Webhooks e health não entram nesse rate limiter. Update desktop é despachado antes da leitura normal de banco/origem.
3. O dispatcher calcula `repositoryMutationRoute` e as exceções self-managed para exclusão de pedidos, arquivo de venda, validação, atribuição Clube, bilheteria, cancelamento Point e reembolsos. Para a mutação Admin PostgreSQL comum, recursa uma vez dentro de `withCriticalMutation` com `context.adminMutationLocked`. `req.commitResponseAfterMutation` e `req.repositoryMutation` são parte do contrato de resposta/commit. **Não** mover a seleção do wrapper para dentro de um handler de domínio.
4. `customerMutationOriginAllowed` precede `readDb`. Cookie de cliente exige origem administrativa aceita; login/cadastro no browser têm regra própria. Rejeição: `403 CUSTOMER_CSRF_BLOCKED`. `readDb({trackChanges: method !== 'GET' && method !== 'HEAD'})` vem antes de tokens Studio/e-mail e do login Admin. Uma futura leitura adiada altera ordem de falha e efeitos de cache.
5. Token Bearer de `/api/email-automation/*` e `/api/studio/*` é conferido antes das rotas dessas famílias (`401` se inválido, `503` se não configurado). Catálogo comercial exige token próprio, com `401/404`, CORS, cache e headers de depreciação quando token vai na query. Login/2FA/logout/me Admin e métrica pública de anúncio antecedem `ensureAdmin`.
6. `ensureAdmin` é executado **uma vez** no ponto atual. Só caminhos identificados por `adminAuthRequired` requerem cookie Admin. A ordem interna é sessão (`401 ADMIN_AUTH_REQUIRED`), exigência de 2FA (`428 ADMIN_2FA_SETUP_REQUIRED`), permissão (`403 ADMIN_FORBIDDEN`), origem de mutação (`403 ADMIN_CSRF_BLOCKED`), associação de `req.adminUser`/snapshot. `requiredAdminPermission` escolhe a permissão por caminho **e método**; algumas rotas têm `ensureAdminAction` adicional (por exemplo, `orders.refund`, `orders.cancel`, `box_office.courtesy`). Rotas públicas posteriores só passam porque `adminAuthRequired` as exclui.
7. Os `if` seguintes são testados sequencialmente até `return`; grupos de caminhos se intercalam. Uma correspondência de regex ampla (por exemplo, `/api/admin/email/campaigns/:id/:action`) pode capturar caminho antes do handler seguinte. Fallback final é `404 {"error":"Rota nao encontrada"}`. Erros lançados passam pelo `publicApiError` do `http.createServer`, com corpo `error.code/message/requestId` e `detail` apenas fora de produção. Handlers podem responder diretamente com PDF/CSV/imagem/redirect, não só via `sendJson`.

**Rate limits específicos atuais:** login Admin/cliente, 2FA, cadastro, recuperação, e-mail, OAuth, eventos, pagamentos, assinatura, cupom, transferência e artefatos de ingresso, validação, uploads, relatórios, catálogo comercial, lookup externo e update desktop; além do bucket global de API e das famílias de mutação Admin/cliente. O bloqueio progressivo de login por IP/e-mail é uma segunda política. Cada linha abaixo herda os buckets que correspondem ao método/caminho; o fluxo financeiro mantém também a idempotência de negócio.

### Famílias na ordem do código

`A` = consulta de negócio sem mutação intencional; `B` = administração não financeira; `C` = mutação local; `D` = efeito externo/arquivo/fila; `E` = financeiro crítico; `F` = autenticação especial ou webhook. Uma família pode ter mais de uma classe. A coluna de status contém **códigos literais encontrados no bloco**, não todos os erros dinâmicos/lançados. O contrato exato exige snapshot e teste HTTP.

| Ordem das instruções | Método e caminho, na ordem dentro da família | Classe; acesso e rate limit | Dono de estado, commit e efeito | Contrato/risco e cobertura atual |
| --- | --- | --- | --- | --- |
| 2–20 | `OPTIONS` API; `GET /api/health[/live\|/ready]`; `GET /api/desktop/update/*`; portões comuns | A/D; sem sessão Admin; health isento, desktop bucket próprio | Health pode consultar readiness PostgreSQL; update serve arquivo; wrapper/transação e origem escolhidos antes das demais rotas | `204` OPTIONS, `200/503` health, `429/403` globais. `tests/infrastructure-routes.test.mjs`, `tests/maintenance-startup.test.mjs`; falta matriz de precedência de todos os métodos |
| 21–29 | `GET /api/email-automation/context`; `POST /api/email-automation/campaigns`; `GET /api/studio/context`; `POST /api/studio/campaigns/generate`; `GET /api/studio/campaigns/:uuid`; `GET /api/commercial/catalog` | A/C/D/F; Bearer de automação ou token de catálogo, bucket Studio/catálogo | Campanhas em `emailCampaignRepository`, Studio no orquestrador; envio/worker posterior; catálogo lê settings | `200/201/202`, `401/404/503`; cache/CORS e idempotência. `tests/email-campaign-reliability.test.mjs`, `tests/social-studio-automation.test.mjs`, `tests/commercial-catalog-integration.test.mjs`; falta HTTP de token inválido+commit+replay |
| 30–35 | `POST /api/admin/login`, `/login/2fa`, `/logout`; `GET /api/admin/me`; `POST /api/marketing/ads/:id/(impression\|click)` | F/C; cookie/2FA com exceções antes de `ensureAdmin`; buckets login/2FA e anti-abuso | `users`, sessão, métrica em repositório; cookies e versão de sessão; write antes de sucesso salvo fluxo específico | `200/202/401/403/409/422/429` literais; `tests/admin-permissions.test.mjs`, `scripts/admin-two-factor-tests.js`; faltam rotação, expiração, replay 2FA e precedência de origem |
| 36–53 | Portão `ensureAdmin`; `POST /api/admin/profile/photo`, `POST /api/admin/me/password`, `/2fa/setup\|enable\|disable\|recovery-codes`; `PATCH /api/admin/me`; `GET /api/admin/2fa/status`, `/security-policy`, `/api/content`, `/api/admin/sessions/:id/seat-map`, `/api/sessions/:id/seats`; `PUT /api/admin/security-policy` | A/B/C/D; Admin conforme permissão e 2FA; `/api/content`/assentos públicos passam pelo mesmo ponto; buckets foto/senha | `users`, `settings`, rooms/sessions/holds; foto em arquivo; repositório ou `writeDb`; mapa Admin projeta identidade | `200/201/404/409/422` e guards comuns; `tests/admin-session-seat-map.test.mjs`, `tests/public-seat-state-http.test.mjs`; falta comparação de visibilidade/estado sob sessão vencida |
| 52–69 | `GET /api/admin/content`, `/api/dashboard`, `/api/admin/dashboard`, `/api/admin/marketing/overview`; `GET/POST /api/admin/social-studio/automation/campaigns`; `GET /api/admin/social-studio/context`, `/assets`; `POST /uploads`, `/copy`, `/resolve`, `/variations`, `/preview-scene`, `/preview`, `/posts`, `/campaigns`; `GET/PUT/POST/DELETE /posts/:id[/:action]` | A/B/C/D; `social_studio.view/create/delete` e `dashboard.view`; bucket mutação Admin | `settings.socialStudioPosts`, uploads, filas de automação, Social Studio; possível arquivo/IA/serviço externo, `writeDb`/repositório e job após commit | `200/201/202/400/404/409`; `tests/social-studio-automation.test.mjs`, `tests/admin-marketing-isolation.test.mjs`; faltam falha de upload, consentimento, ação rejeitada e render pós-commit |
| 70–81 | `GET /api/admin/reports/dashboard.csv`, `/ticket-distributor[.csv\|.pdf]`; `PUT /ticket-distributor/settings`; `GET/POST/DELETE /api/admin/concession-sales[/:id/archive\|refund]`; logs delegados | A/B/C/D/E; `dashboard.view`, `ticket_finance.*`, `concessions.*`, `logs.*`; bucket relatórios | `settings`, `orders/payments/concessions`, logs; export direto; arquivo e reembolso self-managed têm commit próprio | `200/422` literais mais erro dinâmico; `tests/admin-ticket-finance-view.test.mjs`, `tests/concession-cancellation.test.mjs`, smoke PostgreSQL; faltam export com permissão mínima, failpoint por provedor |
| 82–98 | `GET /api/admin/payments`, `/api/payments/config[/mercado-pago]`, `/api/integrations`, `/api/admin/integrations`, webhook-simulations e batch/status; `POST` simulação/resend/retry de outbox; `GET` token catálogo/outbox; `GET/PUT/POST /api/admin/integrations/:provider[/:action]`; `POST /api/integrations/test` | A/B/C/D/E; `payments.view`, `integrations.view/manage`, owner em integração Admin; bucket lookup e mutação | `settings`, `payments`, outbox CRM, simulador; `testIntegrationProvider` pode chamar MP, Wallet, SMTP etc **somente sob ação explícita**; resultados gravados após resposta | `200/202/403/404/409` literais; `tests/google-wallet-integration-service.test.mjs`, `tests/mercado-pago-webhook-authority.test.mjs`; faltam timeouts, segredo inválido, provedor aceitou e commit falhou |
| 99–111 | `GET/PATCH /api/admin/email/template-library[/:id]`; `GET/PUT /branding`; `POST /attachments`; `GET/POST /campaigns`, `/preview`, `/test`, `/campaigns/:id/{send,cancel,duplicate,retry-failures}`, `GET /:id/recipients`, `PUT/DELETE /:id` | A/B/C/D; `marketing.view/manage`, Admin e origem; buckets mutação | `emailCampaignRepository`, `settings`, anexos; `send` persiste recipients/estado antes do worker, teste de envio pode chamar SMTP | `200/201/202/400/404/409/412`; `tests/email-campaign-reliability.test.mjs`, `tests/email-campaign-postgres.test.mjs`; falta matriz HTTP de status, falha de SMTP após aceite e concorrência por rota |
| 112–129 | `GET /api/admin/customers`; `POST /api/events`; `PUT /api/content`; `PUT /api/settings`; `GET/POST /api/email/unsubscribe`; `POST /api/auth/register\|login\|logout\|password/request\|password/reset\|email/verify`; `GET /api/auth/me\|google/start\|google/callback`; `PATCH /api/me`; `POST /api/me/email-change/request\|email-verification/request\|email-change/confirm` | A/B/C/D/F; sessão cliente, OAuth, token unsubscribe/verificação; Admin só onde `adminAuthRequired`; buckets auth/eventos/e-mail | `users`, settings, content, eventos, email campaign; SMTP/OAuth/Google; cookies/versão de sessão, envio após estado local conforme ramo | `200/201/202/400/401/409/412/422/429/502/503`; `tests/customer-registration-http.test.mjs`, `tests/origin-policy.test.mjs`; falta contrato completo de cookie, replay/corrida OAuth e e-mail aceito antes de commit |
| 130–149 | `GET /api/subscription-plans`, `/api/me/subscriptions`, `/api/admin/subscription-plans`, `/subscriptions[/:id]`; `POST /api/me/subscriptions/:id/cancel`, `/api/subscriptions/subscribe`, `/api/checkout/club-credit`, `/api/admin/subscription-plans`, `/subscriptions/assign`, `/subscriptions/:id/credits/:action`; `PUT/DELETE` planos, `PUT /api/admin/goods-fiscal-settings`, `PATCH/DELETE` assinatura | A/B/C/E; cliente ou `club.view/manage/credits`; assinatura tem bucket próprio; atribuição é self-managed | `subscriptions`, `subscription_credits`, `orders`, `payments`, `tickets`, settings; elegibilidade/crédito na mesma mutação, provedor na assinatura paga | `200/201/400/401/403/404/409/422`; `tests/club-checkout-pricing.test.mjs`, `scripts/club-hybrid-tests.js`, smoke PG; faltam disputa de último crédito, aprovação tardia e todos os ramos de estorno |
| 150–159 | `GET /api/tmdb/movie/:id`; `POST /api/uploads/images`; CRUD delegado de movies/sessions/rooms/ticket-types/concessions/promotions/ads/users; `DELETE /api/users/:id`; `POST /api/coupons/preview`, `/api/checkout/club-benefits/preview` | A/B/C/D/E; permissões de catálogo/usuários, cliente em previews; bucket upload/cupom/lookup | Repositórios de catálogo e `users`, imagens em arquivo, TMDB externo; preview lê preço/elegibilidade | `200/201/401/404/409` mais handler delegado; `tests/catalog-operations-http.test.mjs`, `tests/session-room-conflict.test.mjs`, `tests/coupon-lifecycle.test.mjs`; faltam conflito HTTP por método, falha de upload e uso de cupom concorrente |
| 160–164 | `POST /api/payments/pix`, `/card`; `GET /api/account/tickets`, `/api/checkout/orders/:id` | A/E; cookie cliente + origem, bucket pagamentos, idempotência; consulta de pedido exige dono | `orders/payments/tickets/holds/stock/credits`; MP/PagBank; `createActiveOnlinePayment` pode preceder `writeDb` no wrapper; GET de pedido **pode reconciliar e expirar**, portanto não é A pura | `200/201/400/401/409/412/422` e estados pendentes; `tests/checkout-new-purchase.test.mjs`, smoke PG, `e2e/checkout-payment.spec.js`; falta falha de commit/resposta externa perdida e Card Brick simulado |
| 165–172 | `GET /api/me/tickets[/:id\|/:id/qr\|/:id/download]`; `POST /api/me/tickets/:id/google-wallet\|transfer`; `GET /api/admin/concession-sales/:id/print`, `/api/admin/tickets/:id/print`, `/api/admin/orders/:id/print` | A/C/D/E; cliente dono ou `orders.print`; bucket artefato/transfer; GET QR pode persistir token | `tickets/orders/concessions`, PDF/QR/cache, Wallet externo, transferência transacional; impressão e export não liberam direitos por si | `200/400/401/404/409/410`; `tests/ticket-security.test.mjs`, `tests/ticket-document-pdf-service.test.mjs`, `tests/ticket-transfer-policy.test.mjs`; falta transferência concorrente HTTP/PG e resposta Wallet perdida |
| 173–184 | `GET /api/box-office/point-terminals`, `/api/auth/mobile/google/consume`, `/api/box-office/point-payments/:id[/print]`; `POST /api/box-office/point-payments/:id/{print-result,retry-print,cancel,resolve-print-failure}`; `POST /api/box-office/sales`, `/api/tickets/manual`, `/api/admin/concession-counter-sales` | A/C/D/E/F; `box_office.sell`, `orders.refund` adicional, `concessions.sell`; OAuth mobile especial; venda self-managed | `orders/payments/tickets/holds/stock`, impressora/Point/Google; intenção Point e lease confirmados antes do provedor, estados/resposta após commit; GET de recuperação **muta** | `200/201/202/400/401/404/409/412/422/503`; `scripts/mercado-pago-point-tests.js`, smoke/concorrência PG, `e2e/admin-box-office-realtime.spec.js`; falta simulação de cada erro de impressão/retry, terminais reais |
| 185–187 | `POST /api/tickets/validate`, `/api/webhooks/pag-bank`, `/api/webhooks/mercado-pago` | C/E/F; validação Admin `tickets.validate`, webhook sem sessão mas com assinatura/autenticidade e referência; webhooks isentos de rate limit genérico | `tickets/orders/payments/stock/credits/webhookEvents`, consulta MP/PagBank; mutação crítica local, direitos só após autoridade verificada; e-mail/WS após confirmação | `200/404/409/503` literais mais HMAC/erro dinâmico; `scripts/mercado-pago-webhook-tests.js`, `tests/mercado-pago-webhook-authority.test.mjs`, smoke PG; faltam matriz de todos os status, commit falho e PagBank |
| 188–202 | `GET /api/orders[/:id]`; `POST /api/orders/:id/resend-ticket-email\|refund-tickets\|refund-concessions`; `PATCH/DELETE /api/orders/:id`; `DELETE /api/orders/:id/permanent`; `POST /api/orders` (removida) | A/C/D/E; `orders.view/edit/cancel/refund/resend/delete/archive`; reembolso self-managed e ação extra, envio SMTP | `orders/payments/tickets/stock/credits`, reembolso externo após intenção persistida, deleção/arquivamento local; reenvio pode duplicar se provedor aceitar antes do recibo | `200/404/410` literais mais erros dinâmicos; `tests/operations-monitor-refund.test.mjs`, smoke PG; `POST /api/orders` = `410 ENDPOINT_REMOVED`; faltam cenários por provedor e deleção concorrente |

**Erros literais adicionais, por família (extraídos do `code:` presente no bloco, sem contar exceções de helpers):** automação `EMAIL_AUTOMATION_UNAVAILABLE`, `STUDIO_AUTOMATION_UNAVAILABLE`, `STUDIO_CAMPAIGN_NOT_FOUND`; catálogo externo `COMMERCIAL_CATALOG_UNAVAILABLE`, `COMMERCIAL_CATALOG_UNAUTHORIZED`; Admin/2FA `ADMIN_LOGIN_BLOCKED`, `ADMIN_LOGIN_INVALID`, `ADMIN_2FA_CONFIGURATION_INVALID`, `ADMIN_2FA_CHALLENGE_EXPIRED`, `ADMIN_2FA_INVALID`, `ADMIN_CSRF_BLOCKED`, `ADMIN_AUTH_REQUIRED`, `ADMIN_2FA_SETUP_REQUIRED`, `CURRENT_PASSWORD_INVALID`; Studio `SOCIAL_ASSET_NOT_FOUND`, `SOCIAL_INVALID_EFFECTS`, `SOCIAL_POST_NOT_FOUND`, `SOCIAL_POST_FILE_NOT_FOUND`, `SOCIAL_POST_NOT_EDITABLE`; integração `WEBHOOK_BATCH_IN_PROGRESS`, `WEBHOOK_BATCH_NOT_FOUND`, `WEBHOOK_SIMULATION_NOT_FOUND`, `COMMERCIAL_CATALOG_TOKEN_FORBIDDEN`, `COMMERCIAL_CATALOG_TOKEN_NOT_CONFIGURED`, `INTEGRATION_NOT_FOUND`; campanhas `EMAIL_CAMPAIGN_INVALID`, `EMAIL_CAMPAIGN_NOT_FOUND`, `EMAIL_CAMPAIGN_DELETE_LOCKED`, `EMAIL_CAMPAIGN_STATE`, `EMAIL_CAMPAIGN_LOCKED`, `POSTGRES_REQUIRED`; cliente `CUSTOMER_LOGIN_BLOCKED`, `AUTH_REQUIRED`, `PASSWORD_RESET_INVALID`, `PASSWORD_RESET_EXPIRED`, `EMAIL_DELIVERY_FAILED`, `EMAIL_VERIFICATION_INVALID`; Clube `PLAN_NOT_FOUND`, `SUBSCRIPTION_ALREADY_EXISTS`, `IDEMPOTENCY_KEY_CONFLICT`, `NO_ACTIVE_SUBSCRIPTION`, `SUBSCRIPTION_REAUTHORIZATION_REQUIRED`, `NEGATIVE_CREDITS`; Pix/cartão `PAYMENT_AMOUNT_INVALID`, `PAYMENT_PROVIDER_NOT_CONFIGURED`, `CARD_DATA_NOT_ALLOWED`; ingresso `TICKET_NOT_FOUND`, `TICKET_ALREADY_USED`, `TICKET_CANCELLED`, `TICKET_EXPIRED`, `TICKET_DOCUMENT_EXPIRED`, `TICKET_ARCHIVED`, `TRANSFER_TARGET_NOT_FOUND`; bilheteria `POINT_REQUEST_ID_REQUIRED`, `POINT_REQUEST_ID_CONFLICT`, `POINT_INTENT_MISSING`, `POINT_PAYMENT_MISMATCH`, `PRINT_STATUS_UNCERTAIN`; webhook `PAGBANK_PAYMENT_MISMATCH`, `MERCADO_PAGO_WEBHOOK_LOOKUP_FAILED`, `PAYMENT_REFERENCE_MISMATCH`, `PAYMENT_AMOUNT_MISMATCH`; pedido `ORDER_NOT_FOUND`, `ORDER_NOT_DELIVERABLE`, `ENDPOINT_REMOVED`. Guardas comuns ainda podem devolver `RATE_LIMITED`, `CUSTOMER_CSRF_BLOCKED`, `ADMIN_FORBIDDEN` e erros normalizados por `publicApiError`. Os blocos de relatório e venda de bomboniere não contêm `code:` literal em todos os ramos; seus helpers e handlers delegados precisam de teste para fixar as mensagens/códigos efetivos.

**Casos que não são leitura pura apesar de GET:** callback Google, OAuth mobile consume, artefato QR com eventual persistência, consulta do pedido com expiração/conciliação, recuperação Point, reports/logs com auditoria ou geração de artefato. `GET /api/commercial/catalog` consulta configuração e aplica token/cache. Não converter estas rotas para um handler de leitura com transação suprimida só pelo verbo.

**Candidato estático sem endpoint ativo:** o ramo `userMatch` aceita `/api/users/:id` independentemente do método, mas só implementa `DELETE`; `GET /api/users/:id` cai no fallback 404 (ou em 404 antecipado se o usuário não existe). O inventário de predicados não deve contá-lo como GET funcional. Congelar esse comportamento antes de editar o ramo.

### Subrotas internas e handlers delegados

O quadro ordenado no final registra o `if` externo; nestes blocos a rota e o método são refinados **dentro** do ramo. A precedência interna precisa ser congelada antes de extração:

| Predicado externo | Ações internas na ordem atual | Dependência crítica |
| --- | --- | --- |
| `adminAutomationMatch` | `POST reprocess`, `GET :id` | Orquestrador e leitura de campanha |
| `socialStudioPostMatch` | `GET download`, `GET scene`, `PUT scene-draft`, `POST scene-versions`, `POST scene-export`, `POST scene-reset`, `DELETE :id` | Arquivo/versão/cena; erro 404 do post é anterior à decisão de ação |
| `adminIntegrationMatch` | `GET :provider`, `PUT :provider`, `POST enable/disable`, `POST test` | Validação do provider antes da operação; `test` pode chamar serviço externo |
| `emailCampaignMatch` | `GET recipients`, `GET :id`, `DELETE :id[/delete]`, `POST cancel`, `POST send`, `POST retry-failures`, `POST duplicate`, `PUT :id` | Status/consentimento/repositório; falhas e envio após commit |
| `accountTicketMatch` | `GET :id`, `GET qr`, `GET download`, `POST google-wallet`, `POST transfer` | Identidade do cliente e status do ingresso antes de QR/Wallet/transferência |
| `boxOfficeSale` | idempotência/fingerprint → cliente/ticket/estoque → intenção/commit → Point → sincronização/impressão/e-mail | Não tratar `202` como pagamento; retry conserva chave e lease |
| Webhook PagBank e Mercado Pago | autenticar/validar referência → detectar duplicata → consultar autoridade → reconciliar → commit → emitir/avisar | Não antecipar ingresso ou aceitar notificação não verificada |

Handlers delegados também possuem predicados próprios: `infrastructureRoutes` (health/update); `catalogReadHandler` (`GET /api/content`, `/api/admin/content`); `adminOverviewHandler` (dashboard/marketing overview); `adminCustomerHandler` (`GET /api/admin/customers`); `adminLogsHandler` (logs/stream/performance); `cinemaSettingsHandler` (`PUT /api/settings`); `tmdbLookupHandler` (TMDB); `movieCatalogHandler` (movies/order/sessions/autocorrect); `venueConfigurationHandler` (rooms/ticket-types); `commercialCatalogHandler` (concessions/promotions/ads); `adminUserWriteHandler` (users); `pointPaymentRecoveryHandler`, `pointPaymentCancellationHandler` e `pointPrintFailureResolutionHandler`. A chamada delegada na tabela não prova que todo caminho da família seja tratado por ela. `handlePublicContentRoute` precede o seat map; `handleAdminContentRoute` e `handleAdminOverviewRoutes` precedem Social Studio. `handleTmdbSearchRoute` aparece antes do Clube, mas `handleTmdbMovieRoute` depois; reordenar ambos em bloco único mudaria a precedência.

### Outros blocos grandes e dependências compartilhadas

Fora de `handleApi` restam **7.893 linhas**, inclusive imports, constantes e composição. Os maiores blocos top-level foram medidos com AST nesta revisão:

| Bloco (linhas físicas) | Dono atual e dependências | Decisão |
| --- | --- | --- |
| `normalizeDb` (199) | Snapshot JSON/PostgreSQL, defaults de catálogo, contas e direitos | Alta dependência; comparar fixtures JSON/PG antes de decompor, sem remover compatibilidade |
| `ticketDistributorReportPdf` (110), `ticketDistributorReport` (77), `orderFinancialBreakdown` (78) | Relatórios financeiros, PDF, leitura de pedidos/pagamentos | Extrair apresentação com testes de total, permissão, MIME e layout; não recalcular dinheiro em paralelo |
| `getContent` (109), `socialStudioContext` (72) | Projeções do snapshot e dados de marketing | Candidatos após testes de privacidade e formato de resposta |
| `queueBoxOfficePointPrint` (105), `syncBoxOfficePointPrint` (42) | Impressão Point, estado de pedido/ingresso, cliente/impressora | Alto risco; cobrir resposta perdida e falha de impressão antes de mover |
| `testIntegrationProvider` (105), `runMercadoPagoWebhookSimulation` (96), `ensureWebhookTestFixture` (55), `runWebhookBatchJob` (42) | Configurações por cinema, provedores, jobs e logs | Efeito externo; factory injetada, execução só por ação autorizada, teste simulado antes de extração |
| `createCrmOutboxRepository` (102), `buildEmailCampaignWorker` (48) | Outbox/lease, CRM, campanha, cronologia de worker | Preservar singleton, commit e startup/quiescent; não criar segundo worker |
| `reconcileOnlineCheckoutOrder` (98), `finalizePaidOrder` (73), `cancelOrder` (72), `createSubscription` (70) | `orders/payments/tickets/stock/credits` e autorização financeira | Crítico; não mover antes da matriz de failpoints por provedor |
| `downloadTrailerForMovie` (88), `syncSessionSnapshotRecords` (44), `archiveFinishedSessions` (59), `expireStaleReservations` (58) | Arquivo, sessões e expiração de holds/pedidos | Manutenção em `backendMaintenanceTasks`; testar ausência de efeito na importação |
| `http.createServer`/callback (103), startup `loadEnvFiles().then` (75) | request context, erros, WS, HTTP, workers, timers e quiescent | Manter composição explícita; caracterizar ordem e desligamento antes de mover qualquer início |

Outros acoplamentos distribuídos em funções menores incluem `readDb/writeDb/withCriticalMutation`, `requestContext`, `sendJson` com deferimento, `getAdminUser/getCustomerUser`, `requiredAdminPermission`, configuração de cinema, `seatRealtimeService`, `queueTicketEmailDelivery` e `performanceMonitor`. Eles são dependências de **vários** grupos; injetá-los em factories por domínio evita imports circulares de `server.js`. `backend/start.js` quiescente não importa o servidor operacional. O registro de `finish` acrescenta log PostgreSQL posterior à resposta; isso não é commit de negócio e não deve ser confundido com garantia transacional.

## Cobertura e lacunas para a Fase 21

Há testes identificados em 22/22 domínios da matriz, porém ela registra lacunas explícitas em auth/2FA, permissões por método, origem, concorrência de holds, Card Brick, Pix/cartão em falha de commit, PagBank/MP em todas as transições, estoque da última unidade, transferência concorrente, efeitos de e-mail e dreno de workers. Os fluxos `GET` com escrita exigem classificação própria. Filtros de contrato devem comparar status, body, headers, cookies, cache, MIME e erros, incluindo 401/403/409/422/428/429/503/202 conforme rota. Os testes HTTP devem usar apenas fixtures sintéticas e PostgreSQL descartável com guard; não usar banco operacional.

**Validação desta etapa:** `node scripts/measure-modularization.mjs --summary` aprovado (medidas acima); `npm run docs:modularization:report` aprovado, mas seu snapshot estático mostra `+13/-13` predicados e `+0/-42` literais ante a base histórica por transferência de dono; `npm run test:security:local` aprovado (25/25 na suite principal, scripts complementares aprovados); `npm run docs:check` aprovado antes da inclusão destes documentos e deve ser reexecutado no commit. No SHA de origem `715839f...`, os workflows Security regression, Browser E2E e PostgreSQL integration terminaram com sucesso. Nenhuma suíte operacional nem provedor real foi chamada nesta auditoria.

## Ordem completa das condições de primeiro nível

A tabela gerada abaixo preserva a ordem de todas as **154 condições** entre as 202 instruções do corpo de `handleApi`. Os outros 48 nós são declarações/atribuições e o `sendJson` final; o cabeçalho e os quadros acima documentam seus efeitos. `Matcher` mostra a regex de `pathname.match` declarada antes do ramo. Uma condição delegada precisa ser lida junto ao handler citado; condição `adminAutomationMatch` e similares exigem o quadro de subrotas acima. Regenerar com `node scripts/fase21-route-snapshot.mjs --markdown`; comparar o resultado depois de cada extração.

<!-- Gerado por node scripts/fase21-route-snapshot.mjs --markdown; predicados do HEAD, não substitui revisão dos handlers delegados. -->
| Ordem no corpo de handleApi | Condição avaliada | Matcher definido antes da condição |
| ---: | --- | --- |
| 2 | `method === "OPTIONS"` | — |
| 3 | `await handleHealthRoute({ res, pathname, method })` | — |
| 5 | `!req.rateLimitChecked` | — |
| 6 | `await handleDesktopUpdateRoute({ res, pathname, method })` | — |
| 18 | `postgresEnabled() && mutatesState(method) && adminAuthRequired(pathname, method) && !targetedRepositoryMutation && !selfManagedOrderDeletion && !selfManagedPermanentOrderDeletion && !selfManagedConcessionArchive && !selfManagedTicketValidation && !selfManagedClubAssignment && !selfManagedBoxOfficeSale && !selfManagedPointCancellation && !selfManagedRefundFlow && !context?.adminMutationLocked` | — |
| 19 | `!customerMutationOriginAllowed(req)` | — |
| 21 | `pathname.startsWith("/api/email-automation/") && !emailAutomationAuthorized(req)` | — |
| 22 | `pathname === "/api/email-automation/context" && method === "GET"` | — |
| 23 | `pathname === "/api/email-automation/campaigns" && method === "POST"` | — |
| 24 | `pathname.startsWith("/api/studio/") && !studioAutomationAuthorized(req)` | — |
| 25 | `pathname === "/api/studio/context" && method === "GET"` | — |
| 26 | `pathname === "/api/studio/campaigns/generate" && method === "POST"` | — |
| 28 | `studioAutomationMatch && method==='GET'` | `studioAutomationMatch: pathname.match(/^\/api\/studio\/campaigns\/([a-f0-9-]{36})$/)` |
| 29 | `pathname === "/api/commercial/catalog" && method === "GET"` | — |
| 30 | `pathname === "/api/admin/login" && method === "POST"` | — |
| 31 | `pathname === "/api/admin/login/2fa" && method === "POST"` | — |
| 32 | `pathname === "/api/admin/logout" && method === "POST"` | — |
| 33 | `pathname === "/api/admin/me" && method === "GET"` | — |
| 35 | `publicAdMetricMatch && method === "POST"` | `publicAdMetricMatch: pathname.match(/^\/api\/marketing\/ads\/([^/]+)\/(impression\|click)$/)` |
| 36 | `!ensureAdmin(req, res, db, pathname, method)` | — |
| 37 | `pathname === "/api/admin/profile/photo" && method === "POST"` | — |
| 38 | `pathname === "/api/admin/me" && method === "PATCH"` | — |
| 39 | `pathname === "/api/admin/me/password" && method === "POST"` | — |
| 40 | `pathname === "/api/admin/2fa/status" && method === "GET"` | — |
| 41 | `pathname === "/api/admin/2fa/setup" && method === "POST"` | — |
| 42 | `pathname === "/api/admin/2fa/enable" && method === "POST"` | — |
| 43 | `pathname === "/api/admin/2fa/disable" && method === "POST"` | — |
| 44 | `pathname === "/api/admin/security-policy" && method === "GET"` | — |
| 45 | `pathname === "/api/admin/security-policy" && method === "PUT"` | — |
| 46 | `pathname === "/api/admin/2fa/recovery-codes" && method === "POST"` | — |
| 47 | `handlePublicContentRoute({ res, pathname, method, db })` | — |
| 49 | `adminSessionSeatMapMatch && method === "GET"` | `adminSessionSeatMapMatch: pathname.match(/^\/api\/admin\/sessions\/([^/]+)\/seat-map$/)` |
| 51 | `sessionSeatsMatch && method === "GET"` | `sessionSeatsMatch: pathname.match(/^\/api\/sessions\/([^/]+)\/seats$/)` |
| 52 | `await handleAdminContentRoute({ req, res, pathname, method, db })` | — |
| 53 | `await handleAdminOverviewRoutes({ req, res, pathname, method, db })` | — |
| 54 | `pathname === "/api/admin/social-studio/context" && method === "GET"` | — |
| 55 | `pathname === "/api/admin/social-studio/automation/campaigns" && method === "GET"` | — |
| 56 | `pathname === "/api/admin/social-studio/automation/campaigns" && method === "POST"` | — |
| 58 | `adminAutomationMatch` | `adminAutomationMatch: pathname.match(/^\/api\/admin\/social-studio\/automation\/campaigns\/([a-f0-9-]{36})(?:\/(reprocess))?$/)` |
| 59 | `pathname === "/api/admin/social-studio/uploads" && method === "POST"` | — |
| 60 | `pathname === "/api/admin/social-studio/assets" && method === "GET"` | — |
| 61 | `pathname === "/api/admin/social-studio/copy" && method === "POST"` | — |
| 62 | `pathname === "/api/admin/social-studio/resolve" && method === "POST"` | — |
| 63 | `pathname === "/api/admin/social-studio/variations" && method === "POST"` | — |
| 64 | `pathname === "/api/admin/social-studio/preview-scene" && method === "POST"` | — |
| 65 | `pathname === "/api/admin/social-studio/preview" && method === "POST"` | — |
| 66 | `pathname === "/api/admin/social-studio/posts" && method === "POST"` | — |
| 67 | `pathname === "/api/admin/social-studio/campaigns" && method === "POST"` | — |
| 69 | `socialStudioPostMatch` | `socialStudioPostMatch: pathname.match(/^\/api\/admin\/social-studio\/posts\/([^/]+)(?:\/(download\|scene\|scene-draft\|scene-versions\|scene-export\|scene-reset))?$/)` |
| 70 | `pathname === "/api/admin/reports/dashboard.csv" && method === "GET"` | — |
| 71 | `["/api/admin/reports/ticket-distributor.csv", "/api/admin/reports/ticket-distributor.pdf"].includes(pathname) && method === "GET"` | — |
| 72 | `pathname === "/api/admin/reports/ticket-distributor" && method === "GET"` | — |
| 73 | `pathname === "/api/admin/reports/ticket-distributor/settings" && method === "PUT"` | — |
| 74 | `pathname === "/api/admin/concession-sales" && method === "GET"` | — |
| 76 | `concessionArchiveMatch && method === "POST"` | `concessionArchiveMatch: pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)\/archive$/)` |
| 78 | `concessionRefundMatch && method === "POST"` | `concessionRefundMatch: pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)\/refund$/)` |
| 80 | `concessionDeleteMatch && method === "DELETE"` | `concessionDeleteMatch: pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)$/)` |
| 81 | `await handleAdminLogsRoutes({ req, res, pathname, method, db })` | — |
| 82 | `pathname === "/api/admin/payments" && method === "GET"` | — |
| 83 | `["/api/payments/config", "/api/payments/config/mercado-pago"].includes(pathname) && method === "GET"` | — |
| 84 | `(pathname === "/api/integrations" \|\| pathname === "/api/admin/integrations") && method === "GET"` | — |
| 86 | `pathname === webhookSimulationBase && method === "GET"` | — |
| 87 | `pathname === webhookSimulationBase && method === "POST"` | — |
| 88 | `pathname === '${webhookSimulationBase}/batch' && method === "POST"` | — |
| 90 | `webhookBatchStatusMatch && method === "GET"` | `webhookBatchStatusMatch: pathname.match(/^\/api\/admin\/integrations\/mercadoPago\/webhook-simulations\/batch\/([^/]+)$/)` |
| 92 | `webhookSimulationResendMatch && method === "POST"` | `webhookSimulationResendMatch: pathname.match(/^\/api\/admin\/integrations\/mercadoPago\/webhook-simulations\/([^/]+)\/resend$/)` |
| 93 | `pathname === "/api/admin/integrations/commercialCatalog/access-token" && method === "GET"` | — |
| 94 | `pathname === "/api/admin/integrations/crm/outbox" && method === "GET"` | — |
| 95 | `pathname === "/api/admin/integrations/crm/outbox/retry-dead" && method === "POST"` | — |
| 97 | `adminIntegrationMatch` | `adminIntegrationMatch: pathname.match(/^\/api\/admin\/integrations\/([^/]+)(?:\/(test\|enable\|disable))?$/)` |
| 98 | `pathname === "/api/integrations/test" && method === "POST"` | — |
| 101 | `pathname === "/api/admin/email/template-library" && method === "GET"` | — |
| 102 | `emailTemplateLibraryMatch && method === "GET"` | `emailTemplateLibraryMatch: pathname.match(/^\/api\/admin\/email\/template-library\/([^/]+)$/)` |
| 103 | `emailTemplateLibraryMatch && method === "PATCH"` | `emailTemplateLibraryMatch: pathname.match(/^\/api\/admin\/email\/template-library\/([^/]+)$/)` |
| 104 | `pathname === "/api/admin/email/branding" && method === "GET"` | — |
| 105 | `pathname === "/api/admin/email/branding" && method === "PUT"` | — |
| 106 | `pathname === "/api/admin/email/attachments" && method === "POST"` | — |
| 107 | `pathname === "/api/admin/email/campaigns" && method === "GET"` | — |
| 108 | `pathname === "/api/admin/email/campaigns/preview" && method === "POST"` | — |
| 109 | `pathname === "/api/admin/email/campaigns/test" && method === "POST"` | — |
| 110 | `pathname === "/api/admin/email/campaigns" && method === "POST"` | — |
| 111 | `emailCampaignMatch && emailCampaignMatch[1]` | `emailCampaignMatch: pathname.match(/^\/api\/admin\/email\/campaigns\/([^/]+)(?:\/(send\|cancel\|duplicate\|delete\|recipients\|retry-failures))?$/)` |
| 112 | `handleAdminCustomerRoute({ req, res, pathname, method, db })` | — |
| 113 | `pathname === "/api/events" && method === "POST"` | — |
| 114 | `pathname === "/api/content" && method === "PUT"` | — |
| 115 | `await handleCinemaSettingsRoutes({ req, res, pathname, method, db })` | — |
| 116 | `pathname === "/api/email/unsubscribe" && ["GET", "POST"].includes(method)` | — |
| 117 | `pathname === "/api/auth/register" && method === "POST"` | — |
| 118 | `pathname === "/api/auth/login" && method === "POST"` | — |
| 119 | `pathname === "/api/auth/me" && method === "GET"` | — |
| 120 | `pathname === "/api/auth/logout" && method === "POST"` | — |
| 121 | `pathname === "/api/auth/password/request" && method === "POST"` | — |
| 122 | `pathname === "/api/auth/password/reset" && method === "POST"` | — |
| 123 | `pathname === "/api/me" && method === "PATCH"` | — |
| 124 | `pathname === "/api/me/email-change/request" && method === "POST"` | — |
| 125 | `pathname === "/api/me/email-verification/request" && method === "POST"` | — |
| 126 | `["/api/auth/email/verify", "/api/me/email-change/confirm"].includes(pathname) && method === "POST"` | — |
| 127 | `pathname === "/api/auth/google/start" && method === "GET"` | — |
| 128 | `pathname === "/api/auth/google/callback" && method === "GET"` | — |
| 129 | `await handleTmdbSearchRoute({ req, res, pathname, method, db })` | — |
| 130 | `pathname === "/api/subscription-plans" && method === "GET"` | — |
| 131 | `pathname === "/api/me/subscriptions" && method === "GET"` | — |
| 133 | `mySubscriptionCancelMatch && method === "POST"` | `mySubscriptionCancelMatch: pathname.match(/^\/api\/me\/subscriptions\/([^/]+)\/cancel$/)` |
| 134 | `pathname === "/api/subscriptions/subscribe" && method === "POST"` | — |
| 135 | `pathname === "/api/checkout/club-credit" && method === "POST"` | — |
| 136 | `pathname === "/api/admin/subscription-plans" && method === "GET"` | — |
| 137 | `pathname === "/api/admin/goods-fiscal-settings" && method === "PUT"` | — |
| 138 | `pathname === "/api/admin/subscription-plans" && method === "POST"` | — |
| 140 | `subscriptionPlanMatch && method === "PUT"` | `subscriptionPlanMatch: pathname.match(/^\/api\/admin\/subscription-plans\/([^/]+)$/)` |
| 141 | `subscriptionPlanMatch && method === "DELETE"` | `subscriptionPlanMatch: pathname.match(/^\/api\/admin\/subscription-plans\/([^/]+)$/)` |
| 142 | `pathname === "/api/admin/subscriptions" && method === "GET"` | — |
| 143 | `pathname === "/api/admin/subscriptions/assign" && method === "POST"` | — |
| 145 | `adminSubscriptionMatch && method === "GET"` | `adminSubscriptionMatch: pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)$/)` |
| 146 | `adminSubscriptionMatch && method === "PATCH"` | `adminSubscriptionMatch: pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)$/)` |
| 147 | `adminSubscriptionMatch && method === "DELETE"` | `adminSubscriptionMatch: pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)$/)` |
| 149 | `adminCreditAdjustMatch && method === "POST"` | `adminCreditAdjustMatch: pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)\/credits\/adjust$/)` |
| 150 | `await handleTmdbMovieRoute({ res, pathname, method, db })` | — |
| 151 | `pathname === "/api/uploads/images" && method === "POST"` | — |
| 152 | `await handleMovieCatalogRoutes({ req, res, pathname, method, db })` | — |
| 153 | `await handleVenueConfigurationRoutes({ req, res, pathname, method, db })` | — |
| 154 | `await handleCommercialCatalogRoutes({ req, res, pathname, method, db })` | — |
| 155 | `await handleAdminUserWriteRoutes({ req, res, pathname, method, db })` | — |
| 157 | `userMatch` | `userMatch: pathname.match(/^\/api\/users\/([^/]+)$/)` |
| 158 | `pathname === "/api/coupons/preview" && method === "POST"` | — |
| 159 | `pathname === "/api/checkout/club-benefits/preview" && method === "POST"` | — |
| 160 | `pathname === "/api/payments/pix" && method === "POST"` | — |
| 161 | `pathname === "/api/payments/card" && method === "POST"` | — |
| 162 | `pathname === "/api/account/tickets" && method === "GET"` | — |
| 164 | `checkoutOrderMatch && method === "GET"` | `checkoutOrderMatch: pathname.match(/^\/api\/checkout\/orders\/([^/]+)$/)` |
| 165 | `pathname === "/api/me/tickets" && method === "GET"` | — |
| 167 | `accountTicketMatch` | `accountTicketMatch: pathname.match(/^\/api\/me\/tickets\/([^/]+)(?:\/([^/]+))?$/)` |
| 169 | `concessionCounterPrintMatch && method === "GET"` | `concessionCounterPrintMatch: pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)\/print$/)` |
| 172 | `(adminTicketPrintMatch \|\| adminOrderPrintMatch) && method === "GET"` | `adminTicketPrintMatch: pathname.match(/^\/api\/admin\/tickets\/([^/]+)\/print$/); adminOrderPrintMatch: pathname.match(/^\/api\/admin\/orders\/([^/]+)\/print$/)` |
| 173 | `pathname === "/api/box-office/point-terminals" && method === "GET"` | — |
| 174 | `pathname === "/api/auth/mobile/google/consume" && method === "GET"` | — |
| 176 | `pointPaymentPrintMatch && method === "GET"` | `pointPaymentPrintMatch: pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/print$/)` |
| 178 | `pointPaymentPrintResultMatch && method === "POST"` | `pointPaymentPrintResultMatch: pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/print-result$/)` |
| 180 | `pointPaymentRetryPrintMatch && method === "POST"` | `pointPaymentRetryPrintMatch: pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/retry-print$/)` |
| 181 | `await handlePointPrintFailureResolution({ req, res, db, pathname, method })` | — |
| 182 | `await handlePointPaymentRecovery({ req, res, db, pathname, method })` | — |
| 183 | `await handlePointPaymentCancellation({ req, res, db, pathname, method })` | — |
| 184 | `(pathname === "/api/box-office/sales" \|\| pathname === "/api/tickets/manual" \|\| pathname === "/api/admin/concession-counter-sales") && method === "POST"` | — |
| 185 | `pathname === "/api/tickets/validate" && method === "POST"` | — |
| 186 | `pathname === "/api/webhooks/pag-bank" && method === "POST"` | — |
| 187 | `pathname === "/api/webhooks/mercado-pago" && method === "POST"` | — |
| 188 | `pathname === "/api/orders" && method === "GET"` | — |
| 190 | `permanentOrderDeleteMatch && method === "DELETE"` | `permanentOrderDeleteMatch: pathname.match(/^\/api\/orders\/([^/]+)\/permanent$/)` |
| 193 | `orderResendEmailMatch && method === "POST"` | `orderResendEmailMatch: pathname.match(/^\/api\/orders\/([^/]+)\/resend-ticket-email$/)` |
| 195 | `orderRefundTicketsMatch && method === "POST"` | `orderRefundTicketsMatch: pathname.match(/^\/api\/orders\/([^/]+)\/refund-tickets$/)` |
| 197 | `orderRefundConcessionsMatch && method === "POST"` | `orderRefundConcessionsMatch: pathname.match(/^\/api\/orders\/([^/]+)\/refund-concessions$/)` |
| 198 | `adminOrderMatch && method === "GET"` | `adminOrderMatch: pathname.match(/^\/api\/orders\/([^/]+)$/)` |
| 199 | `adminOrderMatch && method === "PATCH"` | `adminOrderMatch: pathname.match(/^\/api\/orders\/([^/]+)$/)` |
| 200 | `adminOrderMatch && method === "DELETE"` | `adminOrderMatch: pathname.match(/^\/api\/orders\/([^/]+)$/)` |
| 201 | `pathname === "/api/orders" && method === "POST"` | — |
