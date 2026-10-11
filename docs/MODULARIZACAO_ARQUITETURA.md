# Modularizacao estrutural: Cine Cruzeiro

## Referencia funcional

- Base: `codex/multi-cinema-rollout` em `ea7c5df`. Essa linha inclui os ajustes recentes de assinatura dos webhooks, SDK de pagamentos, CSP e seguranca.
- Branch de trabalho: `codex/modularize-server-admin`.
- Esta etapa altera organizacao de codigo, nao contratos HTTP, calculos, interface ou dados persistidos.
- O pedido desta refatoracao proibe deploy automatico. A branch sera validada localmente.

## Inventario anterior

| Arquivo | Linhas | Funcoes de topo | Principal concentracao |
| --- | ---: | ---: | --- |
| `backend/server.js` | 18.421 | 495 | `handleApi`: 6.877 linhas de rotas em sequencia |
| `backend/public/admin.js` | 14.337 | 607 | `bindEvents`: 1.171 linhas de listeners |

O backend mistura entrada HTTP, autenticacao administrativa e de clientes, seguranca, persistencia, catalogo, bilheteria, pagamentos, Clube, automacoes, integracoes, relatatorios, observabilidade, WebSocket e manutencao. Ja existem 123 arquivos em `backend/services` e 12 repositorios; uma nova extracao deve reutilizar essas fronteiras antes de criar outras. `server.js` importa servicos e repositorios, mas nao foi identificado `require` de volta para ele nesses diretorios.

O painel usa um objeto `state` compartilhado para selecao, filtros, edicao, vendas, leitura de QR, campanhas, telemetria e atualizacao da interface. A inicializacao em `initAdmin` depende de `bindEvents`, dos elementos em `admin.html` e da ordem atual `jsQR.js` -> `admin-modules/*` -> `admin.js` -> `social-studio.js`. Os eventos delegados e a CSP sem handlers inline devem permanecer. Timers do QR, pagamentos presenciais, busca de clientes, campanhas e refresh, alem de SSE de telemetria e WebSocket de poltronas, continuam sob controle do script principal.

## Fronteiras criticas

- `requiredAdminPermission`, `adminAuthRequired`, `ensureAdmin`, origem, CSRF, rate limiting e tratamento de erros ficam na entrada ate haver testes de contrato que cubram toda a tabela de rotas. Modulos de rota nao podem contornar essa verificacao.
- Webhook Mercado Pago em `handleApi` permanece intocado nesta primeira fase: headers, HMAC, `data.id`, consulta ao provedor, idempotencia e reconciliacao sao controles de seguranca financeira.
- `readDb`, `withCriticalMutation`, repositorios direcionados e WebSocket tem ordem e concorrencia sensiveis; dependencias devem ser injetadas, sem importar `server.js` de um modulo.
- A configuracao por instalacao vem de ambiente e banco; modulos compartilhados nao devem codificar uma marca ou credencial.
- `loadEnvFiles` antecede o listen, mas muitos objetos sao criados antes; novos modulos nao devem capturar variaveis de ambiente no carregamento se a configuracao depende desse passo.

## Acoplamento dos testes

Ha testes que inspecionam texto/funcoes de `server.js` e `admin.js`, alem dos testes HTTP e de navegador. Exemplos: catalogo e sessoes, seguranca CSP/XSS, logs, importacao TMDB e operacao financeira. Quando uma funcao mudar de arquivo, o teste estrutural deve apontar para a nova fonte sem relaxar suas assercoes. Testes de comportamento HTTP devem permanecer iguais.

## Etapas de extracao

1. Apresentacao dos logs do admin: funcoes puras e sem estado em um script local carregado antes de `admin.js`; API explicita em um namespace unico, sem etapa nova de build.
2. Composicao do dashboard administrativo no backend: mover a funcao de agregacao sem alterar expressoes financeiras; injetar somente as dependencias que ela realmente usa.
3. Rotas de catalogo, salas e sessoes: extrair por grupo preservando a ordem atual, a verificacao central de permissao, codigos e respostas. Testar HTTP, conflitos de sala e historico de vendas.
4. Um controlador de UI coeso do admin, depois de mapear suas referencias de `state` e listeners. Evitar criar um segundo registro global de eventos.
5. Reavaliar areas sensiveis restantes (auth, pagamentos, reservas, WebSocket) somente com cobertura especifica. Checkout e persistencia PostgreSQL ficam fora da primeira fase.

Cada etapa recebe um commit separado e regressao direcionada. Nenhuma migracao de banco deve ser necessaria para a modularizacao.

## Linha de base executada

- `npm run lint` e `npm run build`: passaram.
- Permissoes: 4/4; metadata de pagamentos: 7/7; conflitos de sessoes: 10/10.
- Catalogo/operacoes: 15 passaram, 1 PostgreSQL ignorado sem `TEST_DATABASE_URL`.
- Repositorios admin: 6 passaram, 3 PostgreSQL ignorados sem `TEST_DATABASE_URL`.
- 2FA administrativo e assinaturas de webhook Mercado Pago: passaram.
- `npm run test:security:local`: 19/19, mais os scripts de imagens, webhooks e poltronas.

