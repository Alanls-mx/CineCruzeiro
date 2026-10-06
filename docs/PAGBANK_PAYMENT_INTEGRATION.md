# PagBank no Cine Cruzeiro: mapa e limites

## Fluxo anterior (Mercado Pago)

| Operacao | Implementacao atual |
| --- | --- |
| Checkout Pix/cartao | `POST /api/payments/pix` e `/api/payments/card`; preco recalculado no servidor, idempotencia, reserva de poltronas/estoque, pagamento persistido e ingresso somente apos aprovacao. |
| Confirmacao | Webhook assinado `/api/webhooks/mercado-pago` identifica o recurso; o servidor consulta o pedido diretamente no Mercado Pago antes de alterar pagamento, pedido ou ingresso. Falhas de consulta retornam 503 para nova tentativa. Conciliacao adicional em `GET /api/checkout/orders/:id`. |
| Estorno | Pedido completo, apenas ingressos ou apenas bomboniere; intencao persistida antes da chamada e confirmacao consultada no provedor. |
| Bilheteria | Mercado Pago Point cria cobranca no terminal e vincula impressao/ingressos ao status confirmado. Dinheiro, cortesia e Pix externo sao fluxos locais distintos. |
| Clube | Assinatura recorrente via Checkout hospedado e API de recorrencia Mercado Pago. |

## PagBank implementado

| Operacao | Estado |
| --- | --- |
| Exclusividade | Ativar PagBank exige desativar Mercado Pago em **Admin > Integracoes**; o backend tambem recusa configuracao dupla. Credenciais do provedor antigo permanecem para consultar/reembolsar cobrancas historicas. |
| Pix online | API Orders, QR copia-e-cola, mesmo preco/reserva/estoque/ingresso do checkout existente. |
| Cartao online | SDK PagBank criptografa no navegador; o backend recebe apenas o cartao criptografado e os dados do titular, nunca PAN/CVV. |
| Confirmacao | Webhook `/api/webhooks/pag-bank` valida preferencialmente `x-payload-signature` (ECDSA com a chave publica de webhook do PagBank); o formato legado `x-authenticity-token` tambem e aceito. Consulta o pedido na API antes de alterar estado. Referencia e valor precisam coincidir; eventos repetidos sao deduplicados. |
| Conciliacao | Consulta de status de pedido tambem suporta PagBank. Pagamento confirmado apos expirar a reserva fica sem ingresso e requer conciliacao humana para evitar venda duplicada da poltrona. |
| Estorno online | `POST /charges/{id}/cancel` para valor integral ou parcial, com chave idempotente. A operacao local somente conclui apos a consulta do pedido confirmar o valor devolvido. |
| Bilheteria Tap On | **Nao ativada.** O Point nao pode ser reutilizado como Tap On. As tentativas de venda em cartao retornam erro explicito enquanto nao houver app nativo Android de operacao homologado. Dinheiro e Pix externo continuam disponiveis. |
| Clube recorrente | **Nao ativado no PagBank.** A conta deve ter o produto de assinaturas habilitado e o fluxo proprio de plano, checkout, renovacao, cancelamento e webhooks precisa ser homologado. O endpoint recusa novas assinaturas quando PagBank esta ativo; as paginas do Clube mostram a pausa antes de enviar o cliente ao checkout. Assinaturas historicas Mercado Pago ainda podem ser tratadas. |

## Configuracao e seguranca

