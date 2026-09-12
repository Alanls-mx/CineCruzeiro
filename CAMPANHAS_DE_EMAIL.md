# Campanhas de e-mail do Cine Cruzeiro

## 1. Escopo

Este documento descreve a implementação atual de `Marketing > Campanhas`: criação e prévia, templates, IA, segmentação, persistência PostgreSQL, fila, envio, consentimento, auditoria e recuperação após falhas.

O módulo separa campanhas de marketing, que exigem consentimento e incluem descadastro, de mensagens transacionais, como confirmação de compra e entrega de ingresso. Mensagens transacionais continuam no fluxo próprio de `emailService.js` e não dependem do consentimento de marketing.

O antigo editor visual livre foi removido. Registros antigos continuam legíveis em modo `legacy_visual`, mas não podem ser alterados diretamente. Ao duplicar um registro legado, a cópia é convertida para o modelo atual e preserva o conteúdo textual recuperável.

## 2. Arquitetura

### Interface administrativa

- `backend/public/admin.html`: formulário, etapas, agente de IA, templates, prévia, histórico, filtros e relatório.
- `backend/public/admin.js`: estado, composição do HTML, validação, API, paginação e ações.
- `backend/public/admin-premium.css`: layout responsivo, estados, histórico compacto e relatório.

### Backend

- `backend/server.js`: autorização, validação comercial, segmentação, endpoints, anexos, descadastro e inicialização do worker.
- `backend/services/emailCampaignRepository.js`: persistência, transições e concorrência.
- `backend/services/emailCampaignWorker.js`: polling, lease, lotes, retentativas e reconciliação.
- `backend/services/emailService.js`: SMTP, webhook, renderização e classificação da entrega.
- `backend/services/emailCampaignAiProviderService.js`: contrato comum de IA.
- `backend/services/emailCampaignAiService.js`: contexto seguro e coerência do conteúdo.
- `backend/services/geminiEmailAgentService.js`: único provedor de IA e resolução de modelo.
- `backend/db/migrations/029_email_campaign_reliability.sql`: tabelas, índices e migração legada.
- `backend/db/migrations/030_remove_openai_campaign_integration.sql`: remoção da configuração OpenAI descontinuada.

### Fluxo

1. O operador escolhe público e conteúdo.
2. A API valida catálogo, oferta, consentimento, anexos e URLs.
3. O rascunho é persistido em `email_campaigns`.
4. Ao enviar ou agendar, o público elegível é fotografado em `email_campaign_recipients`.
5. O worker reivindica uma campanha com lock atômico.
6. Antes de cada lote, catálogo, oferta e público são revalidados.
7. Cada destinatário é reivindicado com `FOR UPDATE SKIP LOCKED`.
8. A tentativa é registrada antes da chamada ao provedor.
9. Resultado e identificador remoto são persistidos.
10. A campanha é concluída, adiada ou marcada com erro.

## 3. Persistência

### `email_campaigns`

Armazena conteúdo, template, marca, cores, CTA, anexos, filme, cupom, plano, bomboniere, público, metadados de IA, agendamento, estado, contadores e lease do worker. `idempotency_key` impede criação duplicada quando o cliente repete a mesma requisição.

### `email_campaign_recipients`

É a fotografia individual do público:

- `recipient_key` é único por campanha;
- nome e e-mail são snapshots;
- `delivery_id` é estável e único;
- `attempt_count` nunca é apagado;
- `manual_retry_granted` libera uma nova tentativa sem reutilizar numeração;
- provedor, ID remoto e erro ficam registrados;
- locks individuais impedem dois workers de enviar ao mesmo destinatário.

Estados: `pending`, `processing`, `sent`, `retryable_failed`, `failed`, `unknown`, `suppressed` e `cancelled`.

### `email_delivery_attempts`

Mantém uma linha por tentativa, com restrição única em destinatário e número. Registra início, conclusão, provedor, ID remoto, classificação, erro, possibilidade de retentativa e metadados. O histórico não é apagado.

### `email_delivery_events`

Estrutura preparada para eventos `accepted`, `delivered`, `soft_bounce`, `hard_bounce`, `complained`, `opened` e `clicked`. A ingestão pública ainda não existe; a interface não inventa essas métricas.

### Consentimento

- `email_marketing_preferences`: consentimento por usuário, origem, versão e datas.
- `email_unsubscribe_tokens`: tokens armazenados pelo hash, com validade e uso.
- `email_suppressions`: hash do e-mail para impedir reentrada por outra origem.

### Migração legada

A migração 029 é idempotente, importa `settings.app.emailCampaigns`, converte estados antigos, preserva HTML, IA, anexos e blocos, migra descadastros/tokens para hash e remove campanhas do JSON após a importação.

## 4. Ciclo de vida

- `draft`: editável.
- `scheduled`: aguarda `schedule_at`.
- `queued`: pronta para claim.
- `sending`: possui lease ativo.
- `completed`: terminou sem falhas conhecidas.
- `completed_with_errors`: parte enviada e parte falhou.
- `failed`: falha total ou de validação.
- `cancelled`: cancelada pelo operador.

