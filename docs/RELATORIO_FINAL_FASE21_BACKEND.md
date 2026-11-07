# Auditoria final da Fase 21 — backend Cine Cruzeiro

**Branch:** `codex/cine-backend-finalizacao`. **Código auditado:** `5f97e653222516cbf1f52725cf40e92ce1583b28`. O commit deste documento é posterior e não altera o código auditado. Base medida no início da fase: `715839f` (13.529 linhas em `backend/server.js`). Auditoria local, sem VPS, banco operacional, provedor real, merge ou deploy.

**Classificação para encerramento integral: BLOQUEADO.** Não foi observada regressão crítica nos cenários executados, mas a meta de linhas está distante e a cobertura de equivalência financeira e HTTP não é completa. Os lotes efetivamente testados têm avanço concreto; isto não certifica todos os ramos do dispatcher nem prontidão de implantação.

## Medição e arquitetura

`node scripts/measure-modularization.mjs --summary` contou linhas físicas, inclusive comentários e linhas em branco; `npm run docs:modularization:report` produziu o inventário estático. Não houve compactação artificial.

| Alvo | Base | Atual | Redução |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 13.529 | 10.755 | 2.774 (20,50%) |
| `handleApi` | 5.636 | 3.261 | 2.375 (42,14%) |
| `backend/public/admin.js` | 3.421 | 3.421 | 0; arquivo não modificado nesta fase |

Faltam **5.755 linhas líquidas** para o teto de 5.000, ou **7.755** para 3.000. `handleApi` ainda mistura precedência de rotas, seleção de transação, guards, checkout, webhook, bilheteria, reembolso e respostas; fora dele há 7.494 linhas, inclusive normalização temporal, Point, diagnósticos, HTTP/WS e composição. Funções grandes ainda medidas: callback financeiro interno a `handleApi` com 423 linhas, outros callbacks de 145/144 linhas, `normalizeDb` 141, `queueBoxOfficePointPrint` 105 e `testIntegrationProvider` 105. A contagem não mostra sozinha a complexidade das closures e dos estados compartilhados.

Foram criados **26 módulos** em `backend/services/`, todos com até 459 linhas: `adminEmailRoutes` 459, `adminSocialStudioRoutes` 423, `adminAccountRoutes` 294, `customerAuthRoutes` 275, `adminTicketDistributorPresentation` 271, `adminIntegrationRoutes` 261, `customerAccountRoutes` 260, `adminSessionRoutes` 186, `adminReportRoutes` 173, `publicContentPresenter` e `userAccountModelService` 130 cada, `socialStudioContextPresenter` 113, `emailAutomationRoutes` 92, `adminConcessionSalesReadHandler` 82, `adminPaymentsReadHandler` 79, `clubSubscriptionSummary`, `commercialReportPeriodService` e `pointLocalPrintResultHandler` 70 cada, `snapshotPersistenceRuntime` e `seatMapReadHandler` 67 cada, `customerTicketReadRoutes` 58, `backendRuntimeSchedule` 49, `clubReadRoutes` 47, `snapshotSettingsNormalizer` 45, `adminOrderReadRoutes` 36 e `snapshotMovieNormalizer` 30. Separaram autenticação/contas, leituras comerciais, campanhas/integrações, apresentação, normalização, persistência e agenda. `server.js` continua dono dos guards comuns e da transação.

Arquivos próprios **acima de 1.200 linhas**: `server.js` 10.755, `admin.css` 10.226, `scripts/smoke-tests.js` 3.607, `admin.js` 3.421, `admin.html` 3.338, `admin-premium.css` 2.879, `social-studio.js` 2.172, `CheckoutPage.tsx` 1.963, `postgresStore.js` 1.727, `social-studio.css` 1.691 e `globals.css` 1.237. A biblioteca vendorizada `jsQR.js` (10.102) não é código próprio. Nenhum novo módulo excede o limite.

### Rotas e dependências

O relatório automatizado encontrou **178 critérios estáticos**, 86 literais `/api/` distintos e **40 pares método/caminho** verificados no mapa; os critérios não são a quantidade de endpoints alcançáveis. Contagem de **literais distintos por handler novo**, útil para localizar donos, não como inventário HTTP exaustivo (regex, sufixos dinâmicos e aliases não entram):

| Handler | Literais | Handler | Literais |
| --- | ---: | --- | ---: |
| `adminAccountRoutes` | 9 | `adminConcessionSalesReadHandler` | 1 |
| `adminEmailRoutes` | 6 | `adminIntegrationRoutes` | 9 |
| `adminOrderReadRoutes` | 1 | `adminPaymentsReadHandler` | 1 |
| `adminReportRoutes` | 5 | `adminSessionRoutes` | 4 |
| `adminSocialStudioRoutes` | 11 | `clubReadRoutes` | 4 |
| `customerAccountRoutes` | 5 | `customerAuthRoutes` | 6 |
| `customerTicketReadRoutes` | 1 | `emailAutomationRoutes` | 3 |
| `pointLocalPrintResultHandler` | 0 | `seatMapReadHandler` | 0 |

