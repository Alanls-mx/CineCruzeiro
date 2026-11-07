# Fase 21 — extração financeira dirigida

Branch: `codex/cine-backend-finalizacao`. Base desta etapa: `5bd8b86`. A [matriz de cobertura](FASE21_COBERTURA_FINANCEIRA.md) é o portão por fluxo; a meta numérica não autoriza mover coordenação sem failpoint. Nenhum pagamento, terminal, banco operacional, VPS, deploy ou migration foi usado.

## Recorte extraído: confirmação da impressão local

| Item | Antes e depois |
| --- | --- |
| Entrada e precedência | `POST /api/box-office/point-payments/:id/print-result`, no slot entre `GET .../print` e `POST .../retry-print`. O dispatcher invoca [pointLocalPrintResultHandler](../../backend/services/pointLocalPrintResultHandler.js) nesse mesmo ponto. |
| Autoridade | `handleApi` conserva rate limit, origem cliente, leitura de snapshot, sessão Admin/2FA, `box_office.sell`, origem/CSRF administrativo e seleção transacional. `req.commitResponseAfterMutation` continua definido antes da delegação. |
| Estados | Exige `payment.status=approved`, venda `point_sale` ou `counter_sale`, pedido `paid_pending_print`/`paid`, modo local e `jobId` atual. Repetição após `paid` retorna os ingressos existentes. Job obsoleto ou estado incompatível é 409. |
| Escritas/commit | `ok=true`: marca impressão e chama o `finalizePrintedOrders` existente, que pode gerar `tickets` e atualizar `orders`; `writeDb` dentro de `withCriticalMutation` precede o HTTP 200. `ok=false`: grava falha de `pointPrint`/`printFulfillment`, deixa `paid_pending_print` e nenhum ingresso. |
| Provedor e identidade | Não há chamada ao Mercado Pago/Point neste endpoint; a confirmação é do job local, identificado pelo mesmo `jobId`. O handler não importa `server.js` e recebe persistência, finalização, auditoria e resposta por injeção. Importá-lo não inicia timer, conexão ou impressora. |
| Contrato | Mesmo método/caminho, 200 para confirmação/repetição/falha local informada, 409 para venda/job inválidos, erro de commit sem 2xx. Payloads, mensagens e cabeçalhos seguem os `sendJson` originais; nenhum fluxo Pix/cartão/Point de cobrança mudou. |
| Evidência | [Teste dirigido](../../tests/point-local-print-result-handler.test.mjs): commit antes do 200, repetição sem segundo ingresso, falha sem direito, job antigo, commit falho sem resposta de sucesso. [Smoke PG](../../scripts/smoke-tests.js): 401 sem sessão, 403 para origem inválida, 409 para job antigo, falha real injetada no `COMMIT` do pedido pago, rollback sem ingresso, retry da mesma confirmação e falha persistida sem emissão. Smoke anterior já cobria confirmação de ingresso e bomboniere. |

Medição com `node scripts/measure-modularization.mjs --summary`, incluindo comentários e linhas em branco: `backend/server.js` **10.919 → 10.865** (−54 linhas líquidas) após a extração e **10.876** (−43) após a correção de commit do webhook; `handleApi` **3.310 → 3.250 → 3.261**. O módulo novo tem **70 linhas**; a lógica não foi comprimida. A meta indicativa de 6.000 linhas permanece distante por **4.876 linhas**, sem justificar extração insegura.

## Fluxos mantidos no dispatcher

| Lote | Estado e bloqueio para extração |
| --- | --- |
| A — Pix | A matriz PG cobre timeout simulado, resposta perdida, retry e não emissão pendente para Mercado Pago. Faltam os mesmos failpoints para PagBank, corrida online entre instâncias e recuperação de resposta externa tardia. A Order externa ainda precede o commit local. Mantido. |
| B — cartão | Há teste de token ausente e rollback após aprovação simulada, mas faltam recusa/token inválido em HTTP PG, resposta perdida de cartão, Brick e PagBank com falha pós-provedor. Mantido. |
| C — webhooks | HMAC, divergência, repetição e aprovação tardia Mercado Pago têm teste PG. A falha de commit após aprovação de Order passou a ter failpoint e retry; a resposta do ramo de Order agora aguarda o commit. Ainda faltam falha de commit dos ramos de assinatura/evento desconhecido, estorno/cancelamento fora de ordem e matriz PagBank equivalente. HMAC e autoridade externa permanecem no dispatcher. Mantido. |
| D — bilheteria | Criação/retry/recuperação/cancelamento Point já usam coordenadores extraídos. Esta etapa moveu somente a confirmação local coberta. Venda presencial, `retry-print` com provedor, PDF e impressão externa ainda requerem failpoints por ramo e permanecem no dispatcher. |
| E — reembolsos | Coordenadores existentes cobrem preparo/commit final para casos simulados prioritários. PagBank, operações manuais, parcial por item e resposta perdida em todos os ramos não têm matriz PG completa; não foi criada outra máquina de estados. Mantidos. |
| F — Clube e direitos | Corrida pelo último crédito e devolução têm cobertura, mas falta failpoint PG específico do commit de consumo e concessão tardia. Não mover emissão ou créditos nesta etapa. |