Nao foi executado `npm test` integral nesta linha de base porque `scripts/smoke-tests.js` escreve no caminho fixo `backend/data/db.json`, compartilhado com o workspace. Os testes HTTP isolados usam arquivos temporarios e nao alteram os dados locais. A validacao PostgreSQL real ainda requer um banco de teste isolado.

## Fronteira de rotas e permissoes

`adminAuthRequired`, `requiredAdminRoles`, `requiredAdminPermission` e `ensureAdmin` permanecem em `server.js`. O dispatcher chama os novos handlers somente depois de `ensureAdmin`; a ordem entre os grupos extraidos e as rotas restantes foi preservada. A tabela resume as familias afetadas; a regra por metodo continua definida nas funcoes centrais.

| Familia de endpoints | Papel permitido | Permissao principal |
| --- | --- | --- |
| `/api/admin/dashboard` | owner, manager, operator | `dashboard.view` |
| `/api/movies`, `/api/movies/:id`, `/api/movies/order` | owner, manager | `movies.view/create/edit/delete` conforme metodo |
| `/api/movies/:id/sessions`, `/api/admin/sessions/autocorrect` | owner, manager | `sessions.manage`, `sessions.autocorrect` |
| `/api/rooms`, `/api/rooms/:id` | owner, manager | `rooms.view/create/edit/delete` |
| `/api/ticket-types`, `/api/ticket-types/:id` | owner, manager | `ticket_types.view/create/edit/delete` |
| `/api/concessions`, `/api/concessions/:id` | owner, manager | `concessions.view/edit/delete` |
| `/api/promotions`, `/api/ads` e subrotas | owner, manager | `marketing.view/manage` |
| `/api/admin/logs`, `/api/admin/logs/performance`, `/stream` | owner, manager (DELETE: owner) | `logs.view` (DELETE: `logs.delete`) |

Rotas de clientes, checkout, bilheteria, Clube, integracoes, automacoes e webhooks permanecem no dispatcher original. As excecoes de autenticacao para webhooks e automacoes continuam acompanhadas de suas verificacoes especificas de assinatura/token. O controle de origem/CSRF, a autenticacao 2FA e o rate limiting nao foram movidos.

## Resultado desta fase

| Arquivo principal | Antes | Depois | Reducao liquida |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 18.421 | 17.330 | 1.091 linhas |
| `backend/public/admin.js` | 14.337 | 12.356 | 1.981 linhas |

Foram extraidas 3.428 linhas em doze modulos. A diferenca entre codigo extraido e reducao liquida vem de factories, contratos de dependencia, adaptadores de rota e carregamento explicito. A extracao nao altera esquema de banco, payloads de pagamentos nem arquivos de configuracao por cinema.

| Modulo | Responsabilidade | Dependencias relevantes |
| --- | --- | --- |
| `backend/services/adminDashboardService.js` | Agregar indicadores administrativos | Reconhecimento financeiro e helpers injetados do dispatcher |
| `backend/services/movieCatalogHandler.js` | Filmes, sessoes e autocorrecao | Repositorios de filmes/sessoes, validadores e realtime injetados |
| `backend/services/venueConfigurationHandler.js` | Salas, limpeza e tipos de ingresso | Repositorios de salas/tipos e estado de poltronas |
| `backend/services/commercialCatalogHandler.js` | Catalogo de bomboniere, promocoes e anuncios | Repositorios comerciais e validadores existentes |
| `backend/services/adminLogsHandler.js` | Consulta, stream e retencao de logs administrativos | Monitor de desempenho por getter, persistencia de logs e auditoria injetados |
| `backend/public/admin-modules/log-presentation.js` | Textos e classificacao dos logs | Sem estado ou DOM |
| `backend/public/admin-modules/dashboard-view.js` | Indicadores e grafico do dashboard | `state` e helpers de DOM/formatacao injetados |
| `backend/public/admin-modules/performance-view.js` | KPIs, graficos e alertas de telemetria | Seletores/escape injetados; pico de CPU local ao modulo |
| `backend/public/admin-modules/club-view.js` | Apresentacao de planos, assinaturas e uso | `state` e helpers de renderizacao injetados |
| `backend/public/admin-modules/concession-sales-view.js` | Vendas diarias, estados de arquivamento e detalhes da bomboniere | `state`, DOM, API e comandos financeiros injetados |
| `backend/public/admin-modules/promotions-view.js` | Lista, formulario e historico de cupons | `state`, DOM, API e helpers de formulario injetados |
| `backend/public/admin-modules/ads-view.js` | Lista, formulario e controle de exibicao de anuncios | `state`, DOM, API e helpers de formulario injetados |

