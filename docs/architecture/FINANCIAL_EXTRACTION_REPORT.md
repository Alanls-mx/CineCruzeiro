# Extração dirigida da coordenação financeira

Branch `codex/cine-modularizacao-profunda`. Comparação pelo número de linhas físicas
(`split(/\r?\n/)`, sem excluir comentários): `server.js` tinha **15.531** linhas no
commit comercial `1ebe050` e tem **14.722** após as extrações, redução líquida de
**809** linhas. O limite sugerido de 6.000 a 8.000 ainda não foi atingido. Não se
moveu Pix/cartão ou o webhook apenas para aproximar uma meta numérica.

| Módulo novo | Linhas | Entrada, autoridade e escritor | Evidência dirigida e risco residual |
| --- | ---: | --- | --- |
| [pointCreationCoordinator](../../backend/services/pointCreationCoordinator.js) | 105 | Vendas Point após guard `box_office.sell`/`concessions.sell`; `payments.metadata`, `orders` e lease via `withCriticalMutation`/`writeDb`; `cardTerminalProvider` após commit | [Teste](../../tests/point-creation-coordinator.test.mjs), smoke PG com duas instâncias. Lease vencido e ordem desconhecida ainda exigem conciliação. |
| [pointPaymentStateService](../../backend/services/pointPaymentStateService.js) | 76 | Aplicado dentro da transação da recuperação/cancelamento; altera `payments`, `orders`, `tickets`, estoque e benefícios conforme estado validado | [Teste](../../tests/point-payment-state-service.test.mjs), smoke PG. Não cria máquina paralela. |
| [pointPaymentRecoveryHandler](../../backend/services/pointPaymentRecoveryHandler.js) | 163 | `GET /api/box-office/point-payments/:id`, guarda admin `box_office.sell`; lê e sincroniza os mesmos registros, usa Point, responde após commit | [Teste](../../tests/point-payment-recovery-handler.test.mjs), smoke PG. Nenhuma busca externa por referência sem Order ID. |
| [pointPaymentCancellationHandler](../../backend/services/pointPaymentCancellationHandler.js) | 86 | `POST /api/box-office/point-payments/:id/cancel`, admin `box_office.sell`; Point e persistência de estado terminal | [Teste](../../tests/point-payment-cancellation-handler.test.mjs), smoke PG. `202` segue inconclusivo. |
| [fullOrderRefundCoordinator](../../backend/services/fullOrderRefundCoordinator.js) | 165 | `PATCH /api/orders/:id` `action=cancel`; `orders.cancel` e `orders.refund` em pedido liquidado; intenção em `payment.metadata`, direitos/estoque no segundo commit | [Teste](../../tests/full-order-refund-coordinator.test.mjs), smoke PG. Provedor pode confirmar sem commit local; retry usa mesmo ID. |
| [concessionRefundCoordinator](../../backend/services/concessionRefundCoordinator.js) | 160 | `POST /api/orders/:id/refund-concessions`, `POST /api/admin/concession-sales/:id/refund`, `PATCH` equivalente; `orders.refund`; intenção em pedido/pagamento, estoque só no commit final | [Teste](../../tests/concession-refund-coordinator.test.mjs), smoke PG. Entrega e documento fiscal continuam bloqueadores. |
| [ticketRefundCoordinator](../../backend/services/ticketRefundCoordinator.js) | 146 | `POST /api/orders/:id/refund-tickets` e `PATCH` equivalente; `orders.refund`; intenção em pedido/pagamento, ingresso só no commit final | [Teste](../../tests/ticket-refund-coordinator.test.mjs), smoke PG. Ingresso usado/sessão expirada continuam bloqueados. |
| [pointPrintFailureResolutionHandler](../../backend/services/pointPrintFailureResolutionHandler.js) | 104 | `POST /api/box-office/point-payments/:id/resolve-print-failure`; `box_office.sell` e `orders.refund` ou `orders.cancel`; intenção de estorno, chamada Point, conclusão de `payments`, `orders` e estoque em commit posterior | [Teste](../../tests/point-print-failure-resolution-handler.test.mjs), smoke PG. Impressora real fora do teste. |