## Invariantes e riscos

- Confirmação local não altera pagamento nem chama provedor; somente pagamento aprovado pode chegar à finalização.
- Um commit falho não responde sucesso e o retry do mesmo `jobId` gera apenas um ingresso no smoke PG. `ok=false` não emite ingresso.
- A ordem de guards e a seleção de transação permanecem no dispatcher; o teste dirigido não substitui a prova HTTP/PostgreSQL.
- A impressão física é simulada. Um `jobId` informado pelo cliente não comprova que uma impressora real imprimiu. `retry-print` e `resolve-print-failure` seguem suas políticas anteriores.
- Estado externo e banco não têm transação distribuída; Pix, cartão, webhooks e reembolsos remanescentes **não** têm equivalência integral demonstrada. A redução de linhas não muda esse bloqueio.
- Na repetição 2/3 do smoke PostgreSQL 16 no CI de `dda1791`, um `order.processed` recebeu HTTP 200 e a leitura SQL posterior ainda encontrou pagamento/pedido pendentes e nenhum ingresso. O ramo de Order enviava a resposta dentro de `withCriticalMutation`, antes do `COMMIT`. O ajuste faz a transação devolver status/payload e só responde após seu commit; o failpoint PG exige resposta não 2xx e rollback na falha, seguido de retry da mesma Order. A observação do CI não permite afirmar que havia perda definitiva de dados; ela demonstra uma janela de confirmação prematura. Os demais ramos de webhook ainda requerem caracterização própria.

## Validação

Commits independentes: `58cf72c` caracteriza o fluxo antes da extração; `4999690` extrai o handler e incorpora o teste dirigido; `8e4805a` amplia os guards HTTP; `dda1791` habilita os workflows da branch. O teste dirigido passou **3/3**. `node scripts/with-local-disposable-postgres.js smoke concurrency repositories` passou após a extração: smoke e concorrência completos, repositórios 11/11, inclusive o `COMMIT` injetado, repetição e falha da impressão local. `test:finance` passou **54/54**; `test:modularization:finance` passou **30/30**. `test:unit`, `test:security:local`, `lint`, `build` e `docs:check` terminaram com código zero. `test:e2e` passou **19/19**. O runner unitário marcou 10 casos PostgreSQL condicionais como ignorados nos subgrupos de repositórios/campanhas; estes não foram contabilizados como aprovação unitária. `docs:modularization:report` passou e mediu 10.865 linhas antes da correção do webhook; o diff estático inclui várias extrações históricas, portanto a equivalência desta rota foi verificada pelo teste HTTP e não inferida daquele snapshot. No CI de `dda1791`, segurança, E2E e PostgreSQL 18 passaram; PostgreSQL 16 falhou na segunda repetição de smoke e motivou a correção acima. O CI do SHA final ainda precisa ser conferido; testes não executados não são aprovação.

Após a correção do webhook, o smoke PostgreSQL descartável passou com o failpoint (HTTP 500, rollback e retry HTTP 200), assim como `smoke concurrency repositories` (repositórios 11/11), `test:finance` (54/54), `test:modularization:finance` (30/30), `test:unit`, `test:security:local`, `lint`, `build`, `docs:check`, `docs:modularization:report` e `test:e2e` (19/19). O CI do novo SHA é verificado separadamente antes do fechamento.

Este relatório registra **extração parcial**. Não classificar o backend como equivalente para todos os fluxos financeiros nem como pronto para deploy; os portões operacionais da Fase 13 continuam separados.