Os modulos de navegador usam um unico namespace explicito, `CineAdminModules`, carregado por scripts locais antes de `admin.js`. Nao ha segundo registro global de eventos ou etapa nova de build. Os handlers do backend recebem os servicos e repositorios por parametro; nenhum importa `server.js`, evitando ciclo de dependencia.

## Validacao apos extracoes

- `npm run lint` e `npm run build`: passaram.
- Dashboard, catalogo, salas, configuracao de limpeza e catalogo comercial: testes HTTP em banco JSON isolado passaram. O primeiro teste de conta falhou intermitentemente ao renomear um arquivo temporario no Windows quando rodou em paralelo; passou nas repeticoes seriais.
- `test:permissions`: 4/4; `test:finance`: 50/50; `test:coupon`: 6/6; `test:payment-metadata`: 7/7; `test:session-conflicts`: 10/10; `test:google-wallet`: 17/17.
- `test:catalog-operations`: 15 passaram, 1 PostgreSQL ignorado. `test:admin-repositories`: 6 passaram, 3 PostgreSQL ignorados. `TEST_DATABASE_URL` nao esta disponivel; nenhum banco de producao foi usado como substituto.
- `test:security:local`: 19/19, mais scripts de imagem, assinatura Mercado Pago e realtime de poltronas. Testes de UI com Playwright no fluxo administrativo isolado passaram sem erro JavaScript; os modulos novos tem testes de renderizacao e de ordem de carregamento.
- Extracoes adicionais: vendas da bomboniere 3/3, cupons 2/2 e handler de logs 2/2. O teste HTTP isolado confirmou GET/DELETE de logs para dono e 403 para operador; o Playwright confirmou lista, formulario e filtro de cupons apos a extracao. A verificacao de CSP/XSS passou a ler tambem os novos scripts.
- Anuncios: 2/2 no teste do modulo; Playwright confirmou lista e formulario. A verificacao CSP/XSS incluiu o script de anuncios. `test:coupon` 6/6, `test:permissions` 4/4 e `deploy:validate` confirmaram as regras e o registro das instalacoes. `npm run lint`, `npm run build` e `test:security:local` foram repetidos apos essa etapa e passaram.
- Persistencia: 8 passaram, 2 PostgreSQL ignorados. Publicacao de filmes: 5/5; mapa de poltronas: 2/2; registro de instalacoes: 6/6; `deploy:validate`: `REGISTRY_OK=1`.
- `test:email-campaign`: 40 passaram, 7 ignorados, 1 falhou em `email-automation.test.mjs` por esperar `29/09 · 19:00` no HTML semanal. Nem o teste nem `emailAutomationService.js` mudaram em relacao a `ea7c5df`; a falha foi mantida fora do escopo desta refatoracao.
- Nao foi executado `npm test` integral pelo risco conhecido de escrita em `backend/data/db.json` pelo smoke test. Nao houve homologacao ao vivo com provedor de pagamento, PostgreSQL, PM2 ou Nginx; nenhum deploy foi feito, conforme solicitado.

## Pendencias de arquitetura

`handleApi` ainda concentra autenticacao, bilheteria, Clube, integracoes, pagamentos e webhooks; `bindEvents` ainda concentra os listeners do admin. Essas partes exigem testes de contrato, concorrencia e permissao mais completos antes de extracoes adicionais. Em particular, o webhook Mercado Pago funcional e o payload de Orders foram deliberadamente preservados. `CheckoutPage.tsx` e `postgresStore.js` permanecem fora desta fase. A compatibilidade multi-cinema foi verificada por ausencia de novos valores de ambiente, credenciais ou marca fixa nos handlers compartilhados; a validacao de cinco instalacoes em execucao continua pendente.

## Continuação: infraestrutura de testes

O teste de automação de e-mail passou a usar a mesma data planejada para selecionar filmes e renderizar as sessões (commit `c20ddd6`); a suíte `test:email-campaign` passou. O smoke antigo foi isolado em diretório temporário e atualizado para contratos atuais de impressão, rascunhos e batch de webhooks. O modo legado JSON passou integralmente, sem acesso ao `backend/data/db.json` do workspace. Uma retentativa limitada para `rename` com `EPERM`/`EBUSY` no Windows foi adicionada ao armazenamento JSON; não há fallback que apague o destino.

O fluxo padrão agora exige PostgreSQL descartável e marcado, conforme [TESTES_POSTGRESQL.md](TESTES_POSTGRESQL.md). Um contêiner PostgreSQL 16 local e temporário permitiu validar o smoke HTTP, a concorrência e os repositórios em bancos independentes, criados e removidos pelo harness; o modo JSON legado e os unitários também passaram. O smoke revelou e permitiu corrigir a precisão da atualização otimista de pedidos, o contexto transacional herdado por tarefas em segundo plano, um deadlock no simulador de webhooks e a normalização de anúncios. Essas correções não alteraram os contratos financeiros ou a validação de webhooks do Mercado Pago. Nenhum banco operacional ou VPS foi modificado; nenhum deploy foi realizado.

