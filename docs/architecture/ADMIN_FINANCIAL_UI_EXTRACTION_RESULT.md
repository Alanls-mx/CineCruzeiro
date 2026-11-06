# Extração financeira da interface Admin

Branch `codex/cine-modularizacao-profunda`. Base desta etapa: `644f656`, com `backend/public/admin.js` em **8.925 linhas físicas**. Resultado: **5.697 linhas físicas**, redução de **3.228 linhas (36,2%)**, aferida por `node scripts/measure-modularization.mjs --summary`. A medição inclui comentários e linhas vazias; nenhum bloco foi compactado para alterar o número. `admin.html` passou de 24 para 38 módulos carregados, todos antes de `admin.js`, sem scripts ou handlers inline.

## Responsabilidades e contratos

Foram criados 14 módulos coesos nesta etapa: `club-commands`, `ticket-catalog-view`, `order-management-view`, `order-management-actions`, `payment-center-view`, `box-office-session-view`, `box-office-seat-map`, `box-office-draft-view`, `box-office-sale-summary`, `box-office-sale-command`, `box-office-point-controller`, `concession-counter-controller`, `ticket-validation-controller` e `ticket-qr-reader`. `club-view` existente também recebeu apresentação de planos, assinaturas e créditos. O maior módulo novo, `box-office-point-controller`, tem 391 linhas; o maior módulo Admin é `email-campaign-editor`, com 624. Os módulos compartilham o mesmo `state` por injeção explícita, sem importar `admin.js`.

O [mapa de fluxos](ADMIN_FINANCIAL_UI_FLOW_MAP.md) registra entradas, APIs, permissões, persistência e riscos por domínio. `bindEvents` permanece o único registro de comandos do painel. A bridge WebView2 possui um único listener de `cine-desktop-print-result`, registrado na composição Point. `admin.js` continua responsável pelo shell, autenticação visual, navegação e injeção; o backend continua autoritativo sobre permissão, preço, estoque, aprovação financeira, reembolso, emissão e validação de ingresso.

| Fluxo | Invariante observada |
| --- | --- |
| Venda presencial e balcão | Um POST local em voo; erro ou timeout preserva rascunho e `clientRequestId` Point em `sessionStorage`. Hold e preço são verificados pelo servidor. |
| Point e impressão | `pending`, `reconnecting`, `reconciliationRequired` e `paid_pending_print` não viram venda concluída. Cancelamento e resolução de falha de impressão não são enviados duas vezes em paralelo. |
| Pedidos e reembolsos | Confirmações, payloads, permissões visuais e mensagens permanecem; single-flight local por ação/pedido. O servidor mantém a idempotência e a autorização. |
| Clube | Créditos e assinatura são atualizados no painel somente depois da resposta da API. |
| Ingressos e QR | `inspect` e `confirm` continuam POSTs distintos; stream da câmera e timers param ao fechar. |
| Pagamentos | Listagem e paginação só apresentam respostas já carregadas; status pendente não é receita aprovada. |

## Validação

- Testes dirigidos novos: Clube, pedidos, pagamentos, bilheteria, holds, Point, balcão, QR e composição; o lote `tests/admin-*.test.mjs` terminou com **92 aprovados, 3 ignorados, 0 falhas**.
- `npm run test:unit`: passou, incluindo `test:finance` e testes de caracterização. Dois testes de fonte foram atualizados para ler o módulo extraído, mantendo as mesmas asserções de comportamento.
- `npm run test:security:local`: **25 aprovados, 0 falhas**.
- `npm run lint`, `npm run build` e `npm run docs:check`: passaram.
- `npm run test:e2e`: **19 aprovados, 0 falhas**. Uma primeira execução detectou leitura de `desktopThermalPrinterAvailable` antes da inicialização do módulo Point; a injeção passou a usar callback tardio e um teste estático novo impede essa classe de regressão. O lote E2E administrativo também passou 7/7 antes da repetição completa.
- PostgreSQL local descartável: `test:smoke:postgres`, `test:postgres` (concorrência) e `test:postgres:repositories` passaram. O harness criou bancos marcados com role não-superusuário e removeu cada banco; o contêiner local `postgres:16-alpine` e seu volume foram removidos ao final. Nenhum banco operacional ou provedor financeiro foi usado.

## Limites e próxima etapa

Ainda há **5.697 linhas** no shell, incluindo `bindEvents` (1.100 linhas), 205 chaves diretas de `state` e apresentação de insights de bomboniere. A meta final de 2.000–3.500 linhas requer extrair eventos e estado por domínio, com controle explícito de limpeza e testes de ciclo de vida. A interface foi exercitada com Point, impressão e pagamentos simulados; este resultado não é homologação de terminal ou provedor real. Não houve alteração de contrato HTTP, migrations, servidor financeiro, banco operacional, `main` ou deploy.