Total dos oito módulos novos: **1.005 linhas**, sem novo arquivo monolítico.
As funções mantêm a mesma ordem de commits, chamadas ao provedor, respostas HTTP,
chaves idempotentes e tratamento de erros. Dependências de banco, provedor, guarda
e resposta são injetadas; nenhum módulo importa `server.js` ou executa efeito na
importação. O dispatcher permanece como autoridade de sessão, origem, CSRF,
permissão inicial e observabilidade. O serviço de status Point existente foi
movido integralmente, sem segunda máquina de estados.

## Invariantes e verificação

- Criação Point: intenção → commit → claim/lease → commit pré-envio → provedor →
  commit do resultado. Retry usa a chave armazenada; disputa entre duas instâncias
  não duplica a criação no smoke PG.
- Recuperação Point: referência, valor e terminal são verificados antes de emitir
  direitos. Pagamento pendente ou tardio após cancelamento não emite ingresso.
- Cancelamento Point: `cancel-${payment.id}` é estável; 202 mantém pendência.
- Reembolsos integral e parciais: `refund.id` é persistido antes do provedor;
  timeout/resposta perdida não alteram direitos nem geram ID novo; estoque e
  ingressos mudam apenas após confirmação e segundo commit.
- Falha de impressão: `print-failure-refund-${paymentId}` é persistida antes do
  estorno. Falha do segundo commit não responde sucesso nem libera o ingresso.
- Webhook HMAC, cálculo financeiro, migrations e contratos não foram alterados.

O comando `npm run test:modularization:finance` agrega os testes sintéticos dos
oito módulos. `node scripts/with-local-disposable-postgres.js smoke` exerceu as
rotas HTTP e failpoints de preparação e finalização após cada extração; só o
PostgreSQL criado e protegido pelo harness foi usado. Uma execução inicial do
smoke de bomboniere saiu com código Windows `3221226505` antes dos cenários;
a repetição passou integralmente. Uma primeira execução de `test:unit` também
terminou com código Windows `-1073740791` depois dos testes de documento de
ingresso, sem asserção; o teste seguinte passou isoladamente. Na repetição,
`test:unit` encontrou um teste legado que lia `cancelOrderWithRefund` por posição
em `server.js`; ele foi atualizado para chamar o módulo extraído com a mesma
fixture e expectativas. A terceira execução de `test:unit` passou integralmente.

Verificações locais no HEAD da etapa: 27/27 testes dirigidos, `test:unit`,
`test:security:local` (25/25 na suíte principal), `lint`, `build`, `docs:check`,
`test:e2e` (19/19), smoke PostgreSQL descartável, concorrência PostgreSQL
descartável e repositórios PostgreSQL descartáveis, todos aprovados. Os avisos de
e-mail não configurado nas fixtures e de `eval()` do Next em modo de desenvolvimento
não provocaram falha. O CI no HEAD publicado ainda deve confirmar.

## Bloqueadores para as próximas extrações

- Pix e cartão chamam o provedor antes do `writeDb` local no mesmo wrapper.
  Faltam testes de timeout, resposta externa perdida, retry e falha de commit
  nessa janela para Mercado Pago e PagBank. Mover a rota agora ampliaria risco.
- O webhook reúne assinatura HMAC, consulta externa, assinatura Clube, estados
  de Order e reembolsos. Há testes de assinatura e autoridade, mas não matriz
  completa de transições/repetição. Mantê-lo no servidor preserva a autoridade.
- O fluxo de venda presencial que prepara pedido, ingresso, estoque, impressão
  e e-mail ainda é extenso. A criação/retry e a recuperação Point foram isoladas,
  mas a rota de venda requer caracterização de todos os ramos antes de extração.
- PagBank, devoluções manuais e dispositivos reais não têm a mesma cobertura
  de falhas parciais que os cenários simulados. Não inferir aprovação operacional.

Este resultado satisfaz a redução segura desta rodada, não a meta final de linhas
nem homologação financeira externa. Ver [mapa transacional](FINANCIAL_TRANSACTION_MAP.md)
e [limites de commit](transactions.md).