Após essa validação, os listeners de filtro, seleção, ações e arraste da lista de filmes foram extraídos de `bindEvents` para `backend/public/admin-modules/movie-catalog-events.js`. O módulo recebe as ações já existentes por dependência, sem alterar rotas ou estado compartilhado; um teste focado confirma o carregamento anterior a `admin.js`, os filtros e o arraste, e a verificação de CSP inclui o novo arquivo.

## Commits

`c864d05` auditoria/baseline; `2596baf` logs do admin; `0f6117f` dashboard backend; `8555e17` dashboard UI; `068f17e` filmes/sessoes; `af1f8bf` telemetria UI; `ce11961` salas/tipos; `2d7cf66` Clube UI; `911f62f` catalogo comercial; `94fb19f` cobertura dos repositorios apos extracao; `71672f5` vendas da bomboniere UI; `94dac03` logs administrativos backend; `8b01228` cupons UI; `5f9dc67` anuncios UI; `078b243` relatorio intermediario.

## Fase 3: CI, integridade e novas fronteiras

| Arquivo | Inicio da refatoracao | Inicio da Fase 3 | Fim da Fase 3 |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 18.421 | 17.339 | 17.236 |
| `backend/public/admin.js` | 14.337 | 12.322 | 12.310 |

A reducao de linhas nao foi usada como criterio de sucesso. O novo `tmdbMovieMapper.js` concentra apenas a traducao da resposta externa para o rascunho do filme e recebe `slugify` explicitamente; o dispatcher conserva a chamada HTTP e a autenticacao. O modulo `session-ticket-actions.js` concentra o despacho das acoes de sessao e ingresso, mas deixa o unico listener delegado em `bindEvents`; nenhuma variavel global nova nem listener duplicado foi introduzido. Ambos sao testaveis sem inicializar o servidor ou a pagina inteira. Os demais modulos extraidos anteriormente continuam com suas fronteiras originais.

O workflow PostgreSQL usa um service container identificado por ID Docker, instala um role de testes sem superusuario e um marcador de instancia por `docker exec`, e so entao entrega uma URL local ao harness. O harness rejeita URLs operacionais herdadas e exige marcador de instancia e de banco antes de migrations e resets. Os bancos temporarios sao removidos ao termino, inclusive apos falha. O primeiro CI revelou interferencia entre arquivos de teste simultaneos no mesmo banco; a serializacao entre arquivos corrigiu o harness, mantendo as corridas intencionais dentro de cada arquivo. Nao houve conexao com bancos de cinema nem deploy.

O teste de pedido com duas revisoes no mesmo milissegundo falhou no CI como esperado antes da correcao (`Missing expected rejection`, run `38095849604`). O `date_trunc('milliseconds', updated_at)` aceitava a revisao obsoleta. O editor administrativo agora compara a versao exata da linha PostgreSQL (`xmin`), transportada como propriedade nao enumeravel do objeto de repositorio; o JSON publico e o payload financeiro nao mudaram. O mesmo teste e a suite financeira passaram apos a correcao (run `38095945356`). O teste de repositório continua cobrindo idempotencia de pedido e exclusividade de transicao de status; a suite de concorrencia cobre ultima poltrona, ultimo estoque, webhook repetido, pagamento/ticket unico e creditos do Clube. O teste de persistencia cobre rollback e invalidacao de cache entre conexoes. O uso de `outsidePostgresTransaction` foi confirmado nos trabalhos em segundo plano de e-mail e webhook batch; o `CampaignOrchestrator.enqueue` do Social Studio ainda herda potencialmente contexto assincrono de uma requisicao e merece teste de isolamento proprio antes de alterar sua execucao.

Validacao observada: `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:security:local`, `npm run test:legacy:json`, `npm run test:deployment` e `npm run deploy:validate` passaram localmente. O Playwright direcionado a `e2e/admin-session-actions.spec.js` passou (1/1), abrindo o editor pela agenda sem erro JS. A suite E2E completa nao passou: 5 testes passaram, 9 falharam e 3 nao rodaram; ha seletores antigos ambiguos e testes para o provedor Gemini removido, alem de cenarios de reserva/sessao que precisam investigacao propria. A porta 3000 estava ocupada por outro projeto, por isso o harness E2E recebeu uma porta de frontend configuravel e nao reutiliza servidor alheio.

No GitHub Actions, os workflows PostgreSQL e de seguranca passaram no commit `2a73982` (runs `38096359199` e `38096359190`). Uma execucao anterior do smoke PostgreSQL (`38096064338`) falhou intermitentemente ao encontrar 0, em vez de 3, creditos restaurados apos o cancelamento de um pedido do Clube; a execucao seguinte passou sem alteracao nessa logica. Essa instabilidade nao foi resolvida nem ignorada e e risco de integridade a investigar. Nao houve homologacao financeira com provedor real ou validacao das cinco instalacoes em execucao; `deploy:validate` verifica apenas o registro de configuracao.

