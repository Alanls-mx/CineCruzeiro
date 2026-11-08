# Fase 23.1 — homologação funcional integrada

**Branch:** `codex/cine-homologacao-fase23`, derivada de `codex/cine-backend-desacoplamento` em `0a8e06d87a0e604cc9607df399ebe4a98d62edc0`. O SHA do commit documental deve ser conferido com `git rev-parse HEAD` na entrega, pois o documento não pode incluir seu próprio hash. Sem merge, deploy, VPS, banco operacional, envio de campanha ou provedor real.

## Decisão

**APROVADA COM RESSALVAS para os fluxos locais exercitados.** Os 22 testes de navegador passaram tanto com fixture JSON de compatibilidade quanto com PostgreSQL 16 descartável. O checkout Pix, a conta do cliente, a bilheteria, os holds, o Clube, as permissões e a edição de sessão com vendas têm evidência integrada. A [matriz](FASE23_1_MATRIZ_FLUXOS.md) contém **9 fluxos homologados localmente, 14 com ressalvas, 1 dependente de homologação externa e 1 não testado**. A homologação completa de cartão no browser, Point, Wallet, e-mail real, exportações e as cinco instalações no navegador permanece pendente. Nenhuma afirmação local vale como homologação do Mercado Pago, PagBank, terminal ou SMTP.

## Ambiente e proteção dos dados

- Todos os usuários, filmes, sessões, pedidos, produtos e contas dos ensaios são sintéticos. O navegador usa Chromium pelo Playwright; `scripts/e2e-dev-server.js` cria fixture por execução.
- `npm run test:e2e:postgres` inicia PostgreSQL 16 local em Docker com armazenamento `tmpfs`, cria banco exclusivo marcado, verifica nome/role/instância/token antes das migrations, importa a fixture e remove banco e contêiner ao sair. `node scripts/with-isolated-postgres.js e2e` executa o mesmo fluxo no serviço descartável verificado do CI. Os testes de rejeição do alvo indevido estão em [local-disposable-postgres-guard.test.mjs](../tests/local-disposable-postgres-guard.test.mjs).
- `npm run test:e2e` mantém JSON somente para compatibilidade. As operações financeiras e webhooks dos testes usam simulação; não houve cobranças nem estornos externos.
- A primeira execução da bateria PostgreSQL 16 em paralelo ao browser perdeu um worker de concorrência no Windows antes do sinal `ready` (código `3221226505`). O resultado foi descartado. Após encerrar o browser, o mesmo comando passou isoladamente; os contêineres de teste remanescentes foram verificados por marcador, nome, imagem e montagem antes da remoção.

## Defeitos corrigidos e commits

| Commit | Resultado |
| --- | --- |
| `ef4532d` | Limpeza dos campos sensíveis e do modo de cadastro após logout; teste de reprodução no navegador. |
| `943e7f9` | Testes de Pix pendente, atualização da página, falha de consulta e isolamento do ingresso/pedido entre clientes. |
| `ec1d53c` | Teste de operador restrito no painel e recusas 403 por HTTP. |
| `5575881` | Registro técnico de edição/cancelamento de sessão após commit PostgreSQL; E2E antes falhava e depois passou. |
| `f0fab41` | E2E PostgreSQL protegido, fixture Admin explícita e reutilização da sessão de apoio para respeitar o rate limit real. |
| `5dd6830` | Testes que provam a rejeição de URL operacional herdada e de banco sem marcador. |

Detalhes, gravidade, reprodução e riscos estão em [bugs e correções](FASE23_1_BUGS_E_CORRECOES.md). Não foram alterados contratos financeiros, HMAC, migrações, permissões ou limites de rate.

## Validação executada

| Comando | Resultado local |
| --- | --- |
| `npm run test:characterization` | Passou (43/43 após incluir os testes do harness). |
| `npm run test:unit` | Passou; casos condicionais a PostgreSQL sem alvo descartável foram ignorados e cobertos nas baterias protegidas. |
| `npm run test:security:local` | Passou. |
| `npm run test:finance` | Passou (54/54). |
| `npm run test:modularization:finance` | Passou (30/30). |
| `npm run test:maintenance` | Passou (11/11). |
| `npm run test:legacy:json` | Passou. |
| `npm run test:deployment` | Passou (7/7). |
| `npm run test:multi-cinema:synthetic` | Passou (5/5). |
| `npm run test:desktop` | Passou. |
| `npm run lint`, `npm run build`, `npm run docs:check` | Passaram; mapa com links locais íntegros. |
| `npm run test:e2e` | Passou (22/22 em Chromium/JSON). |
| `npm run test:e2e:postgres` | Passou (22/22 em Chromium/PostgreSQL 16 descartável). |
| `node scripts/with-local-disposable-postgres.js smoke concurrency repositories guard` | Passou após repetição isolada (PostgreSQL 16). |
| `node --test tests/local-disposable-postgres-guard.test.mjs` | Passou (4/4). |
| `node scripts/with-local-disposable-postgres.js --pg18 smoke concurrency repositories guard` | Passou (PostgreSQL 18). |
| `node scripts/with-local-disposable-postgres.js backup-restore` | Passou (backup e restauração sintéticos). |
| `node scripts/with-local-disposable-postgres.js --pg18 upgrade` | Passou (upgrade guardado em PostgreSQL 18). |

### Bateria final PostgreSQL e CI

Os workflows no **SHA final** devem ser conferidos após a publicação da branch; o resultado do CI fica registrado na entrega da fase. Não reutilizar o verde da branch de origem como validação deste código. O workflow de navegador agora executa JSON e PostgreSQL 16 com serviço descartável verificado; o workflow de integração executa PostgreSQL 16 e 18.

## Limitações observadas

- O E2E em modo Next `dev` registra aviso de `eval()` bloqueado pela CSP e aviso de `scroll-behavior`; os 22 testes concluíram sem falha de navegador atribuída a esses avisos. A CSP de produção não foi inferida a partir do modo de desenvolvimento.
- O envio de e-mail da fixture não tem canal externo configurado; o backend registrou `WEBHOOK_NOT_CONFIGURED`. O teste usa token sintético retornado no modo de testes para a recuperação, sem comprovar entrega real.
- Os testes financeiros com provedores simulados demonstram invariantes locais, não aceitação por Mercado Pago, PagBank ou terminal. O [mapa transacional](architecture/FINANCIAL_TRANSACTION_MAP.md) e a [cobertura avançada](architecture/FASE22_COBERTURA_FINANCEIRA_AVANCADA.md) continuam delimitando os ramos sem prova externa.
- A bateria multi cinema sintética não substitui jornada visual por instalação nem garante identidade/upload/URL em cada ambiente.
- A prontidão técnica local não altera os bloqueios de implantação da [Fase 13](FASE13_PREFLIGHT_OPERACIONAL.md) nem autoriza o Portão B/D. A release antiga da VPS não foi usada como evidência desta branch.

## Prioridades objetivas para 23.2

1. Automatizar a jornada visual do formulário de cartão com SDK simulado, sem credenciais reais, e os estados recusado/inconclusivo.
2. Cobrir 2FA, expiração de sessão, editor completo de filme/sala, PDF/exports e foco de teclado no browser.
3. Executar jornadas sintéticas independentes para cada uma das cinco instalações, incluindo marca, URLs, pedidos, estoque e arquivos.
4. Preparar homologações externas por portão específico, com cinema, ambiente, operações, limites e reversão definidos; manter a decisão operacional separada da técnica.
