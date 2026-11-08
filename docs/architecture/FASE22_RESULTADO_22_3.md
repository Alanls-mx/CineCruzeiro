# Fase 22.3 — resultado da cobertura financeira avançada

Branch `codex/cine-backend-desacoplamento`. Base: `7c27cfa1c5994c23355739ced28ee1e9be6dc7c4`, com Fase 22.2 publicada. O SHA da implementação antes deste relatório é `aa1c29d`; o SHA final da documentação é registrado na entrega, para não inserir o hash do próprio commit em seu conteúdo.

## Escopo e métricas

Não houve extração financeira nem alteração de contratos HTTP, autenticação, permissões, regras de pagamento ou migrations. `server.js` passou de **10.303 para 10.307 linhas** (+4, exclusivamente dois guards de resposta após commit); `handleApi`, de **3.261 para 3.265**. `admin.js` permaneceu em **3.421**. Medição: `node scripts/measure-modularization.mjs --summary`. Os testes novos residem em três helpers especializados e um worker de corrida; `scripts/smoke-tests.js` mantém a orquestração preexistente, sem novo arquivo agregador de produção.

## Defeitos reproduzidos e corrigidos

1. **Webhook PagBank**: com assinatura legada válida e consulta sintética do provedor, o failpoint no `COMMIT` causava reconhecimento HTTP antecipado e `ERR_HTTP_HEADERS_SENT`. `3228375` introduziu a reprodução, `53dbaf1` diferiu a resposta, `1a33e3c` passou a validar a assinatura real e o retry. SQL confirma pedido/pagamento pendentes e zero ingresso/evento após rollback; retry produz uma confirmação, um ingresso e um evento. Assinatura inválida retorna 401 sem escrita.
2. **Evento desconhecido Mercado Pago**: a Order já esperava o commit, mas o ramo que grava evento ignorado ainda respondia dentro da transação. `0fa1895` reproduziu o mesmo crash no `COMMIT`; `d444c39` passou a diferir a resposta. O teste exige 5xx, zero evento no rollback, e um único evento no retry/duplicação. O corpo é HMAC assinado com chave sintética.

As duas correções usam o mecanismo existente `req.commitResponseAfterMutation` / `httpResponseService.sendJson`, sem alterar status, payload, assinatura, autoridade externa ou máquina de estados. A resposta de erro fora da transação continua imediata. Nenhum provedor real foi chamado.

## Cobertura acrescentada

| Cenário | Prova direta | Limite |
| --- | --- | --- |
| Hold da mesma A1 entre dois processos Node | IPC `ready`/`acquire`, um vencedor, uma linha SQL em `seat_holds` | Não é checkout HTTP distribuído |
| PagBank Pix: timeout pré-aceite, resposta perdida, commit falho, retry, repetição simultânea | SQL `orders`/`payments`/`tickets`, identidade e contagem de chamadas simuladas | Idempotência real do PagBank e conciliação tardia não homologadas |
| PagBank cartão: aprovação externa simulada antes de falha local e retry | Rollback sem pedido/pagamento/ingresso; retry com mesma identidade grava um ingresso | Não cobre captura de `AUTHORIZED` ou resposta perdida do cartão |
| Webhook PagBank aprovado, inválido e repetido | Assinatura legada real sobre corpo sintético, consulta sintética, SQL de evento/direitos antes e depois de commit | ECDSA no HTTP PG, cancelamento e reembolso ainda sem matriz |
| Mercado Pago evento desconhecido | HMAC local, failpoint COMMIT, retry e deduplicação SQL | Assinaturas do Clube e estornos ainda sem failpoint |

Os testes usam apenas dados sintéticos, `PAYMENTS_MODE=test`, provedores locais simulados, contêineres `tmpfs`, marcadores aleatórios e role PostgreSQL sem superusuário. O harness recusa URLs operacionais herdadas; nenhum teste destrutivo usa banco existente. O endereço `192.0.2.22` isola o bucket de rate limit destes cenários da suíte longa sem mudar a regra de produção. `next-env.d.ts` gerado pelo build/E2E é restaurado ao estado do repositório.