Proximos candidatos: isolar o agendamento do Social Studio do contexto transacional herdado com teste especifico; reproduzir e corrigir a intermitencia de devolucao de creditos; atualizar os testes E2E antigos para os fluxos atuais; continuar extraindo grupos administrativos pequenos com cobertura de navegador. Auth, webhooks e checkout permanecem fora de extracoes cosmeticas.

Commits desta fase: `9e852ed` CI PostgreSQL protegido; `ad99f94` serializacao dos arquivos de repositório; `2113a44` teste regressivo da revisao obsoleta; `af7ff88` controle exato de versao do pedido; `78301d0` acoes de sessao/ingresso; `62a3750` mapeamento TMDB; `2a73982` isolamento do Playwright e cobertura de navegador.

## Fase 4: estabilizacao das pendencias da Fase 3

O checkout integral com creditos do Clube enviava HTTP 201 e agendava o e-mail dentro de `withCriticalMutation`, depois de `writeDb`, mas antes do `COMMIT` externo do PostgreSQL. Assim, um cliente podia consultar ou cancelar o pedido antes da confirmacao da transacao, e o worker de e-mail podia registrar `order_not_found` ao ler por outra conexao. O sucesso agora e respondido e o e-mail e agendado apenas depois que a mutacao retorna. A falha eventual da liberacao do hold de poltrona e registrada sem converter uma compra ja persistida em erro HTTP. O smoke verifica imediatamente, sem espera artificial, tres creditos consumidos apos o 201 e tres creditos restituidos apos o cancelamento; em caso de divergencia, inclui status, espelho, contagens detalhadas e uso na mensagem da assercao.

O E2E revelou uma falha real de reconexao: uma consulta de poltronas offline removia o ultimo mapa valido, desativando o WebSocket. O mapa agora permanece disponivel durante a falha, e o retorno do estado da sessao apos reconexao atualiza a consulta. Os demais testes foram atualizados para contratos atuais: nome e sobrenome separados, credito do Clube com prioridade sobre desconto percentual, Device ID sintetico nos testes Pix, impressora simulada na venda presencial, entrega online na venda de sessao, logs pelo endpoint dedicado e campanha de e-mail sem o antigo provedor Gemini. O contexto administrativo do teste de checkout reaproveita o login, respeitando o limite real de 12 logins por minuto.

Validacao local desta etapa: `npm run lint`, `npm run build`, `npm run test:unit` e Playwright completo (`18/18`) passaram. O PostgreSQL local nao estava disponivel; o smoke PostgreSQL e os testes de concorrencia dependem da execucao isolada do GitHub Actions para confirmar a correcao. Nenhum banco operacional, provedor real ou VPS foi usado; nenhum deploy foi feito.

### Conclusao da investigacao de concorrencia

O CI reproduziu a falha dos tres creditos mesmo apos o checkout passar a responder depois do commit. O diagnostico comparou a resposta de `/api/me/subscriptions` com as tabelas `subscription_credits` e `subscription_usage`: em uma execucao o banco ja registrava o estorno, mas a leitura HTTP ainda via o estado antigo; em outra, ambos ainda mostravam os creditos consumidos. A causa comum era o `DELETE /api/orders/:id` administrativo: o dispatcher envolvia todo o handler em `withCriticalMutation`, enquanto `cancelOrderWithRefund` fazia uma mutacao aninhada e o handler enviava HTTP 200 antes do commit da transacao externa. O `DELETE` agora usa somente as transacoes proprias de seus dois caminhos e conserva o snapshot de auditoria administrativa. O smoke exige saldo e uso atualizados imediatamente apos o 200, sem espera ou tolerancia a resultado incorreto. O cancelamento tambem recusa concluir caso um uso do Clube presente nao possa ser devolvido.

Os logs do CI revelaram outra corrida: e-mails de ingressos eram agendados ainda dentro de transacoes PostgreSQL. Os callbacks de entrega agora sao executados somente apos o commit e descartados no rollback; a fila do Social Studio tambem nao herda o contexto transacional. Testes no banco descartavel cobrem visibilidade pos-commit, rollback e inicio da fila apenas depois da confirmacao. O cache de snapshots passou a repetir uma leitura invalidada durante o carregamento, para nao entregar ao proprio leitor uma versao antiga. No smoke, a edicao de um pedido da bilheteria aguarda o estado observavel da entrega de ingressos; o controle de versao do pedido continua rejeitando edicoes simultaneas.

Evidencia final: o workflow PostgreSQL `38104624558` passou com **10/10 execucoes independentes do smoke**, seguidas das suites de concorrencia e repositorios (sem falhas); o workflow de seguranca `38104624527` passou. O CI cotidiano ficou com tres execucoes isoladas do smoke por push. A homologacao com provedor real, VPS e as cinco instalacoes continua fora do escopo; nao houve deploy.

### Extracao do catalogo comercial e isolamento E2E