Os dois últimos recebem a rota já reconhecida pelo dispatcher, daí zero literal. Os handlers anteriores `movieCatalogHandler`, `venueConfigurationHandler`, `commercialCatalogHandler` e `adminLogsHandler` têm respectivamente 3, 2, 4 e 4 condições de rota no medidor. O diff estático contra o snapshot histórico mostra predicados `+32/-83` e caminhos `+0/-112`; transferência de dono aparece como remoção. Não usar esse diff para declarar rota perdida ou equivalência completa.

Uma varredura de `require()` relativo em 218 arquivos de serviços/repositórios/DB encontrou ciclos **preexistentes** em `backend/services/social-studio/`: `contracts/artwork-layout` ↔ `engine/content-rules`, `scene/factory` ↔ `scene/movie-editorial`, e `scene/renderer` ↔ `composition-engine/concession-quality`, além de caminhos maiores pelo registry/normalizer. Esses arquivos não mudaram nesta fase; nenhum módulo novo apareceu nos ciclos detectados. A varredura não cobre imports dinâmicos. Uma busca por blocos idênticos de 10 linhas entre `server.js` e os 26 módulos achou repetições de listas de dependências injetadas, mas **nenhum bloco** com três ou mais instruções de controle/retorno/await; isso não exclui duplicação semântica. As factories novas não iniciam conexão, timer ou provedor no import, segundo inspeção e testes dirigidos. Importar `server.js` diretamente **ainda** carrega ambiente e abre listener; `start.js` evita isso em `quiescent`.

## Contratos e transações

Os testes HTTP de identidade, leitura comercial, segurança, smoke JSON/PG e E2E exercitaram método/caminho, autenticação/2FA, cookies, sessões, CSRF/origem, permissões, status, JSON, catálogo, assentos/WS, checkout, bilheteria, QR, Clube, bomboniere, CRM e Studio nos cenários sintéticos. `admin.js` não foi modificado. Os testes financeiros exercitaram Pix/cartão e provedores simulados, Point, reembolso, estoque e créditos. Webhook Mercado Pago tem assinatura, autoridade, replay e falha de commit testados; PagBank tem contratos próprios testados. `start.js` quiescent recusou HTTP/WS sem iniciar banco/workers. **Não houve comparação byte a byte de todos os headers, CSV/PDF ou todos os pares método/caminho**; o mapa de endpoints é parcial. Nenhum teste local equivale a homologação externa de Mercado Pago, PagBank, terminal, SMTP ou Wallet.

| Fluxo extraído ou preservado | Ordem transacional observada e evidência | Limite |
| --- | --- | --- |
| Point criação/recuperação | Admin e `box_office.sell` → intenção/pagamento pendentes em commit → claim/lease e pré-envio em commits separados → provedor simulado → resultado em novo commit → direito somente após aprovação válida → HTTP. Retry usa a chave original; concorrência entre instâncias e resposta perdida exercitadas no smoke PG. | Efeito externo e banco não têm commit distribuído; terminal real não testado. |
| Point impressão local (extração da fase) | Guard/origem no dispatcher → pagamento aprovado e `jobId` atual → `finalizePrintedOrders` → `writeDb`/commit → 200. Falha ou job antigo não emite; retry do mesmo job não duplica ingresso. | Impressora física, `retry-print` e outros ramos permanecem separados. |
| Reembolso/cancelamento | `orders.refund`/permissão pertinente → intenção e ID persistidos → chamada simulada → commit de resultado e direitos/estoque → HTTP. Falha de resposta/commit mantém inconclusivo e retry conserva ID. | Cobertura PagBank, reembolso manual e parcial por item ainda incompleta. |
| Pix/cartão | Estado e preço/estoque/hold conferidos no servidor; Order externa e gravação local seguem a ordem existente, confirmação autorizada antes de ingresso. Smoke PG injeta falhas e webhook repetido. | Janela entre aceitação externa e commit local; matriz de falhas PagBank/cartão não cobre todos os ramos. Coordenação ficou no dispatcher. |
| Webhook Mercado Pago | HMAC e referência/valor → consulta de autoridade → mutação/commit → reconhecimento HTTP no ramo Order corrigido em `9f7cefb`; replay não duplica direito. | Estados e estornos fora de ordem, outros ramos e PagBank não têm matriz integral. |
| Snapshot/lifecycle | Normalização JSON/PG com defaults caracterizados; escrita PG mantém contexto/lock, JSON mantém fila/rename. Agenda inicia uma vez e cancela timers/workers no `close`. | `stop()` não aguarda efeito externo já disparado; release anterior não é drenada por quiescent. |

Assim, as extrações não demonstraram inversão de commit nos **ramos testados**, mas não se pode confirmar essa ordem para toda a superfície financeira. `202` segue inconclusivo. A [matriz financeira](architecture/FASE21_COBERTURA_FINANCEIRA.md), o [relatório dirigido](architecture/FASE21_EXTRACAO_FINANCEIRA.md) e os [limites transacionais](architecture/transactions.md) são a evidência por fluxo.

