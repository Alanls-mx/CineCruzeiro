# Integração Webhook CRM e alertas operacionais

## Webhook CRM

O Webhook CRM envia eventos selecionados do Cine Cruzeiro para um CRM ou automação externa. Ele serve para sincronizar contatos, pedidos e atividades, acompanhar pagamentos reportados pelo site, validar ingressos, receber leads do Clube e registrar solicitações de locação. Não é o endpoint de retorno do Mercado Pago nem a API de leitura do catálogo.

### Configurar

No painel, abra **Administração → Integrações → Webhook CRM → Configurar**. Informe:

- **URL do webhook**: endpoint HTTPS do receptor.
- **Segredo**: chave compartilhada forte, exclusiva para esta integração; o sistema a armazena criptografada e a mostra mascarada.
- **Eventos enviados ao CRM**: selecione os nomes de evento desejados. A lista agora é aplicada na entrada e novamente antes de retirar um item pendente da fila.
- **Timeout**: tempo máximo por tentativa, limitado pelo backend entre 1 e 30 segundos.
- **Tentativas**: número de novas tentativas além da inicial, limitado a 8.

O conjunto aceito é: `order.created`, `payment.created`, `payment.approved`, `payment.rejected`, `payment.expired`, `payment.refunded`, `ticket.created`, `ticket.used`, `club_lead.created`, `private_rental.inquiry` e `password_reset.requested`. O endpoint `POST /api/events` rejeita nomes fora dessa lista. A URL/segredo de ambiente (`CRM_WEBHOOK_URL` ou `LUMIX_WEBHOOK_URL`, e `CRM_WEBHOOK_SECRET` ou `LUMIX_WEBHOOK_SECRET`) é uma alternativa operacional; habilite a integração no painel para iniciar o worker.

### Envelope e assinatura

O corpo JSON encaminhado contém os campos recebidos para o evento e acrescenta `eventId`, `timestamp` e `cinemaId: "cine_cruzeiro_sala_1"`. O `eventId` permanece estável em todas as tentativas daquela entrada e deve ser usado pelo CRM como chave de idempotência. O campo de data do corpo representa a criação do evento; o timestamp de autenticação é enviado separadamente e renovado em cada tentativa.

Headers enviados em teste e produção:

```text
X-Origin-Client: CineCruzeiro-Backend
X-Cine-Cruzeiro-Timestamp: <epoch Unix em segundos>
X-Cine-Cruzeiro-Signature: sha256=<HMAC hexadecimal>
X-Cine-Cruzeiro-Event-Id: <id estável do evento>
X-Cine-Cruzeiro-Event: <nome do evento>
```

A assinatura é HMAC-SHA256 sobre os bytes UTF-8 do texto JSON exato enviado, prefixados pelo timestamp e um ponto:

```text
HMAC_SHA256(segredo, timestamp + "." + corpo_json_exato)
```

O receptor deve validar o formato e a assinatura em comparação de tempo constante, rejeitar timestamps fora de uma janela curta (por exemplo, cinco minutos) e guardar os `eventId` já processados para impedir duplicações. Exemplo Node.js para a verificação:

```js
const expected = "sha256=" + crypto
  .createHmac("sha256", secret)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");

const valid = Buffer.byteLength(expected) === Buffer.byteLength(signature)
  && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```

`rawBody` precisa ser preservado antes do parser JSON e `timestamp` validado separadamente. O botão **Testar** envia um envelope sintético `integration.tested` usando a mesma URL, segredo, timeout, formato e headers; ele testa conectividade/assinatura, não simula pagamento.

### Fila, tentativas e dead letter

O evento selecionado é gravado primeiro na tabela PostgreSQL `crm_webhook_outbox` (ou no armazenamento JSON no modo local) e só então o endpoint retorna `202`. Um worker em segundo plano envia os itens sem manter a requisição do visitante aberta. A tabela de produção é criada pela migração `040_crm_webhook_outbox.sql`.