A montagem da resposta publica do catalogo comercial saiu do `backend/server.js` para `backend/services/commercialCatalogPresenter.js`. O dispatcher ainda verifica o token e aplica CORS; o novo modulo recebe explicitamente as regras ja existentes de sessao, sala, ingresso e URL publica. Um teste comportamental cobre a identidade da instalacao, filmes publicados, sessoes disponiveis, ofertas, cupons e imagens absolutas. O lint, o build, a suite unitaria e os workflows PostgreSQL `38153565474` e Security regression `38153565479` passaram no commit `f7332d1`.

O Playwright local revelou dois problemas no ambiente descartavel: o backend de teste escutava na porta 4000, mas o frontend apontava para o fallback 4100; alem disso, sessoes sinteticas fixas para amanha as 19h e 21h ficavam fora da janela real de venda de 24 horas em parte do dia. O servidor E2E passou a apontar explicitamente para o backend isolado e a criar as sessoes de amanha na hora atual de Sao Paulo, mantendo-as futuras e vendaveis. A suite completa passou com **18/18 testes** depois dessa correcao. Naquele ponto os dados de teste ainda ficavam em `.e2e-data/db.json`; a Fase 4.2 abaixo substituiu esse caminho por diretorio temporario. Nenhum banco operacional ou provedor real foi utilizado, e nao houve deploy.

## Fase 4.2: E2E no CI e limites transacionais

Branch: `codex/modularize-server-admin`. HEAD de codigo auditado: `d80b5d3` (o commit deste relatorio o sucede). A referencia anterior era `f2e1ea1`. A contagem de linhas fisicas passou de 17.117 para 17.097 em `backend/server.js` e de 12.310 para 12.290 em `backend/public/admin.js`; a reducao nao foi usada como meta artificial.

O job `Browser E2E` usa Linux/Chromium, `npm ci`, `scripts/run-e2e.js` e diretorios temporarios exclusivos para JSON, uploads, anexos e documentos. O wrapper encerra os processos e remove o diretorio de sua execucao; o workflow conserva traces e screenshots em falhas. O horario sintetico vem de uma unica referencia temporal, e a verificacao de mudanca de dia tem teste unitario. O teste de sessao aguarda a entrega de ingresso persistida antes de editar o pedido, eliminando uma corrida do fixture. O Playwright local passou **18/18** apos as extracoes e novamente apos o ajuste de Pix/cartao; o job do GitHub passou em `474e515`, `ff1f42b` e `d80b5d3`. A suite E2E usa JSON *temporario* para os processos do navegador; o smoke e as corridas PostgreSQL continuam independentes no job de integracao.

O CI reproduziu tres respostas prematuras distintas: cancelamento apos Pix 201 podia retornar `ORDER_CHANGED` por ler antes do commit; atribuicao manual de assinatura 201 podia nao aparecer na consulta imediata; exclusao permanente e validacao de ingresso tambem enviavam 200 dentro da transacao. Pix/cartao, atribuicao do Clube, exclusao permanente e validacao agora respondem depois da confirmacao de suas mutacoes. A atualizacao publica das poltronas no fluxo online ocorre apos o commit. O smoke exige visibilidade imediata do Pix, cartao, assinatura, exclusao e validacao; nao usa polling para essas invariantes. Os codigos HTTP e payloads de sucesso foram preservados. Falhas de validacao continuam retornando os mesmos erros. Nao houve alteracao do nucleo da Orders API, do HMAC ou dos handlers de webhook do Mercado Pago.

O catalogo comercial agora tem testes HTTP com token correto, incorreto e ausente, preflight e origens CORS permitidas/bloqueadas; nao inclui credenciais CORS para origens arbitrarias. `commercialCatalogAccessPolicy.js` concentra extracao do token, comparacao em tempo constante, identificacao da rota e allowlist de origem, sem importar `server.js`; o dispatcher permanece responsavel pela resposta HTTP. `commercialCatalogPresenter.js` limita `artworkMetadata` a campos visuais conhecidos para nao repassar dados administrativos aninhados. Os testes cobrem filmes, sessoes, ofertas, cupons, bomboniere e identidade da instalacao. `admin-modules/log-events.js` recebeu os filtros, acoes e debounce dos logs, com estado e DOM passados explicitamente; `bindEvents` continua o unico ponto de registro. O teste do modulo verifica carregamento, listeners, abas, filtros e acoes, e o Playwright completo verificou o carregamento do painel.

O cache PostgreSQL foi exercitado com leituras paralelas e duas invalidacoes sucessivas durante carregamentos; os leitores convergiram ao snapshot mais novo sem alterar a politica de cache. Falha/recuperacao de conexao ja tem teste direcionado. Sob mutacoes incessantes, a repeticao pode prolongar uma leitura: ainda nao ha benchmark de carga multiprocesso, portanto este limite permanece observavel, nao resolvido por uma mudanca ampla.

### Tarefas pos-commit e limites

