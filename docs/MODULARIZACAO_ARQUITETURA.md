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

O painel usa um objeto `state` compartilhado para selecao, filtros, edicao, vendas, leitura de QR, campanhas, telemetria e atualizacao da interface. A inicializacao em `initAdmin` depende de `bindEvents`, dos elementos em `admin.html` e da ordem atual `jsQR.js` -> `admin.js` -> `social-studio.js`. Os eventos delegados e a CSP sem handlers inline devem permanecer.

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
