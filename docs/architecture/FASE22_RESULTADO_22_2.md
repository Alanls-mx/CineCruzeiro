# Fase 22.2 — fronteiras de projeção e contexto

Branch `codex/cine-backend-desacoplamento`, base `431ab79d7fa0dddf4c5499e188cf0eb33538844a`. Sem merge, deploy, migração operacional, banco real ou provedor real. `backend/public/admin.js` não foi alterado. Este relatório distingue a equivalência exercitada dos fluxos ainda sem cobertura suficiente.

## Medição

`node scripts/measure-modularization.mjs --summary` conta linhas físicas, inclusive comentários e linhas vazias.

| Alvo | Início 22.2 | Final 22.2 | Redução |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 10.461 | 10.303 | 158 (1,51%) |
| `handleApi` | 3.261 | 3.261 | 0 |
| Fora de `handleApi` | 7.200 | 7.042 | 158 |
| `backend/public/admin.js` | 3.421 | 3.421 | 0 |

Faltam **5.303 linhas líquidas** até o teto final de 5.000. A meta indicativa de 400–800 linhas desta etapa não foi atingida. Os lotes foram escolhidos por contrato e segurança, não pelo tamanho. Não se transferiu `handleApi` para um substituto. Os quatro módulos novos têm 40, 75, 26 e 57 linhas, respectivamente.

## Extrações e commits

| Lote | Caracterização antes | Extração | Redução líquida | Contrato preservado |
| --- | --- | --- | ---: | --- |
| Corpo HTTP | `d96a257` | `8c9c6f0` [httpRequestBodyService](../../backend/services/httpRequestBodyService.js) | 33 | Limite por header e bytes reais, Buffer bruto para HMAC, JSON vazio/inválido, 400/413; sem resposta antecipada. |
| Leitura de ingresso | `07fbb25` | `abda001` [ticketReadProjectionService](../../backend/services/ticketReadProjectionService.js) | 54 | Status ativo/usado/cancelado/arquivado, dados comerciais e sala; propriedade e filtro DTO continuam no handler, QR/Wallet nos guards. |
| Social Studio público | `47fc6f9` | `0bf5745` [socialStudioPublicProjectionService](../../backend/services/socialStudioPublicProjectionService.js) | 18 | Histórico sem cenas, flags de edição e nome de download; renderer, upload, jobs e permissão intactos. |
| Objeto Wallet | `66338b2` | `d8ce10c` [walletTicketObjectPresenter](../../backend/services/walletTicketObjectPresenter.js) | 53 | EventTicketObject, poster TMDB HTTPS, classe, link da instalação, QR de exibição e estado. `googleWalletSaveUrl` mantém autorização, sync remoto e JWT. |
| Contexto | `cc37934` | Sem extração do ALS | 0 | Testes de requests concorrentes após await, requestId/log, redação, cookies, CSP e HSTS delimitam o próximo lote. |

`tests/google-wallet-integration.test.mjs` tinha uma asserção que procurava uma função já extraída de `admin.js` em fase anterior. O teste agora lê o módulo real de integrações do painel, mantendo a exigência de salvar antes de testar. Durante a extração Wallet, as asserções estáticas passaram a acompanhar o presenter sem dispensar a verificação do poster HTTPS, `imageModulesData` vazio e uso de `buildGoogleWalletTextModules`. Uma primeira execução desses testes apontou as localizações antigas; corrigimos as asserções e reexecutamos com sucesso. Nenhuma expectativa funcional foi afrouxada.

A bateria ampliada de 29 arquivos Social Studio encontrou duas falhas preexistentes: `social-studio-editor.test.mjs` ainda procurava as rotas de cena em `server.js`, apesar de estarem em `adminSocialStudioRoutes.js` desde a Fase 21; `social-studio-v2.test.mjs` usava sessões fixadas em 22/10/2026, já vencidas na data desta execução, e a validação corretamente rejeitava a pré-venda. O primeiro teste agora verifica a delegação do servidor **e** as mesmas ações/flag no handler; a fixture do segundo usa sessão sintética futura, sem alterar a regra de venda. Os dois arquivos passaram isolados (18/18); a bateria completa foi reexecutada após essas correções.