O e-mail de ingresso e agendado apenas apos commit e a entrega consulta o pedido persistido. O `Set` de trabalhos pendentes e o `setImmediate` sao locais ao processo: uma interrupcao antes do callback pode perder o envio; uma interrupcao depois de enviar mas antes de persistir `emailDeliveredAt` pode provocar duplicacao em uma futura tentativa. Ha reenvio manual autenticado, logs `ticket_email.background_*` e estado `ticketDelivery`, mas **nao existe retomada automatica duravel** para esse e-mail. Nao se ativou uma varredura de reenvio no startup, pois sem claim duravel e idempotencia no provedor isso multiplicaria o risco de mensagens duplicadas. A menor proxima etapa confiavel e uma outbox por pedido com claim transacional, expiracao de lease e chave de idempotencia de entrega; validar em banco descartavel antes de habilitar recuperacao. Campanhas de e-mail ja possuem worker/reconciliacao persistidos; o Social Studio tem `resumePending()` no startup, limitando a lista inicial a 100 campanhas. Isso nao comprova recuperacao de todas as campanhas se houver backlog maior.

### Evidencias e escopo

- Commits: `474e515` E2E no CI; `c772641` validacao de ingresso; `e02a098` CORS/teste HTTP do catalogo; `ff1f42b` eventos de logs; `05919ae` politica de acesso do catalogo; `49edc96` teste de invalidacoes; `b244ae0` exclusao permanente; `4892f98` Pix/cartao; `1e923c1` metadados publicos; `d80b5d3` atribuicao manual do Clube.
- Arquivos centrais alterados: `backend/server.js`, `backend/public/admin.js`, `backend/public/admin.html`, `backend/services/commercialCatalogPresenter.js`, `scripts/smoke-tests.js`, `package.json`, workflows e testes. Modulos novos: `backend/services/commercialCatalogAccessPolicy.js`, `backend/public/admin-modules/log-events.js` e auxiliares de isolamento E2E. Dependencias eliminadas: politica de token/CORS e eventos de logs deixaram os arquivos monoliticos; regras financeiras, estado global do painel e roteamento permanecem neles.
- Validacao local: `npm run lint`, `npm run test:unit`, `npm run test:security:local`, `npm run test:legacy:json`, `npm run test:finance`, `npm run deploy:validate` e Playwright completo **18/18** passaram. O PostgreSQL local nao foi executado porque nao havia um contêiner descartavel autorizado; nenhum banco operacional foi usado como substituto.
- GitHub Actions: security, browser E2E e PostgreSQL passaram em `d80b5d3`. Jobs PostgreSQL anteriores falharam em `e02a098` (cancelamento imediatamente apos Pix 201) e `4892f98` (leitura imediatamente apos atribuicao manual); as falhas foram investigadas e corrigidas, sem relaxar as assercoes. A suite posterior passou com as mesmas leituras imediatas. Nenhum pagamento real foi executado.
- Multi-cinema: `npm run deploy:validate` aprovou o registro de cinco instalacoes. Os novos modulos usam configuracao/identidade do banco e do ambiente, sem dominios ou marcas compartilhadas codificados; nao houve teste de ponta a ponta nas cinco instalacoes operacionais.
- Riscos residuais: outbox duravel de ingressos, backlog superior a 100 campanhas do Studio, rotas administrativas ainda encapsuladas pelo lock externo que podem responder dentro da transacao, benchmark do cache em carga elevada e homologacao por cinema. Candidatos seguintes de modularizacao: consultas administrativas de assinaturas e apresentacao de sessoes/salas, com testes HTTP antes de extrair. Nenhum deploy ou acesso a banco/VPS operacional nesta fase.

## Fase 5: recuperacao duravel e mapa arquitetural inicial

Branch `codex/modularize-server-admin`, base `0fce092`. Commits de codigo publicados nesta fase: `48b1871` (recuperacao Studio), `f261d81` (e-mail de ingressos), `2e48022` (respostas Clube e reenvio), `9c2e4fd` (leitura administrativa de assinaturas), `a87ca39` (painel de repasse), `2629915` (testes de recuperacao), `b6fadb9` (E2E de repasse), `a90ad24` (mapa), `679471e` (cursor PostgreSQL) e `b2b034a` (respostas de bomboniere e rascunho). Este relatorio e a verificacao final do CI sucedem esses commits. Nenhum deploy, merge na `main`, acesso a banco operacional ou pagamento real foi feito.

### Auditoria e extracoes

O dispatcher HTTP, seguranca, reservas, pedidos e pagamentos ainda se concentram em `backend/server.js`; o estado compartilhado, `bindEvents`, formulários e navegacao do painel ainda se concentram em `backend/public/admin.js`. Historico de beneficios do Clube, consultas administrativas, relatorios de repasse e eventos de painel foram avaliados. A leitura de assinaturas foi escolhida por possuir limite de apresentacao claro e dependencias injetaveis; `adminSubscriptionPresenter.js` compoe lista e detalhe, enquanto autenticacao, autorizacao, HTTP e atualizacao de creditos permanecem no servidor. Nao se deslocou o processamento de beneficios ou a escrita financeira apenas para reduzir linhas.