Transições válidas:

- `draft -> scheduled | queued`
- `scheduled -> queued | cancelled`
- `queued -> sending | cancelled`
- `sending -> completed | completed_with_errors | failed | cancelled`
- `failed -> queued | cancelled`
- `completed_with_errors -> queued`, apenas por retentativa segura

Campanhas processadas são imutáveis. Exclusão física só ocorre para rascunho sem tentativas; registros com histórico são arquivados logicamente.

## 5. Concorrência e recuperação

`claimCampaign()` e `claimRecipients()` usam transação e `FOR UPDATE SKIP LOCKED`. Só uma instância recebe cada registro.

Se o processo cair depois do claim, mas antes de criar a tentativa, o destinatário volta a `pending` e o contador é restaurado. Se já existe tentativa `started`, o resultado vira `unknown` e não é reenviado automaticamente, pois o provedor pode ter aceitado a mensagem.

Falhas temporárias usam atraso exponencial. O limite padrão é três tentativas. Após o limite, o operador pode liberar uma tentativa manual; ela ganha novo número e mantém todo o histórico. Resultado `unknown` nunca entra nesse reenvio.

O banco impede claims duplicados. SMTP não oferece idempotência universal, portanto a implementação não promete entrega exatamente uma vez: ela para resultados incertos para revisão.

## 6. Worker

O worker inicia somente com PostgreSQL. O modo JSON mantém compatibilidade local, mas não executa fila durável.

| Variável | Padrão | Limites | Função |
| --- | ---: | ---: | --- |
| `EMAIL_CAMPAIGN_POLL_MS` | `5000` | 1000 a 60000 | intervalo de busca |
| `EMAIL_CAMPAIGN_LEASE_MS` | `120000` | 30000 a 900000 | vencimento do lease |
| `EMAIL_CAMPAIGN_BATCH_SIZE` | `20` | 1 a 100 | destinatários por lote |
| `EMAIL_CAMPAIGN_MAX_ATTEMPTS` | `3` | 1 a 5 | tentativas automáticas |
| `EMAIL_CAMPAIGN_CONCURRENCY` | `2` | 1 a 10 | envios simultâneos |

`SIGINT` e `SIGTERM` interrompem novos polls. Locks abandonados são recuperados após o lease.

## 7. Segmentação

- `all`: clientes com consentimento.
- `recent`: compra aprovada nos últimos 180 dias.
- `purchased`: ao menos uma compra aprovada.
- `reactivation`: já comprou, mas não compra há 30 a 730 dias; padrão 90.
- `selected`: seleção manual de até 5.000 IDs.
- `birthday_manual`: seleção manual para aniversário.

Não há data de nascimento confiável no banco, portanto aniversário não é automático.

São excluídos e-mails inválidos, opt-outs, hashes suprimidos e clientes inelegíveis para a oferta. O público é calculado ao salvar, fotografado ao enfileirar e revalidado antes de cada lote.

## 8. Validação comercial

- Filme: precisa existir e estar publicável; sessões inválidas não entram no contexto.
- Cupom: precisa estar ativo, dentro da validade e dos limites e ser aplicável ao público.
- Clube: o plano precisa existir e estar ativo; preço, créditos, benefícios e imagem vêm do cadastro.
- Bomboniere: produto ou combo precisa estar ativo e disponível; até 20 IDs sem duplicação.

Uma oferta que deixa de ser válida impede o envio restante, em vez de prometer algo que o cliente não poderá usar.

## 9. Templates

Disponíveis: `announcement`, `weekly`, `premiere`, `last_chance`, `promotion`, `coupon`, `concession`, `combo`, `club_plan`, `club`, `birthday`, `event`, `ticket` e `reactivation`.

`ticket` é um conteúdo educativo sobre como acessar o ingresso. A entrega do ingresso comprado é transacional e não usa campanha.

Cada template define estrutura, imagem permitida/automática, CTA e identidade. A prévia desktop/celular usa o mesmo HTML canônico persistido para envio.

## 10. IA

O Gemini obedece ao contrato de `emailCampaignAiProviderService.js`. A IA recebe somente cenário, briefing, template compatível, catálogo validado, público, marca e um rascunho de referência do mesmo template.

Compatibilidade principal:

- estreia: `premiere` ou `weekly`;
- em cartaz: `weekly` ou `announcement`;
- últimos dias: `last_chance` ou `weekly`;
- promoção/cupom: `promotion` ou `coupon`;
- clube: `club_plan` ou `club`;
- bomboniere: `concession` ou `combo`;
- ingresso: apenas `ticket`.

Rascunhos incoerentes não aparecem como referência. A saída é estruturada, limitada e revalidada pelo servidor.

Quando há limite, indisponibilidade, falha de autenticação ou timeout, a geração é interrompida e nenhum rascunho é criado. Modelos incompatíveis podem ser resolvidos apenas para a execução atual, registrando modelo configurado, modelo efetivo e motivo sem alterar silenciosamente a preferência administrativa.