## Portão para a Fase 22.4

Ver [matriz por ramo](FASE22_COBERTURA_FINANCEIRA_AVANCADA.md) e [matriz de concorrência](FASE22_MATRIZ_CONCORRENCIA.md). **Liberação parcial** somente para extrair o reconhecimento pós-commit dos ramos de webhook caracterizados e validações puras/coordenação sem novo efeito externo. Pix, cartão, PagBank completo, assinatura Clube, Point remanescente, reembolsos e créditos **não estão liberados como fluxos inteiros**. Em especial, faltam corrida de dois servidores no checkout, failpoints da captura PagBank, reembolso por provedor/item, duas instâncias disputando estorno/crédito, transições de webhook fora de ordem e consulta de autoridade indisponível em cada ramo. A janela entre criação externa e commit local permanece; testes locais não demonstram garantia de liquidação ou idempotência do provedor.

## Validação local

| Comando | Resultado |
| --- | --- |
| `npm run test:finance` | 54/54 aprovados |
| `npm run test:modularization:finance` | 30/30 aprovados |
| `npm run test:characterization` | 37/37 aprovados |
| `npm run test:maintenance` | 9/9 aprovados |
| `npm run test:security:local` | 25/25 na suíte principal; verificações complementares locais passaram |
| `npm run test:unit` | Código zero; 10 casos condicionais PostgreSQL ignorados em subgrupos fora do harness, não contados como aprovação |
| `npm run lint`, `npm run build`, `npm run docs:check` | Código zero |
| `node scripts/with-local-disposable-postgres.js smoke concurrency repositories guard` | Aprovado em PostgreSQL 16; repositórios 11/11, guard `PG_GUARDED_MIGRATION_OK` |
| `node scripts/with-local-disposable-postgres.js backup-restore` | `BACKUP_RESTORE_OK` sintético; 50 migrations e invariantes preservadas |
| `node scripts/with-local-disposable-postgres.js --pg18 upgrade` | `PG18_UPGRADE_OK`, 50 migrations |
| `node scripts/with-local-disposable-postgres.js --pg18 smoke concurrency repositories guard` | Aprovado em PostgreSQL 18; smoke, concorrência, repositórios 11/11 e guard |
| `npm run test:e2e` | 19/19 aprovados em navegador; mock de e-mail E2E sem webhook configurado registra aviso esperado |
| `npm run test:legacy:json` | Smoke de compatibilidade JSON aprovado, isolado em diretório temporário |

Nenhuma aprovação acima equivale a homologação externa. Workflows GitHub Actions só são evidência para o SHA publicado correspondente; o estado final será registrado após o push. Nenhum deploy, merge, acesso à VPS, banco operacional ou pagamento real ocorreu.

## Prontidão e próximos lotes

**Prontidão técnica:** os ramos de reconhecimento dos dois webhooks caracterizados têm regressão SQL reproduzível. O checkout PagBank ganhou prova de rollback e retry local. A arquitetura financeira inteira permanece **parcial**, porque os fluxos listados como bloqueados ainda não têm failpoints e corrida distribuída suficientes para extração segura.

**Prontidão operacional:** não avaliada nesta etapa. O preflight e os bloqueadores da Fase 13 continuam separados destes testes; branch verde, backup sintético e CI não autorizam deploy ou migração operacional.

Próximos lotes prioritários: (1) webhook PagBank `CANCELED`/`REFUNDED`/ECDSA e Mercado Pago assinatura/estorno com falha de commit; (2) duas instâncias HTTP disputando checkout e mesma Order externa simulada, com barreira explícita; (3) captura `AUTHORIZED` e resposta perdida do cartão PagBank; (4) reembolsos por provedor e item com dois operadores; (5) último crédito Clube com falha de commit e dois processos. Só então reclassificar cada ramo para extração de 22.4.