## Contratos e dependências

O [documento do contexto HTTP](FASE22_CONTRATOS_CONTEXTO_HTTP.md) mapeia ALS, identidade, logs, cookies, CSP, CSRF, rate, erro e resposta após commit. `readBody` é a única fronteira HTTP extraída. `requestContext` permanece único; `sendJson` e `deferUntilPostgresCommit` não mudaram. O dispatcher ainda verifica sessão, proprietário e status do ingresso antes de gerar QR ou chamar Wallet. Projeção enriquecida não se confunde com DTO do cliente; `toCustomerTicketDto` continua removendo PII e código de ingresso inativo. `socialStudioContextPresenter` continua compondo identidade e catálogo por instalação; o novo presenter apenas redige cenas. Os módulos não importam `server.js`, não iniciam timer ou provedor ao importar.

Os fallbacks de marca Cine Cruzeiro em serviços compartilhados (`socialStudioContextPresenter`, emissão/documentos de ingresso) foram identificados, mas não alterados: corrigir tais valores pode mudar a apresentação multi-cinema e exige comparação visual e HTTP das cinco instalações. O [mapa estrutural](FASE22_MAPA_ESTRUTURAL.md) foi atualizado com as fronteiras e bloqueadores.

## Validação

| Suite | Resultado local |
| --- | --- |
| Testes de caracterização 22.2 | Corpo, contexto, ingresso, Studio e Wallet passaram. |
| Ticket/QR, Wallet simulada, Studio, HTTP | Testes dirigidos passaram após cada lote; PostgreSQL descartável `smoke` passou após ingresso. |
| `npm run test:characterization` | Aprovado com as cinco suites novas. |
| `npm run test:unit` | Código 0; suites internas incluem casos condicionais ignorados por ambiente. |
| `npm run test:security:local`, `npm run test:finance`, `npm run test:maintenance` | Código 0; provedores simulados. |
| `npm run test:legacy:json`, `npm run lint`, `npm run build` | Código 0. |
| `npm run test:e2e` | 19/19 aprovados em servidor local isolado. |
| `npm run docs:check` | Código 0 após a documentação final; mapa com 47 documentos e links locais existentes. |
| Bateria ampliada Social Studio | Falhas iniciais 2/210 por teste estrutural antigo e fixture vencida; repetição final **210/210**, 0 ignorados. |

## Bloqueios e próxima sequência

1. **Contexto/auditoria:** `logEvent` ainda captura request store, Discord e PostgreSQL; separar sem perder ator após await ou escrever log antes do commit requer teste de persistência PG e ordem de erro. `ensureAdmin`, CSRF e rate permanecem no dispatcher para preservar precedência 401/403/429.
2. **Ingressos:** `enrichTicket` agora é projeção, mas `effectiveTicketStatus`, expiração, transferência, QR e geração de PDF ainda mesclam direitos e apresentação. Testar status e propriedade por HTTP em PG concorrente antes de mover os guards.
3. **Studio:** contexto comercial e identidade visual já estão em `socialStudioContextPresenter`; carregamento de imagem combina filesystem, validação Sharp e fetch com allowlist. Exige teste SSRF/arquivo e fidelidade de render antes de mudar.
4. **Financeiro:** `normalizeDb` ainda tem efeitos temporais; Pix/cartão, PagBank, Point, Clube, estoque, reembolsos e `reconcileOnlineCheckoutOrder` continuam bloqueados pelas lacunas de failpoints da [Fase 21](FASE21_COBERTURA_FINANCEIRA.md). A resposta do webhook Order segue **após** o commit (`9f7cefb`). 202 não equivale a pagamento aprovado.
5. **Lifecycle:** shutdown de HTTP/WS com trabalho externo em curso ainda não possui prova de dreno; não mover o proprietário do listener/worker antes do teste.

A redução menor é deliberada: os próximos blocos de centenas de linhas dependem de estado compartilhado ou efeitos externos, e os testes desta etapa estabeleceram fronteiras sem autorizar sua movimentação. A meta arquitetural final continua **não concluída**.