## 11. Entrega

O SMTP usa `Message-ID` derivado do `delivery_id`. Falhas claras de autenticação, conexão ou rejeição antes da entrega permitem fallback. Timeout ou socket interrompido após o início são `unknown`.

O webhook v2 recebe campanha, destinatário, tentativa, delivery, template, tipo de e-mail e timestamp. O header de idempotência usa `delivery_id`.

O fallback só ocorre quando é possível afirmar que o SMTP não entregou. Erro incerto não chama um segundo provedor.

## 12. Descadastro

Campanhas incluem `List-Unsubscribe` e `List-Unsubscribe-Post`.

- `GET /api/email/unsubscribe?token=...` exibe confirmação sem alterar dados.
- `POST /api/email/unsubscribe?token=...` consome o token, desativa marketing e grava supressão.

Isso evita descadastro acidental por scanners. Tokens expiram, são de uso único e ficam por hash. Mensagens transacionais não são bloqueadas pelo opt-out de marketing.

## 13. Anexos

Tipos aceitos: PDF, PNG, JPEG e WebP, com validação da assinatura binária.

- até 5 anexos;
- padrão de 5 MB por arquivo;
- padrão de 12 MB no total;
- caminho físico privado e confinado;
- coleta de órfãos após a retenção.

Variáveis: `CINE_EMAIL_ATTACHMENTS_DIR`, `EMAIL_ATTACHMENT_MAX_BYTES`, `EMAIL_ATTACHMENT_TOTAL_MAX_BYTES` e `EMAIL_ATTACHMENT_RETENTION_DAYS` (padrão 30, intervalo 7 a 365).

## 14. API

As rotas administrativas exigem sessão, `marketing.manage`, origem aceita e rate limit:

- `GET|PUT /api/admin/email/branding`
- `POST /api/admin/email/attachments`
- `GET|POST /api/admin/email/campaigns`
- `POST /api/admin/email/campaigns/ai-draft`
- `POST /api/admin/email/campaigns/preview`
- `POST /api/admin/email/campaigns/test`
- `GET|PUT|DELETE /api/admin/email/campaigns/:id`
- `POST /api/admin/email/campaigns/:id/send`
- `POST /api/admin/email/campaigns/:id/cancel`
- `POST /api/admin/email/campaigns/:id/duplicate`
- `GET /api/admin/email/campaigns/:id/recipients`
- `POST /api/admin/email/campaigns/:id/retry-failures`

A listagem aceita página, tamanho, estado, template, origem, criador, datas, item associado, busca e ordem. O conteúdo pesado só vem no detalhe.

## 15. Interface

O fluxo possui Destinatários, Conteúdo e Revisão. Enviar rascunho existente executa `PUT` e, somente após sucesso, chama `/send`. Públicos com 500 ou mais elegíveis exigem digitar `ENVIAR`.

O histórico usa paginação no servidor, separa estado/origem, possui busca, atualiza automaticamente só com fila ativa e oferece ações compatíveis com cada estado. O relatório mostra contadores, destinatários, provedor, ID remoto, tentativas, erros e timestamps. Métrica sem fonte aparece como indisponível.

## 16. Segurança e auditoria

- autorização por papel e permissão;
- proteção de origem em mutações;
- segredos nunca retornam ao navegador;
- HTML, texto e URLs são normalizados;
- limites para campos, anexos e público;
- consentimento validado no snapshot e no lote;
- resultados incertos não são reenviados;
- logs usam IDs de correlação e reduzem dados pessoais.

Auditoria cobre criação, edição, agendamento, fila, cancelamento, exclusão, duplicação, retentativa, IA, claims, entregas, adiamentos, recuperação e conclusão.

## 17. Testes

```powershell
npm run test:email-campaign
npm run lint
npm test
```

A suíte cobre normalização, Gemini, bloqueio sem fallback, descadastro, webhook v2, worker, retentativa, resultado incerto, concorrência, cancelamento, recuperação e retentativa manual sem colisão. Testes reais de PostgreSQL exigem `TEST_DATABASE_URL`; sem ela ficam explicitamente ignorados.

## 18. Implantação

1. Criar backup do PostgreSQL.
2. Publicar o código da aplicação.
3. Executar migrações até 030.
4. Reiniciar o backend para iniciar o worker.
5. Verificar `/api/health/ready`.
6. Validar importação legada e ausência de `sending` com heartbeat vencido.
7. Enviar uma mensagem de teste para endereço controlado.

Esta documentação permanece local por decisão do projeto e não integra o pacote enviado à VPS.

## 19. Limitações reais

- Aniversário é manual por falta de data confiável.
- Não há ingestão de delivered/bounce/open/click, pixel ou redirecionador de cliques.
- SMTP não garante exatamente uma vez; resultado incerto exige revisão.
- O modo JSON não executa fila durável.
- `legacy_visual` é somente leitura até duplicação/conversão.
- Confirmação final do provedor depende de futura ingestão autenticada de webhooks.
