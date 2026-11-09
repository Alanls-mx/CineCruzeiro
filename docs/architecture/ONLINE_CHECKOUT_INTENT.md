# Intenção durável do checkout online (Fase 23)

`POST /api/payments/pix` e `POST /api/payments/card` continuam sujeitos à sessão de cliente, origem/CSRF, rate limit e reprecificação do catálogo no dispatcher. `onlineCheckoutCoordinator` recebe as dependências do servidor e coordena as mutações. `onlineCheckoutIntentService` define a identidade e os metadados. Nenhum deles chama provedor ou inicia worker durante importação.

## Fronteiras de commit

1. Sob `withCriticalMutation`, validar identidade, preço, assentos, estoque, benefícios e configuração; gravar pedido `pending_payment` e pagamento `processing` com `metadata.onlineIntent.state=prepared`. O mesmo commit reserva os recursos locais. Se ele falha, não há chamada externa.
2. Em outra mutação, registrar `claim`, lease, chave idempotente e estado `sending`. Somente a instância que obteve esse claim chama o provedor. O commit do claim antecede a chamada de rede; nenhuma transação PostgreSQL fica aberta durante a chamada.
3. Resposta externa conhecida: gravar ID, referência e metadados recebidos em novo commit, conferindo provedor, pedido e valor. Em seguida, concluir o estado e emitir direitos apenas se houver aprovação válida. O `201` sucede o commit final.
4. Timeout, resposta perdida ou erro incerto: manter o pedido e pagamento, marcar `unknown` quando possível, responder `503`. Retries de uma intenção `sending`/`unknown` não fazem novo POST ao provedor e recebem `202`. Um lease vencido não autoriza recriar cobrança.
5. Webhook assinado pode localizar a intenção ainda sem ID externo por referência do pedido; a autoridade do estado continua sendo a consulta/validação já exigida pelo handler. O evento só recebe `200` após commit. Aprovação emite um ingresso uma vez; callback pendente preserva zero ingressos. Eventos atrasados não rebaixam pagamento aprovado.

Se um callback cancelar ou expirar a Order enquanto o POST ao provedor ainda está em voo, a resposta posterior do POST não reabre o pedido nem reexibe QR/URL de pagamento. O checkout responde `409 PAYMENT_ORDER_CLOSED` com o estado persistido; esta diferença de contrato é necessária para não oferecer um Pix cancelado ao cliente.

O identificador interno do pagamento, a chave idempotente, o hash da composição da compra, a instalação, o hash da conta do provedor, o claim e o histórico curto ficam em `payments.metadata.onlineIntent`. O token da conta e os dados do cartão não são persistidos ali. O mesmo modelo funciona com a projeção PostgreSQL e com JSON legado, sem migration.

## Cobertura e limite

`financial-online-failure-scenarios.js` e `financial-pagbank-checkout-failure-scenarios.js` usam PostgreSQL descartável, failpoints e provedores sintéticos. O primeiro verifica por conexão independente que o pedido foi confirmado antes da chamada; ambos verificam resposta perdida, erro antes do aceite, falha de commit após aceite, retry e inexistência de ingresso indevido. `postgres-concurrency-tests.js` disputa a mesma identidade em dois processos e simula resposta perdida numa instância com retry na outra. Webhooks assinados simulados de Mercado Pago e PagBank recuperam a intenção sem navegador quando chegam com ID da Order e referência válida.

**Risco residual bloqueador:** a [Orders API do Mercado Pago](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/search-orders/get) permite consulta por `external_reference` e período, agora usada pela reconciliação; a [consulta de pedido PagBank](https://developer.pagbank.com.br/reference/consultar-pedido) exige o ID da Order. Sem esse ID nem callback, o PagBank continua sujeito a revisão controlada. Não repetir POST para descobrir o resultado. Estados `unknown` retêm estoque/assento até resolução; monitorá-los e não liberá-los por timeout local.

## Continuação: consulta sem navegador

`onlinePaymentReconciliationService` procura intenções `unknown`, `result_known`, `sending` com lease vencido ou `reconciling` com lease vencido. Confirma claim/lease no mesmo commit do snapshot, consulta o provedor fora da transação e só grava o resultado quando o claim ainda é dono da operação. Um webhook que conclua antes da consulta invalida essa conclusão concorrente. A varredura periódica em PostgreSQL normal usa lotes de oito; o modo quiescente não a inicia. Testes com `PAYMENTS_MODE=test` chamam a rotina explicitamente e não fazem consultas reais.

Para Mercado Pago sem ID local, usa `GET /v1/orders` com referência e janela de criação; exige resultado único, valor, moeda BRL e conta autenticada pelo mesmo token cujo hash foi persistido. Com ID, usa GET por ID. Para PagBank sem ID, registra `review_required` e não repete POST; com ID, consulta GET por ID. Uma consulta ausente ou indisponível aplica backoff exponencial limitado e mantém a identidade. Após seis tentativas, a intenção exige revisão. O retorno aprovado só emite direitos depois de commit local; pedido já encerrado mantém sinalização de conciliação. O smoke PostgreSQL cobre recuperação por busca e por ID sem callback; a concorrência de duas instâncias comprova um claim e uma consulta sintética. A API real dos provedores permanece **dispensada, não executada** nesta release.

**Limites ainda abertos:** a consulta de PagBank sem ID não é possível pelo contrato implementado, e a revisão requer procedimento operacional; não há prova de dreno da release instalada. O timer parado não atesta término da consulta externa já iniciada. Um evento de tópico sem reenvio ainda precisa de recepção durável ou recuperação específica. Portanto, esta continuação não libera o corte da VPS.

Se o ID externo foi gravado, mas o commit da conclusão falhou, o estado `result_known` também retém estoque e assento. O retry HTTP pode apresentar esse estado, mas não conclui sozinho os direitos; o reconciliador consulta a Order conhecida e conclui após commit. O smoke injeta falha no commit final e verifica que nenhum ingresso é emitido antes da consulta autorizada.

Este mecanismo reduz o risco de cobrança órfã e duplicada, mas não demonstra exatamente uma cobrança externa real. A validação manual de provedores foi **dispensada, não executada**; isso não substitui a prova dos cenários locais nem libera o corte da VPS.