## Execução no código auditado

| Comando | Resultado |
| --- | --- |
| `node scripts/measure-modularization.mjs --summary`; `npm run docs:modularization:report` | Executados; métricas acima. O segundo é um inventário estático com contagens históricas de teste, não uma execução atual. |
| `npm run test:unit` | Código 0; 322 aprovações TAP somadas nos subcomandos, 10 ignorados condicionais, zero falhas. Há repetições entre subcomandos. |
| `npm run test:security:local`; `npm run test:finance`; `npm run test:maintenance` | Código 0; 25/25 + scripts auxiliares, 54/54, 9/9. |
| `npm run test:legacy:json`; `npm run test:deployment`; `npm run test:multi-cinema:synthetic`; `npm run test:desktop` | Código 0; smoke JSON aprovado, deployment 7/7, cinco instalações 5/5, shell desktop aprovado. |
| `npm run lint`; `npm run build`; `npm run test:e2e`; `npm run docs:check` | Código 0; E2E 19/19. Build altera `next-env.d.ts` gerado; a alteração foi restaurada antes do commit. |
| `npm run test:characterization`; `npm run test:modularization:finance` | Código 0; 23/23 e 30/30, sem ignorados. |
| PostgreSQL descartável: `smoke concurrency repositories guard`, `backup-restore`, `--pg18 upgrade` | Código 0 nos três comandos: smoke e concorrência aprovados, repositórios 11/11, `PG_GUARDED_MIGRATION_OK`, `BACKUP_RESTORE_OK` com pedidos/ingressos/estoque/créditos sintéticos e `PG18_UPGRADE_OK` (48→50 migrations, três pedidos sintéticos). |

Os avisos esperados de falha injetada, e-mail não configurado e CSP em desenvolvimento não foram contados como falhas de teste. Dez casos PostgreSQL condicionais ignorados no unitário foram exercitados pelos comandos protegidos quando aplicável; não foram convertidos em aprovações unitárias. Os workflows GitHub Actions devem ser conferidos **no commit documental final**, separadamente das execuções locais.

## Commits por etapa e decisão seguinte

| Etapa | Commits nesta branch |
| --- | --- |
| 21.1 Inventário/plano | `8a361ee`, `7c8bc14` |
| 21.2 Administração/composição | `06b4248`, `ca81c93`, `f81e660`, `ae880ef`, `13d2f46`, `7af018b`, `08646cd`, `e45aca7`, `6080ca2`, `859f2b4`, `7184865` |
| 21.3 Identidade | `bdf6178`, `86a8f07`, `da234b2`, `61c0908`, `8e86636`, `458a51f`, `182c9dd` |
| 21.4 Comercial | `69ed2f3`, `1b88007`, `7e00890`, `accd6f8`, `35df20f`, `3c279be`, `937b231`, `e0a728b`, `58ebe61` |
| 21.5 Cobertura financeira | `d665714`, `25cfdcd`, `dab5502`, `5bd8b86` |
| 21.6 Financeiro dirigido | `58cf72c`, `4999690`, `8e4805a`, `dda1791`, `9f7cefb` |
| 21.7 Persistência/lifecycle | `925054f`, `a857581`, `f6e3d03`, `5f97e65` |

Para chegar a 5.000, um orçamento **líquido** possível seria `handleApi` 3.261 → ~900 (−2.361) e o restante 7.494 → ~4.100 (−3.394). É planejamento, não autorização para mover o código: a fiação nova pode exigir mais linhas brutas. Próximas ações, em ordem:

1. Completar caracterização HTTP por par método/caminho, papel, status, cookies e headers, incluindo CSV/PDF, callbacks e fluxo WebSocket.
2. Criar failpoints PostgreSQL por provedor e ramo ainda bloqueado: PagBank/cartão, webhook fora de ordem, reembolso manual/parcial e concorrência online entre processos; só então extrair coordenação financeira.
3. Separar os subfluxos não financeiros de `handleApi` restantes em módulos coesos, mantendo guards e precedência no dispatcher; medir e testar cada lote.
4. Caracterizar defaults temporais do Clube, seed Admin e consumidores JSON antes de reduzir `normalizeDb`; só depois decompor contexto HTTP/WS e startup/shutdown com prova de dreno de tarefas em andamento.
5. Tratar os ciclos do Social Studio e a duplicação semântica em lote próprio, com testes que preservem a ordem de importação e renderização.

**Prontidão técnica:** parcial, com as suites locais e CI do código auditado verdes nos cenários cobertos. **Prontidão operacional:** não demonstrada. Os Portões B/D da [Fase 13.1](FASE13_1_FECHAMENTO_BLOQUEADORES.md), backup operacional restaurado, dreno da release anterior, estado de jobs/leases e homologação por cinema continuam separados. Nenhum resultado desta fase autoriza atualização da VPS ou `main`.