- `retryLimit = 2` significa até três tentativas totais: a inicial e duas repetições.
- Falhas de rede, timeout, HTTP 408/425/429 e respostas 5xx são repetidas com espera exponencial limitada a 15 minutos; `Retry-After` é respeitado até esse limite.
- Outras respostas 4xx são tratadas como permanentes e vão diretamente para dead letter.
- Ao esgotar as tentativas, o item fica em dead letter. O painel exibe os totais e **Reenfileirar falhas** reinicia as tentativas desses itens.
- Um item ainda pendente que deixar de estar selecionado é marcado como cancelado antes do envio. Itens em processamento podem terminar a tentativa já iniciada.
- O worker recupera leases de processamento abandonados após dois minutos. Há limite de 10 mil itens pendentes; excedê-lo faz a entrada retornar erro 503, em vez de confirmar uma gravação inexistente.
- Itens entregues são retidos por 30 dias; dead letters e cancelados, por 90 dias. A retenção reduz o tempo de permanência de dados potencialmente pessoais na fila.

O serviço receptor deve responder com HTTP 2xx somente após aceitar o evento e persistir o trabalho que fará. Uma repetição usa o mesmo `eventId`; o CRM deve deduplicar por esse ID. Assinatura válida prova que a mensagem veio de quem possui o segredo, mas não torna os dados do evento uma fonte contábil.

### Limites de confiança e privacidade

`POST /api/events` é uma entrada iniciada pelo site e tem uma lista de nomes permitidos, mas nem todos os dados comerciais que o cliente envia são uma confirmação independente do estado no banco ou no provedor de pagamento. Em especial, use eventos de pagamento como notificações para reconciliação; para decisões financeiras ou emissão de benefícios, confirme o estado no backend/PSP. A assinatura HMAC protege o salto Cine Cruzeiro → CRM, não autentica a origem do primeiro envio ao Cine Cruzeiro.

O backend valida os campos da solicitação `private_rental.inquiry` e exige sucesso da entrega de e-mail antes de enfileirá-la. Esse evento pode conter nome, telefone, e-mail, data pretendida e observações. `password_reset.requested` pode conter e-mail. Restrinja o acesso ao banco e à fila, minimize campos no CRM e configure no destino uma política de retenção compatível. Nunca inclua o segredo em query string ou no corpo do evento.

## Alertas operacionais no Discord

A integração **Alertas operacionais Discord** envia embeds para um webhook privado:

- avisos e erros emitidos pelo backend, incluindo falhas HTTP;
- anomalias e recuperações do monitor de desempenho;
- sinais heurísticos de padrões comuns de SQL injection em caminho/query e probes de rotas conhecidas;
- resumo periódico de CPU, memória, disco livre, latência HTTP p95, erros 5xx e event loop.

Respostas HTTP de erro são enviadas como alertas. Eventos informativos e respostas bem-sucedidas só são incluídos com **Incluir eventos informativos**, opção que pode gerar volume alto. O envio é assíncrono, agrupado em até cinco embeds por mensagem, com fila em memória limitada a 200 eventos e repetição curta para falhas transitórias; em sobrecarga são contados eventos omitidos. Diferentemente do CRM, essa fila não é persistente.

Alertas de segurança não bloqueiam requisições. A heurística SQLi pode produzir falsos positivos, examina apenas URL/query e não é um WAF nem um detector completo de intrusão. Os embeds omitem IP, e-mail, telefone, credenciais e conteúdo de formulário/requisição; menções automáticas do Discord ficam desativadas.

Configure a URL em **Administração → Integrações → Alertas operacionais Discord**, teste e ative. Só são aceitas URLs HTTPS de webhook em `discord.com/api/webhooks/...`; o URL completo é tratado como segredo e armazenado criptografado. O resumo de saúde ocorre a cada cinco minutos por padrão (configurável entre 1 e 60). A variável alternativa é `DISCORD_ALERTS_WEBHOOK_URL`, mas também é necessário habilitar a integração no painel.