No painel, `ticket-finance-view.js` passou a reunir carga, apresentacao, filtros, salvamento, download e vinculacao de eventos de repasse. Recebe estado, DOM e funcoes auxiliares explicitamente; `bindEvents` em `admin.js` continua o unico ponto de inscricao. O teste unitario e o Playwright conferem que nao ha registro duplicado e que a tela permanece utilizavel. Formulario de sessao e gestao de clientes ficaram para etapa posterior por compartilharem estado e regras com outras telas. Nao foram criadas dependencias circulares com `server.js`.

| Arquivo | Inicio | Antes da Fase 5 | Depois da Fase 5 |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 18.421 | 17.097 | 17.091 |
| `backend/public/admin.js` | 14.337 | 12.290 | 12.174 |

### Confiabilidade e transacoes

O trigger da migration `051_ticket_email_jobs.sql` cria o trabalho de e-mail na mesma transacao que marca o pedido pago e solicita entrega digital. Rollback nao deixa job. O worker PostgreSQL recupera jobs apos reinicio, reivindica com `FOR UPDATE SKIP LOCKED`, renova o lease, reconsulta pedido/ingressos e limita tentativas com backoff. Pedidos cancelados, ausentes, fisicos ou ja entregues nao provocam novo envio. O modo JSON conserva apenas o agendamento anterior por compatibilidade. O provedor pode aceitar uma mensagem antes de o processo persistir `emailDeliveredAt`; nesse intervalo um crash ainda pode duplicar o e-mail. Nao se promete exatamente uma entrega. Diagnostico, observabilidade e reversao sem excluir pendencias estao em [operacoes](architecture/operations.md).

O Social Studio antes lia no maximo 100 campanhas ao reiniciar. Agora recupera paginas de 20, no maximo dois trabalhos simultaneos por instancia, com claim condicional e heartbeat para trabalhos longos. Uma fila com 125 itens e disputa por claim foram exercitadas. O primeiro CI expôs um cursor vazio invalido para UUID; `679471e` substituiu-o por `NULL` tipado. O limite global entre instancias e os efeitos externos de uma renderizacao retomada ainda exigem observacao operacional.

As respostas 200/201 de cancelamento e assinatura do Clube, reenvio manual, arquivo administrativo de bomboniere e exclusao de rascunho foram deslocadas para depois de `withCriticalMutation`, preservando codigos e payloads. O smoke exige leitura imediata de assinatura e arquivo de bomboniere. A liberacao WebSocket do rascunho ocorre depois do commit; essa via de rascunho e propria do modo JSON, ja que o esquema PostgreSQL nao aceita o status `draft`. Permanecem outros `sendJson` em callbacks de mutacao no dispatcher, alguns exclusivos do JSON e outros dependentes do caminho PostgreSQL; revisar individualmente com reproducoes HTTP antes de modifica-los. Nao houve mudanca em HMAC, Orders API, Pix, cartao ou webhooks do Mercado Pago.

### Mapa e validacao

O [Mapa Inteligente](architecture/README.md) e `AGENTS.md` oferecem entrada por intencao, 20 grupos de dominio iniciais, modulos extraidos, oito fluxos de ponta a ponta e operacao assincrona. Cada referencia aponta para arquivo real; `npm run docs:check` verifica links locais em seis documentos e roda no CI de seguranca. Ele nao valida semantica. Ainda faltam inventario completo de funcoes, migrations, eventos, dependencias cruzadas, particularidades das cinco instalacoes e auditoria de todos os endpoints. O codigo continua fonte definitiva. `npm run deploy:validate` aprovou o registro compartilhado de cinco cinemas; nao valida os ambientes operacionais isolados.

Localmente passaram `npm run test:unit`, `npm run test:security:local`, `npm run test:legacy:json`, `npm run lint`, `npm run build`, `npm run docs:check` e `npm run deploy:validate`. O Playwright completo passou com 18/18 antes do novo caso; o caso de repasse passou em execucao direcionada 2/2. O servidor E2E utilizou porta 3101/3102 porque a 3000 ja estava ocupada; nenhuma aplicacao alheia foi encerrada. Sem um PostgreSQL descartavel autorizado localmente, os testes `database-persistence-postgres.test.mjs` foram ignorados nessa estacao, nao substituidos por JSON; o job de integracao CI executa migrations e seeds em banco temporario com marcadores de seguranca, sem usar bancos existentes. O primeiro job do commit `a90ad24` falhou no cursor UUID descrito acima; o resultado final da nova rodada deve ser conferido antes de declarar a fase aprovada.

Para a Fase 6: auditar as rotas de pedidos/bilheteria ainda com resposta interna a mutacoes, extrair um grupo coeso de clientes ou formulario de sessoes com teste HTTP/E2E, ampliar o mapa para permissao/persistencia por endpoint e medir recuperacao do Studio sob multiplas instancias. O mecanismo de e-mail precisa de idempotencia do provedor (ou deduplicacao operacional) para reduzir o risco residual entre envio e confirmacao local.
