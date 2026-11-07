# Fase 21 — consultas e composição comercial

Branch: `codex/cine-backend-finalizacao`. Base: `182c9dd` (11.139 linhas em `backend/server.js`; 3.452 em `handleApi`). Teste de caracterização anterior às extrações: `69ed2f3`.

## Medição reproduzível

Comando: `node scripts/measure-modularization.mjs --summary`. Linhas físicas, sem compactação nem exclusão de comentários.

| Arquivo/função | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 11.139 | 10.978 | 161 (1,45%) |
| `handleApi` | 3.452 | 3.310 | 142 (4,11%) |
| Meta indicativa do lote | 8.500 | 10.978 | faltam 2.478 |

## Extrações e contratos

| Commit | Módulo (linhas) | Responsabilidade, permissão, persistência e teste |
| --- | --- | --- |
| `1b88007` | `adminConcessionSalesReadHandler.js` (82) | `GET /api/admin/concession-sales`, `concessions.view` central, projeção do snapshot sem escrita; teste HTTP/finanças/cancelamento. |
| `7e00890` | `clubReadRoutes.js` (47) | Quatro consultas de planos/assinaturas, sessão do cliente e guard Admin mantidos; projeção do snapshot, teste HTTP/presenter/precificação. |
| `accd6f8` | `adminOrderReadRoutes.js` (36) | Lista/detalhe de pedido, guard Admin, `orderRepository` dirigido no PG e snapshot no detalhe como antes; teste HTTP/modal/identificadores. |
| `35df20f` | `customerTicketReadRoutes.js` (58) | Histórico/detalhe próprio, 303 de navegação, cache privado, 404 por posse; snapshot sem escrita; teste HTTP/transferência. |
| `3c279be` | `clubSubscriptionSummary.js` (70) | DTO de benefício, uso, crédito e gratuidade; atualiza créditos no snapshot no mesmo ponto lógico; teste sintético/Clube. |

Não houve mudança dos métodos, rotas, payloads, cookies, status, cabeçalhos de cache ou ordem dos guards. QR, pagamento, emissão, conciliação, reembolso, Point, webhooks e mutações do Clube permanecem nos fluxos originais. Os módulos não importam `server.js`, não iniciam workers nem chamam provedores na importação. [Mapa detalhado](FASE21_COMERCIAL_MAPA.md).

## Validação

Testes dirigidos de HTTP comercial, bomboniere, Clube, pedidos, ingressos e 30 testes de `test:modularization:commerce` passaram. `npm run test:unit`, `npm run test:finance` (50/50), `npm run test:security:local` (25/25 no TAP mais scripts), `npm run lint`, `npm run build`, `npm run docs:check` e `npm run docs:modularization:report` passaram. `npm run test:e2e` passou com 19/19 cenários. A suíte de unidade contém testes PostgreSQL marcados como ignorados quando o ambiente descartável não está disponível. Docker Desktop não forneceu daemon (`dockerDesktopLinuxEngine` ausente); a bateria PostgreSQL descartável não foi executada. Nenhum banco operacional foi usado.

## Limites e risco residual

A meta de 8.500 permanece aberta. Os maiores blocos remanescentes de `handleApi` envolvem efeitos financeiros, estoque, crédito, ingresso, webhooks ou operações externas. Extraí-los exige fixtures PostgreSQL descartáveis e falhas parciais antes/depois de commit. Os módulos de leitura ainda recebem snapshot integral onde o contrato anterior fazia isso; migrar a repositórios dirigidos equivalentes demanda uma etapa própria. O resumo de assinatura continua atualizando créditos no snapshot antes de apresentar dados; mudar essa semântica não pertence à refatoração. Não houve deploy, merge nem operação em provedores.
