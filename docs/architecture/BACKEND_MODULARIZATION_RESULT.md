# Resultado parcial da modularização do backend

Branch `codex/cine-modularizacao-profunda`, em 06/11/2026. Este relatório mede a etapa de extrações auxiliares iniciada após o relatório financeiro. O alvo final de 3.000–5.000 linhas **não foi atingido**; não houve merge, deploy, migration ou acesso a banco/provedor operacional. O código permanece a fonte definitiva dos contratos.

## Medição reproduzível

`node scripts/measure-modularization.mjs --summary` conta linhas físicas, inclusive comentários e linhas vazias, em LF/CRLF. Não houve compactação para reduzir a contagem.

| Revisão | `backend/server.js` | Diferença |
| --- | ---: | ---: |
| [linha de base](MODULARIZATION_BASELINE.md) | 17.324 | — |
| [extração financeira](FINANCIAL_EXTRACTION_REPORT.md), antes desta etapa | 14.722 | −2.602 |
| Atual | **13.529** | −1.193 nesta etapa; −3.795 no total (**21,9%**) |

`backend/public/admin.js` permanece em 11.980 linhas porque o escopo desta etapa é o backend. A maior função restante é `handleApi`, com **5.636 linhas**; `normalizeDb` possui 199. Módulos novos desta etapa medidos pelo mesmo critério:

| Módulo | Linhas | Responsabilidade |
| --- | ---: | --- |
| [ticketEmailDeliveryCoordinator](../../backend/services/ticketEmailDeliveryCoordinator.js) | 133 | Entrega direta/fila de ingressos e compatibilidade JSON; worker PostgreSQL permanece dono do lease. |
| [ticketDocumentPdfService](../../backend/services/ticketDocumentPdfService.js) | 460 | PDFs digitais e térmicos de ingresso/bomboniere, com QR somente quando válido. |
| [googleWalletIntegrationService](../../backend/services/googleWalletIntegrationService.js) | 258 | OAuth/API Wallet e diagnóstico da classe, acionados somente por rota autorizada. |
| [backendMaintenanceTasks](../../backend/services/backendMaintenanceTasks.js) | 178 | Varreduras de assinaturas/sessões, imagens, anexos e logs; timers continuam no startup normal. |
| [emailCampaignInputService](../../backend/services/emailCampaignInputService.js) | 149 | Normalização de campanhas, marca e blocos legados. |
| [emailCampaignAudienceService](../../backend/services/emailCampaignAudienceService.js) | 128 | Seleção/consentimento e elegibilidade de destinatários. |

Todos os módulos novos ficam abaixo de 500 linhas. Usam dependências explícitas, não importam `server.js` e não iniciam timers, conexão ou provedor na importação. O dispatcher conserva ordem, permissões, origem, CSRF, resposta e contexto transacional. Os escritores permanecem os mesmos: `writeDb`/`withCriticalMutation`, repositórios de campanha/configuração e worker persistente de e-mail. A matriz de donos e riscos está em [módulos](modules.md), [dependências](dependencies.md), [persistência](persistence.md) e [transações](transactions.md).

## Contratos e invariantes preservados nesta etapa

- Nenhum método, caminho, status, cookie, header, payload ou assinatura de webhook foi alterado. O dispatcher ainda verifica `marketing.view`/`marketing.manage`, `orders.resend` e `integrations.manage` antes das chamadas de domínio pertinentes.
- A confirmação financeira continua sendo a única autoridade para emitir ingressos. A entrega de e-mail permanece posterior à decisão de direitos; a fila PostgreSQL usa o job já persistido. A fila JSON preserva a exclusão simultânea no processo.
- O PDF não inclui QR de ingresso inativo; os downloads e a impressão mantêm os mesmos MIME/guards. O cache de pôster continua uma escrita local fora da transação de pagamento.
- O diagnóstico Wallet recebe a identidade/configuração da instalação e não faz chamada externa na importação. Efeitos da API Wallet e gravação local continuam sem transação distribuída.
- A manutenção preserva `withCriticalMutation` e o commit local antes da limpeza subsequente. `backend/start.js` em `quiescent` continua sem importar o servidor operacional, timers ou workers.
- A seleção de destinatários preserva exclusão de equipe, inativos e clientes descadastrados; a normalização conserva compatibilidade de campanha visual legada.

