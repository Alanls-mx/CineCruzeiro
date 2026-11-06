# Extração comercial: checkout, reservas, ingressos e Clube

Branch `codex/cine-modularizacao-profunda`. Base desta etapa: `c89c727`. Medição com `node scripts/measure-modularization.mjs --summary`, que conta linhas físicas, inclusive comentários e linhas vazias.

| Arquivo | Antes | Depois | Diferença |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 16.517 | 15.531 | −986 |
| `backend/public/admin.js` | 11.980 | 11.980 | 0 |

| Domínio | Módulo | Linhas | Responsabilidade extraída |
| --- | --- | ---: | --- |
| Checkout | [checkoutPricingService](../../backend/services/checkoutPricingService.js) | 163 | Rateio em centavos, cupom, preço de ingresso e resumo do crédito |
| Ingressos | [orderTicketSelectionService](../../backend/services/orderTicketSelectionService.js) | 62 | Tipos elegíveis por sessão, pacotes e compatibilidade de pedidos antigos |
| Reservas | [orderSeatAssignmentService](../../backend/services/orderSeatAssignmentService.js) | 78 | Ocupação, seleção automática e rejeição de assento indisponível usando `sessionSeatAvailability` |
| Ingressos | [ticketIssuanceService](../../backend/services/ticketIssuanceService.js) | 73 | Construção, numeração, código, QR e vínculo com poltrona, somente quando chamada pelo coordenador financeiro |
| Checkout | [checkoutPresentationService](../../backend/services/checkoutPresentationService.js) | 45 | Reuso por idempotência e projeção de resposta sem PII/metadados privados |
| Pedidos | [orderCatalogPricingService](../../backend/services/orderCatalogPricingService.js) | 250 | Reprecificação a partir do catálogo, estoque/capacidade e rejeição de valor enviado divergente |
| Clube | [clubCheckoutBenefitsService](../../backend/services/clubCheckoutBenefitsService.js) | 189 | Elegibilidade, descontos, itens grátis, limite por ciclo e economia exibida |
| Clube | [clubOrderCreditService](../../backend/services/clubOrderCreditService.js) | 157 | Reserva, consumo, idempotência e restituição de crédito no mesmo snapshot transacional |
| Ingressos | [ticketValidationService](../../backend/services/ticketValidationService.js) | 94 | Inspeção e validação de QR após checagem de pagamento/sessão/status |
| Transferência | [ticketTransferPolicy](../../backend/services/ticketTransferPolicy.js) | 136 no total | Elegibilidade ligada à política de limite já existente |

Os módulos recebem dependências explícitas, não importam `server.js`, não iniciam serviços ao importar e não registram rotas. O `server.js` continua dono da autenticação, CSRF, autorização, despacho HTTP/WS, `withCriticalMutation`, leitura/escrita do snapshot e respostas após commit. A atribuição de poltronas usa a mesma política `sessionSeatAvailability`, e o protocolo WebSocket não foi modificado. O nome de fallback do cliente e o rótulo do benefício continuam injetados pela instalação atual; não foram fixados nos novos módulos compartilhados.

## Matriz de invariantes

| Invariante | Autoridade preservada | Evidência local |
| --- | --- | --- |
| Preço, cupom e extras vêm do catálogo; valor divergente retorna 409 | `repriceOrderFromCatalog` chamado nos mesmos pontos do dispatcher | [teste de preço](../../tests/order-catalog-pricing-service.test.mjs), [smoke PG](../../scripts/smoke-tests.js) |
| Última poltrona e reserva pendente não equivalem a venda | `withCriticalMutation`, `sessionSeatAvailability` e hold PostgreSQL permanecem na coordenação existente | [teste de assentos](../../tests/order-seat-assignment-service.test.mjs), [HTTP](../../tests/public-seat-state-http.test.mjs), smoke PG |
| Ingresso e QR só são construídos após a autorização financeira correspondente | `finalizePaidOrder`, confirmação Point e checkout sem cobrança continuam no servidor | [teste de emissão](../../tests/ticket-issuance-service.test.mjs), smoke PG |
| QR de pedido pendente, cancelado, usado ou de outra sessão não valida | guard e transação da rota de validação não foram movidos | [teste de validação](../../tests/ticket-validation-service.test.mjs), [segurança](../../tests/ticket-security.test.mjs) |
| Crédito do Clube é reservado, consumido ou devolvido no mesmo snapshot de pedido/ingresso | `clubDomainService` e chamadas dentro da transação existente | [teste de crédito](../../tests/club-order-credit-service.test.mjs), [preço](../../tests/club-checkout-pricing.test.mjs), smoke PG |
| Reembolso externo só altera direitos após confirmação e mantém chave idempotente | Fluxos de reembolso e provedores não foram movidos | [auditoria transacional](transactions.md), [financeiro](../../tests/operations-monitor-refund.test.mjs), smoke PG |
| Checkout não expõe PII ou dados internos do provedor | Acesso ao pedido permanece no servidor; presenter só projeta após a checagem | [teste de resposta](../../tests/checkout-presentation-service.test.mjs) |

## Limites e próximos riscos

- A faixa indicativa de 9.000–11.000 linhas não foi atingida: `handleApi` ainda concentra grande parte da orquestração de checkout, Point, pedidos e webhooks. Reduzi-lo exige caracterização por rota e por falha de commit, sem mover a autoridade de pagamento para os serviços de catálogo.
- `materializeOrderAccounting`, estoque e cancelamentos ainda atravessam múltiplas entidades; uma extração posterior precisa de testes de commit falho e concorrência próprios. `inspectTicketConcessions` e `validateTicketConcessions` também permanecem no servidor por causa do cumprimento de bomboniere.
- Os rótulos históricos em `clubDomainService` ainda contêm referência à marca Cine Cruzeiro; isso não foi alterado nesta etapa para preservar os dados emitidos e o contrato atual.
- Nenhum endpoint, método, payload, cookie, permissão, migration, integração externa ou contrato de webhook foi modificado. Não houve acesso a VPS, banco operacional ou provedor real.

## Verificação

Os testes novos estão em `npm run test:modularization:commerce`, incorporado a `test:unit`. Resultados locais: 29/29 testes comerciais dirigidos; `test:finance` 50/50; `test:unit` terminou com código 0 (alguns testes internos ignoram o ramo PostgreSQL sem `TEST_DATABASE_URL`); `test:security:local` 25/25 mais scripts; `lint`, `build` e `docs:check` passaram; `test:e2e` 19/19. `node scripts/with-local-disposable-postgres.js smoke` passou após a reprecificação e novamente após a extração de créditos. `node scripts/with-local-disposable-postgres.js concurrency repositories` passou; a suíte de repositórios teve 11/11 e a execução concorrente terminou com código 0. O harness removeu o contêiner local marcado ao final. O CI do SHA final deve ser conferido separadamente; não considerar teste não executado como aprovado.