1. Para testes, usar token e chave publica Sandbox juntos. A API de cartoes de teste usa `/orders` no Sandbox. Para operar com cobrancas reais, solicitar habilitacao de Orders/Pix/cartao, token de producao e chave publica `card` na conta PagBank. Uma chave de assinaturas nao serve para o checkout comum.
2. Inserir token e chave publica em **Admin > Integracoes > PagBank**. Testar as credenciais e verificar a correspondencia da chave. Desativar Mercado Pago antes de ativar PagBank.
3. O checkout permite usar o Sandbox mesmo quando o Cine Cruzeiro esta hospedado em runtime de producao. O checkout mostra um aviso de teste; pedidos aprovados pelo Sandbox podem criar pedidos e ingressos na base conectada. Antes de aceitar clientes, substituir o ambiente, token e chave por credenciais de producao homologadas.
4. Manter `PAGBANK_ACCESS_TOKEN` somente no servidor. A chave publica pode ser entregue ao checkout. Nunca gravar numero/CVV de cartao, AppKey Tap On, cabecalhos de autorizacao ou payload bruto do cliente em logs.
5. Aplicar a migracao `041_pagbank_payment_provider.sql` antes de habilitar PagBank para que pagamentos `pag_bank` possam ser persistidos.

O botao **Testar** valida o token e a chave publica `card`, mas nao cria um pedido. A documentacao do PagBank direciona os cartoes de teste para a API Orders no Sandbox; use credenciais de Sandbox para esses testes. Se a API de Producao responder `whitelist access required`, solicitar homologacao e liberacao da API de Pedidos em producao pelo [canal oficial de homologacao](https://developer.pagbank.com.br/docs/solicitar-homologacao). Nao tentar contornar a restricao com outro endpoint ou marcar um pedido como pago manualmente. Enquanto a liberacao nao for confirmada, usar Sandbox para testes ou reativar Mercado Pago para cobrancas reais.

## Tap On Android: passo a passo de integracao e uso

**Estado atual:** o Tap On presencial ainda nao esta implementado no Cine Cruzeiro. Com PagBank ativo, vendas em cartao pela bilheteria e bomboniere retornam `TAP_ON_ANDROID_NOT_CONNECTED` em vez de registrar uma cobranca ficticia. O checkout PagBank online (Orders, token e chave publica `card`) e separado do Tap On; a AppKey do Tap On nao e a chave publica do cartao nem uma credencial PlugPag Bluetooth. Este roteiro descreve a implantacao necessaria, nao uma funcionalidade ja liberada.

### 1. Solicitar acesso e homologacao ao PagBank

1. Preencher o [formulario de parceria PagBank](https://pagbank.com.br/para-seu-negocio/parcerias/) para automacao comercial, indicando que a solucao e um **aplicativo Android de operacao de bilheteria** integrado a Tap On. O PagBank avalia a empresa e o modelo de negocio; a conta vendedora do cinema tambem precisa existir.
2. Participar da reuniao tecnica. Solicitar a **AppKey de QA** e as instrucoes de instalacao da extensao de testes. Nao usar a AppKey de producao ou o token Orders em QA.
3. Desenvolver e testar o APK. Abrir a solicitacao de homologacao pelo [canal de integracoes PagBank](https://app.pipefy.com/public/form/RrlV4wD0), enviando os dados e o APK pedidos pelo time tecnico.
4. Apos a aprovacao, receber a **AppKey de producao** e instalar a extensao de producao nos aparelhos da bilheteria. Nao habilitar o botao de cartao presencial antes da homologacao e de uma venda real conciliada.

O processo de parceria, a AppKey de QA e a AppKey de producao sao exigencias descritas no [guia oficial Tap On](https://developer.pagbank.com.br/docs/tap-on). A liberacao da API Orders para o site nao libera automaticamente esta integracao presencial.

### 2. Preparar cada aparelho e o operador

- Usar Android API 30 (Android 11) ou superior, NFC ativo, conta PagBank do vendedor e extensao PagBank Tap On instalada com `versionCode >= 51`. A versao de QA usa o pacote `br.com.uol.ps.tapon.debug`; producao usa `br.com.uol.ps.tapon`.
- No primeiro pagamento, o operador entra na conta PagBank dentro da extensao. O login separado e opcional e deve ser usado apenas se a versao instalada o suportar (a documentacao informa a partir da release 3.26.0).
- Conferir rede, horario do aparelho, permissao de uso da bilheteria no Cine Cruzeiro e impressora/comprovante. O valor aceito pelo Tap On deve respeitar os limites informados no guia oficial (R$ 1,00 a R$ 10.000,00).
- Guardar a AppKey no app de operacao por ambiente, sem expo-la no site, no painel web, em logs ou em capturas. Aplicar controles de acesso ao aparelho e revogar credenciais perdidas.

### 3. Criar uma venda pendente no Cine Cruzeiro

**A implementar no backend e no app Android:** criar um fluxo proprio de Tap On para bilheteria e bomboniere. O app autenticado envia a selecao de sessao, assentos, ingressos e produtos; o servidor recalcula o total, reserva assentos/estoque e devolve `saleId`, `requestId`, valor em centavos e prazo da reserva. Persistir uma tentativa `pending_payment` com `provider=pag_bank`, `channel=tap_on` e chave idempotente. Uma repeticao do mesmo `requestId` deve devolver a mesma tentativa, nunca gerar uma segunda venda.

Nao reutilizar `POST /api/box-office/sales` como se ja aceitasse Tap On: atualmente ele rejeita cartao presencial com HTTP 412. Os endpoints Android de iniciar, confirmar, consultar e estornar a tentativa **ainda precisam ser definidos e implementados**. A interface web nao deve poder declarar `paid` por conta propria.

### 4. Abrir o Tap On no Android

O app nativo monta `TapOnPaymentData` em JSON com `appKey`, `appName`, `appVersion`, `androidId` (`Settings.Secure.ANDROID_ID`), `saleAmount` em reais e `enableTaxPassThrough`. Inicialmente usar `false` para repasse de taxas, para que o valor apresentado coincida com o total calculado pelo Cine Cruzeiro; qualquer mudanca nesta regra exige recalculo, exibicao clara ao cliente e nova homologacao.

```kotlin
val packageName = if (isQa) "br.com.uol.ps.tapon.debug" else "br.com.uol.ps.tapon"
val payload = JSONObject().apply {
    put("appKey", tapOnAppKey)
    put("appName", "Cine Cruzeiro Operacao")
    put("appVersion", BuildConfig.VERSION_NAME)
    put("androidId", Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID))
    put("saleAmount", amountCents / 100.0)
    put("enableTaxPassThrough", false)
}
val intent = Intent("br.com.uol.ps.tapon.OPEN_APP")
    .addCategory(Intent.CATEGORY_DEFAULT)
    .setPackage(packageName)
    .putExtra("TAP_ON_PAYMENT_DATA", payload.toString())
tapOnLauncher.launch(intent)
```

`tapOnLauncher` representa um launcher de resultado de Activity registrado pelo app. Verificar se o pacote de destino esta instalado antes de abrir a `Intent`. O `.setPackage(...)` e obrigatorio: sem ele, outro aplicativo poderia interceptar os dados da transacao.

### 5. Receber, verificar e concluir

1. Ler `resultTapOnSuccessJson` somente quando a Activity retornar sucesso. O JSON `TransactionResult` inclui `saleValue`, `paymentMethod`, `transactionCode`, `transactionDateTime` e `cardBrand`. Falta de retorno, cancelamento ou erro **nao** equivale a pagamento recusado nem autoriza uma segunda cobranca imediata.
2. Enviar ao backend a tentativa local, o `transactionCode` e os campos necessarios para conciliacao. Conferir valor em centavos, conta/cinema, operador, venda pendente e unicidade do codigo. O retorno do Android, isoladamente, nao e prova confiavel para liberar ingressos: o metodo de confirmacao independente da transacao Tap On com o PagBank deve ser acertado na reuniao tecnica e implementado antes da producao. Nao presumir que `GET /orders/{id}` da API online consulte transacoes Tap On.
3. Enquanto a confirmacao independente nao existir ou estiver indisponivel, manter a tentativa como **pendente de conciliacao**; nao emitir ingresso, baixar estoque definitivamente nem registrar receita aprovada. Se o PagBank confirmar pagamento, finalizar a venda de forma atomica, uma unica vez, emitir os ingressos e imprimir/entregar o comprovante.
4. No comprovante de venda aprovada, exibir o logotipo da bandeira devolvida em `cardBrand`, requisito do guia oficial. Nao registrar nome completo do portador, dados de cartao ou JSON bruto em logs.

### 6. Tratar queda, duplicidade e estorno

- Se o app fechar ou perder conexao apos o cliente aproximar o cartao, consultar a tentativa e a transacao no fluxo de conciliacao aprovado pelo PagBank. Mostrar **resultado pendente** ao operador; nao refazer a cobranca automaticamente. Registrar alerta para revisao quando nao houver confirmacao independente.
- Associar `transactionCode` a no maximo uma tentativa; reenvios do app devem ser idempotentes. Expiracao de reserva com pagamento posterior exige decisao operacional de reacomodar ou devolver, nunca emissao automatica para assento ja liberado.
- Implementar estorno Tap On por `Intent` com `TapOnVoidPaymentData` (`transactionCode`, valor, AppKey, identificacao do app/dispositivo e um UUID unico `refCode`), conforme o guia oficial. Persistir a intencao de estorno antes da chamada e concluir o cancelamento local somente apos evidencia confirmada. O endpoint online `POST /charges/{id}/cancel` nao substitui o fluxo de estorno Tap On sem confirmacao expressa do PagBank.

### 7. Validar em QA e liberar a operacao

Testar no aparelho real: credito, debito, transacao recusada, cancelamento pelo cliente, NFC desligado, extensao ausente/desatualizada, AppKey invalida, valor divergente, duas tentativas com o mesmo `requestId`, queda de rede antes/depois da aproximacao, retorno perdido, estorno total/parcial e impressao com bandeira. Comparar cada transacao com o extrato/relatorio disponibilizado pelo PagBank e conferir que a quantidade de ingressos emitidos corresponde exatamente a vendas confirmadas. Depois da homologacao, repetir uma venda de baixo valor em producao, conferir liquidacao e so entao habilitar cartao presencial para operadores.

### 8. Utilizar na bilheteria depois da ativacao

1. O operador entra no app Android de operacao e seleciona a sessao, as poltronas, os tipos de ingresso e os produtos da bomboniere. Confere com o cliente o total calculado pelo servidor.
2. Seleciona **Cartao por aproximacao (Tap On)**. O app cria ou recupera a tentativa pendente e abre a extensao PagBank no mesmo aparelho. O cliente aproxima o cartao ou dispositivo NFC e acompanha o resultado na tela do Tap On.
3. Ao voltar ao app, o operador aguarda a confirmacao conciliada pelo backend. Apenas o status **aprovado e confirmado** libera impressao, QR Code e entrega de ingressos/produtos. Recusa permite iniciar uma nova tentativa; retorno inconclusivo exige consulta da tentativa existente.
4. Antes de uma nova cobranca ou estorno, o operador consulta o historico da venda pelo `saleId`/`transactionCode`. Se a cobranca constar no PagBank mas nao no Cine Cruzeiro, encaminha para conciliacao, sem emitir um segundo ingresso ou cobrar novamente por suposicao.

## Fontes oficiais

- [Orders Pix](https://developer.pagbank.com.br/reference/criar-pedido-com-qr-code-pix-v2)
- [Orders cartao](https://developer.pagbank.com.br/reference/criar-pagar-pedido-com-cartao)
- [Chave publica e criptografia](https://developer.pagbank.com.br/docs/chaves-publicas)
- [Autenticidade dos webhooks](https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao)
- [Consulta do pedido](https://developer.pagbank.com.br/reference/consultar-pedido)
- [Estorno/cancelamento da cobranca](https://developer.pagbank.com.br/reference/cancelar-pagamento)
- [Tap On Android](https://developer.pagbank.com.br/docs/tap-on)
- [Pagamentos recorrentes](https://developer.pagbank.com.br/docs/pagamentos-recorrentes)