## Validação executada

| Comando/escopo | Resultado |
| --- | --- |
| `npm run test:unit` | Aprovado; inclui testes dirigidos de e-mail, PDF e Wallet, campanha e regressões existentes. A suite de campanha registrou 7 casos PostgreSQL ignorados no modo unitário; os testes protegidos abaixo foram executados separadamente. |
| `npm run test:security:local` | Aprovado. |
| `npm run test:finance` | 50 aprovados, 0 falhas. |
| `npm run test:maintenance` | 7 aprovados, 0 falhas. |
| `npm run test:email-campaign` | 46 aprovados, 7 ignorados por dependerem de PostgreSQL, 0 falhas. |
| `npm run lint`, `npm run build`, `npm run docs:check` | Aprovados; mapa com 28 documentos e links locais válidos. |
| `npm run test:e2e` | 19 aprovados. |
| `node scripts/with-local-disposable-postgres.js smoke` | Aprovado após reiniciar o Docker local. A primeira tentativa encerrou com falha do processo Windows e parou o Docker; não foi tratada como aprovação. |
| `node scripts/with-local-disposable-postgres.js concurrency repositories` | Concorrência aprovada; repositórios: 11 aprovados, 0 falhas. O harness criou/removou banco e contêiner descartáveis com marcadores de identidade. |

Os testes exercitam rotas HTTP, commits, Point, reembolsos, QR, fila, WebSocket e shutdown nos cenários existentes. Não medi perfil de memória, latência ou cobertura de todos os ramos; a ausência de regressão observada vale para esses cenários, não para toda combinação de estado. Nenhum provedor externo real foi chamado.

## Responsabilidades ainda concentradas e sequência segura

1. **`handleApi` (5.636 linhas):** mistura campanhas, contas, checkout, bilheteria, integrações e operações administrativas. Dividir por família de rotas requer matriz de método, permissão, origem, ordem, resposta e escritor. Priorizar campanhas/integrações não financeiras com testes HTTP de caracterização de erro, consentimento, idempotência e commit.
2. **Autenticação, sessões, 2FA e dados de conta:** dependem de cookies, CSRF, rate limit e `req.adminUser`. Não mover só para cumprir a meta; primeiro fixar contratos e precedência com testes HTTP/E2E de cada ramo.
3. **Pix/cartão, webhook, Clube, Point, bilheteria e reembolsos:** cruzam intenção persistida, chamada externa, lease, resposta e reconhecimento de direitos. A [matriz financeira](FINANCIAL_TRANSACTION_MAP.md) e o [relatório financeiro](FINANCIAL_EXTRACTION_REPORT.md) identificam lacunas de failpoint e conciliação. Sem cobertura suficiente de falha parcial e concorrência por fluxo, permanecem no dispatcher.
4. **`normalizeDb` e compatibilidade JSON:** mantêm defaults e migração lógica do snapshot; a produção usa PostgreSQL, mas os testes de compatibilidade JSON ainda têm consumidores. Só reduzir após mapear cada campo/consumidor e comparar snapshots em fixtures de ambas as modalidades.
5. **Startup/WS/workers:** mover apenas com teste de quiescent, única inicialização e fechamento/drain. O startup atual não fornece garantia de dreno da release antiga; a [Fase 13.1](../FASE13_1_FECHAMENTO_BLOQUEADORES.md) registra o bloqueio operacional.

Alcançar 3.000–5.000 linhas exige retirar pelo menos mais 8.529 linhas, sobretudo do dispatcher, preservando o código de guarda e composição. Os testes atuais não justificam essa remoção em um único lote. A próxima etapa deve separar uma família de rotas por commit, medir o módulo criado e executar primeiro os testes dirigidos, depois as suítes amplas e o PostgreSQL descartável. A meta do arquivo permanece **pendente**; este documento registra progresso verificável, sem declarar equivalência completa.
