# PagBank no Cine Cruzeiro: mapa e limites

## Fluxo anterior (Mercado Pago)

| Operacao | Implementacao atual |
| --- | --- |
| Checkout Pix/cartao | `POST /api/payments/pix` e `/api/payments/card`; preco recalculado no servidor, idempotencia, reserva de poltronas/estoque, pagamento persistido e ingresso somente apos aprovacao. |
| Confirmacao | Webhook assinado `/api/webhooks/mercado-pago` e conciliacao em `GET /api/checkout/orders/:id`. |
| Estorno | Pedido completo, apenas ingressos ou apenas bomboniere; intencao persistida antes da chamada e confirmacao consultada no provedor. |
| Bilheteria | Mercado Pago Point cria cobranca no terminal e vincula impressao/ingressos ao status confirmado. Dinheiro, cortesia e Pix externo sao fluxos locais distintos. |
| Clube | Assinatura recorrente via Checkout hospedado e API de recorrencia Mercado Pago. |

## PagBank implementado

| Operacao | Estado |
| --- | --- |
| Exclusividade | Ativar PagBank exige desativar Mercado Pago em **Admin > Integracoes**; o backend tambem recusa configuracao dupla. Credenciais do provedor antigo permanecem para consultar/reembolsar cobrancas historicas. |
| Pix online | API Orders, QR copia-e-cola, mesmo preco/reserva/estoque/ingresso do checkout existente. |
| Cartao online | SDK PagBank criptografa no navegador; o backend recebe apenas o cartao criptografado e os dados do titular, nunca PAN/CVV. |
| Confirmacao | Webhook `/api/webhooks/pag-bank` valida `x-authenticity-token` sobre o corpo bruto e consulta o pedido na API antes de alterar estado. Referencia e valor precisam coincidir; eventos repetidos sao deduplicados. |
| Conciliacao | Consulta de status de pedido tambem suporta PagBank. Pagamento confirmado apos expirar a reserva fica sem ingresso e requer conciliacao humana para evitar venda duplicada da poltrona. |
| Estorno online | `POST /charges/{id}/cancel` para valor integral ou parcial, com chave idempotente. A operacao local somente conclui apos a consulta do pedido confirmar o valor devolvido. |
| Bilheteria Tap On | **Nao ativada.** O Point nao pode ser reutilizado como Tap On. As tentativas de venda em cartao retornam erro explicito enquanto nao houver app nativo Android de operacao homologado. Dinheiro e Pix externo continuam disponiveis. |
| Clube recorrente | **Nao ativado no PagBank.** A conta deve ter o produto de assinaturas habilitado e o fluxo proprio de plano, checkout, renovacao, cancelamento e webhooks precisa ser homologado. O endpoint recusa novas assinaturas quando PagBank esta ativo; assinaturas historicas Mercado Pago ainda podem ser tratadas. |

## Configuracao e seguranca

1. Para testes, usar token e chave publica Sandbox juntos. A API de cartoes de teste usa `/orders` no Sandbox. Para operar com cobrancas reais, solicitar habilitacao de Orders/Pix/cartao, token de producao e chave publica `card` na conta PagBank. Uma chave de assinaturas nao serve para o checkout comum.
2. Inserir token e chave publica em **Admin > Integracoes > PagBank**. Testar as credenciais e verificar a correspondencia da chave. Desativar Mercado Pago antes de ativar PagBank.
3. O checkout permite usar o Sandbox mesmo quando o Cine Cruzeiro esta hospedado em runtime de producao. O checkout mostra um aviso de teste; pedidos aprovados pelo Sandbox podem criar pedidos e ingressos na base conectada. Antes de aceitar clientes, substituir o ambiente, token e chave por credenciais de producao homologadas.
4. Manter `PAGBANK_ACCESS_TOKEN` somente no servidor. A chave publica pode ser entregue ao checkout. Nunca gravar numero/CVV de cartao, AppKey Tap On, cabecalhos de autorizacao ou payload bruto do cliente em logs.
5. Aplicar a migracao `041_pagbank_payment_provider.sql` antes de habilitar PagBank para que pagamentos `pag_bank` possam ser persistidos.

O botao **Testar** valida o token e a chave publica `card`, mas nao cria um pedido. A documentacao do PagBank direciona os cartoes de teste para a API Orders no Sandbox; use credenciais de Sandbox para esses testes. Se a API de Producao responder `whitelist access required`, solicitar homologacao e liberacao da API de Pedidos em producao pelo [canal oficial de homologacao](https://developer.pagbank.com.br/docs/solicitar-homologacao). Nao tentar contornar a restricao com outro endpoint ou marcar um pedido como pago manualmente. Enquanto a liberacao nao for confirmada, usar Sandbox para testes ou reativar Mercado Pago para cobrancas reais.

## Tap On Android: trabalho ainda necessario

Tap On e uma extensao Android acionada por `Intent`, nao um endpoint web nem PlugPag Bluetooth. O app nativo de **operacao** (nao o app CineLumix do cliente) devera: obter AppKey homologada, validar Android 11+/NFC e pacote instalado, iniciar a `Intent` com `.setPackage("br.com.uol.ps.tapon")`, receber `TransactionResult`, conferir codigo/valor com o servidor e somente entao emitir e imprimir ingressos. Precisara tambem tratar estorno por `Intent`, cancelamento, reconexao, duplicidade, comprovante com bandeira e conciliacao de venda cujo retorno ao app se perdeu. Nao e seguro marcar uma venda como paga a partir de um campo enviado pelo navegador.

## Fontes oficiais

- [Orders Pix](https://developer.pagbank.com.br/reference/criar-pedido-com-qr-code-pix-v2)
- [Orders cartao](https://developer.pagbank.com.br/reference/criar-pagar-pedido-com-cartao)
- [Chave publica e criptografia](https://developer.pagbank.com.br/docs/chaves-publicas)
- [Autenticidade dos webhooks](https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao)
- [Consulta do pedido](https://developer.pagbank.com.br/reference/consultar-pedido)
- [Estorno/cancelamento da cobranca](https://developer.pagbank.com.br/reference/cancelar-pagamento)
- [Tap On Android](https://developer.pagbank.com.br/docs/tap-on)
- [Pagamentos recorrentes](https://developer.pagbank.com.br/docs/pagamentos-recorrentes)
