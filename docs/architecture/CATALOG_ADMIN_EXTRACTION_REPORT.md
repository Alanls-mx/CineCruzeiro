# Extração de catálogo e administração não financeira

Branch `codex/cine-modularizacao-profunda`; base desta etapa `6afb875`. O mesmo `server.js` continua dono da composição, contexto da requisição, guard de sessão/permissão/CSRF/origem, ordem de rotas e fronteiras transacionais. As extrações não alteram métodos, caminhos, payloads, cookies ou mensagens. Não há migrations ou chamadas a provedores operacionais.

## Antes e depois

`node scripts/measure-modularization.mjs --summary` conta linhas físicas, incluindo linhas vazias e comentários.

| Arquivo | Antes | Depois | Diferença |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 17.135 | 16.517 | −618 |
| `backend/public/admin.js` | 11.980 | 11.980 | 0 |

| Novo módulo | Linhas | Responsabilidade removida de `server.js` |
| --- | ---: | --- |
| `movieWorkflowService.js` | 143 | Normalização, slug, publicação e validação de filme |
| `movieSessionInputService.js` | 124 | Entrada de sessão, calendário e criação em lote |
| `venueInputService.js` | 78 | Layout da sala, intervalo de limpeza e tipo de ingresso |
| `cinemaSettingsHandler.js` | 43 | Atualização de configurações e resposta após persistência |
| `adminUserWriteHandler.js` | 82 | Criação/edição de conta e proteção de dono |
| `catalogReadHandler.js` | 27 | Rotas públicas e administrativas de conteúdo |
| `adminOverviewHandler.js` | 56 | Rotas de dashboard e panorama de marketing |
| `adminCustomerHandler.js` | 10 | Rota de busca sanitizada de clientes |
| `commercialCatalogInputService.js` | 144 | Normalização de produtos, cupons e anúncios |
| `adminContentPresenter.js` | 43 | Visibilidade de dados administrativos por permissão |
| `tmdbLookupHandler.js` | 54 | Busca e detalhamento TMDB |

Os handlers existentes `movieCatalogHandler`, `venueConfigurationHandler`, `commercialCatalogHandler` e `adminLogsHandler` continuam responsáveis pelas rotas já extraídas. `adminDashboardService`, `adminCustomerSearchService`, `moviePublicationPolicy`, `sessionRoomConflictService`, `tmdbMovieMapper` e os repositórios continuam reutilizados. Os onze novos módulos não importam `server.js` e não iniciam trabalho ao serem importados. Cada rota movida é registrada no mesmo ponto de dispatch anterior; não há endpoint duplicado.

Arquivos existentes modificados nesta etapa: `backend/server.js`, `package.json`, os testes de caracterização de sessão e TMDB, e o mapa em `docs/architecture/`. Os quatro handlers preexistentes, repositórios, `admin.js` e `start.js` não precisaram de alteração.

## Limites e riscos preservados

- Mutações de filme, sessão, sala, ingresso, configuração, produto e usuário aguardam o mesmo repositório ou `writeDb` antes da resposta. Os guards e o wrapper transacional permanecem no dispatcher.
- `POST/PUT /api/users` preserva as regras de dono, e-mail e revogação de sessão. `DELETE /api/users/:id` fica no servidor: desvincula assinaturas, créditos e pedidos.
- `PUT /api/content` fica no servidor: edição em lote alcança preços, estoque e entidades usadas pelo checkout. `getContent(includePrivate)` ainda agrega pedidos, pagamentos, créditos e PII; `adminContentPresenter` apenas filtra a resposta conforme as permissões existentes.
- Rotas de pagamentos, Clube, bilheteria, reembolsos, webhooks, mapa de poltronas com comprador e relatórios de repasse não foram transferidas para handlers de catálogo. `adminDashboardService` continua calculando os indicadores financeiros; `adminOverviewHandler` só registra suas leituras.
- O TMDB é um provedor externo usado sob demanda por rota já autenticada. A extração não adiciona consulta durante importação nem nos testes; o teste do handler injeta resposta sintética.

## Verificação

`npm run test:modularization:catalog` incorpora os dez testes dirigidos novos ao `test:unit`. Passaram: `test:catalog-operations` (15 aprovados, 1 ignorado sem `TEST_DATABASE_URL`), `test:unit`, `test:security:local`, `lint`, `build`, `docs:check` e `test:e2e` (19/19). Os testes de sessão, sala, permissões, cliente, conteúdo público e catálogo comercial também passaram diretamente antes dos commits correspondentes. `node scripts/with-local-disposable-postgres.js smoke` passou; o mesmo harness em modo `repositories` passou 11/11 testes. Cada execução criou um banco sintético e removeu o contêiner local marcado ao final. Nenhum banco operacional foi acessado.

O objetivo global de `server.js` com 3.000–5.000 linhas continua aberto. A próxima extração deve caracterizar separadamente cada rota com dados financeiros ou pessoais antes de movê-la. A aprovação técnica local não equivale à homologação operacional de uma instalação.
