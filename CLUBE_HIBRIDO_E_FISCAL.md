# Clube híbrido e preparação fiscal

## Objetivo

Esta arquitetura separa cobrança recorrente, geração de benefício, resgate de ingresso, pagamento complementar e venda de mercadorias. O ingresso do Clube não é cortesia e não gera um pagamento fictício de R$ 0,00.

## Domínio

```text
SUBSCRIPTION
  -> SUBSCRIPTION_PAYMENT
  -> SUBSCRIPTION_CYCLE
  -> SUBSCRIPTION_CREDIT_UNIT
  -> SUBSCRIPTION_CREDIT_REDEMPTION
  -> TICKET
```

- `subscription_plans`: configuração comercial, elegibilidade, validade, acúmulo e regra contábil atual.
- `subscriptions`: vínculo do cliente com o plano e autorização recorrente.
- `subscription_payments`: mensalidades confirmadas pelo provider, com idempotência própria.
- `subscription_cycles`: período de benefício criado por uma mensalidade confiavelmente aprovada ou atribuição manual explícita.
- `subscription_credit_units`: créditos individualizados nos estados `available`, `reserved`, `redeemed`, `expired` ou `cancelled`.
- `subscription_credit_redemptions`: reserva e consumo de um crédito para um pedido e, após confirmação, para um ingresso.
- `order_service_items`: ingressos e sua composição financeira.
- `order_goods_items`: produtos, preço original, desconto do Clube e preço final.
- `goods_fiscal_documents`: estado da preparação fiscal apenas das mercadorias.

As tabelas agregadas antigas de créditos e usos continuam sendo escritas como espelho de compatibilidade. Novas decisões de domínio usam as unidades e os resgates individualizados.

## Planos

O Admin permite configurar mensalidade, créditos por ciclo, valor de referência, validade, acúmulo, limite de acúmulo, carência, pagamento de diferença, desconto em ingressos e bomboniere, itens grátis, exclusões, formatos/sessões elegíveis, ordem, destaque e status.

Não há plano padrão criado pelo código. Preço, quantidade, desconto e elegibilidade são sempre lidos do catálogo persistido e recalculados pelo backend.

## Aprovação e renovação

1. O cliente autoriza a recorrência no Mercado Pago.
2. A autorização sozinha não libera benefício.
3. Um pagamento aprovado e validado gera uma `subscription_payment` idempotente.
4. A mensalidade gera exatamente um ciclo.
5. O ciclo gera as unidades de crédito previstas no snapshot do plano.
6. Webhooks repetidos encontram a mesma chave de idempotência e não duplicam ciclo ou crédito.

Planos `manual_admin` e registros de migração podem gerar ciclo por ação administrativa explícita. Planos de provider não renovam apenas pela passagem do tempo.

## Resgate e complemento

Ao selecionar o benefício, o backend valida a assinatura, o plano, a sessão/formato, a quantidade de ingressos e os créditos ainda válidos. A operação crítica usa bloqueio transacional; cada unidade é reservada para um único pedido.

```text
Valor do ingresso         R$ 15,00
Crédito de referência    -R$ 10,00
Complemento               R$  5,00
```

O complemento usa o pagamento normal e mantém idempotência, reserva de poltrona e confirmação por webhook. Recusa, cancelamento ou expiração liberam o crédito reservado. O resgate só passa para `redeemed` quando o pedido é finalizado e o ticket é emitido.

O ticket registra `basePrice`, `subscriptionCreditAmount`, `additionalPaymentAmount`, `paymentSource` e `subscriptionCreditId`, além de número sequencial único.

## Bomboniere

O navegador informa apenas item e quantidade. O backend obtém preço, assinatura, percentual, exclusões, itens grátis e limite no catálogo persistido. Cada mercadoria registra preço original, desconto do Clube e preço final.

Pedidos mistos expõem separadamente `serviceSubtotal`, `goodsSubtotal`, `clubCreditsApplied`, `clubDiscount`, `additionalPayment` e total do pedido.

## Preparação fiscal

Ingressos não disparam NFS-e individual. O status do serviço pode permanecer `not_applicable`, `accounted_externally` ou `pending_accounting_rule`, conforme orientação contábil futura.

Mercadorias usam `GoodsFiscalService` e a interface abstrata `NfceProvider` (`issue`, `getStatus`, `cancel`). Nenhum provider real, certificado A1, XML próprio ou integração Focus NFe foi instalado. O gatilho global, restrito ao owner, pode ser `payment_approved` ou `goods_delivered`.

Estados previstos: `not_required`, `waiting_trigger`, `pending`, `authorized`, `contingency`, `cancelled` e `error`. A chave `goods-fiscal:<orderId>` impede emissão duplicada.

## Contabilidade

Somente o owner pode definir, com orientação do contador, `ticketComponentValue`, `benefitsComponentValue`, `ruleVersion` e `effectiveFrom`. Cada mudança gera uma versão histórica e os ciclos guardam snapshots, evitando alterar o significado de pagamentos antigos.

Continuam pendentes de validação contábil: reconhecimento de mensalidade, créditos emitidos/usados/expirados, componentes do plano e momento operacional da NFC-e.

## Relatórios e Admin

O dashboard e o CSV por período separam receita de ingressos, bomboniere e assinatura; créditos emitidos, usados e expirados; ingressos via Clube; complementos; cortesias; descontos de mercadorias; NFC-e autorizadas e pendências.

O detalhe da assinatura mostra mensalidades, ciclos, créditos e resgates. O detalhe do pedido separa serviços, mercadorias, crédito, complemento e situação fiscal de cada trilha.

## Homologação

- Implementado e testado automaticamente: domínio, migration, concorrência, idempotência, descontos, composição de pedido, relatórios e abstrações.
- Provider recorrente real: adapter Mercado Pago existente, ainda exige credenciais e homologação no ambiente do cinema.
- Provider NFC-e real: não implementado por decisão de arquitetura.
- Produção: só é considerada homologada após transações reais, conciliação e validação do contador.
