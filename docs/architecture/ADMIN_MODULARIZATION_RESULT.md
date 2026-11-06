# Resultado da modularização do Admin

Branch `codex/cine-modularizacao-profunda`. Esta etapa altera somente o painel estático, seus testes e o mapa de arquitetura. O servidor continua responsável por autenticação, autorização, preços, confirmação de pagamento, emissão de direitos e persistência.

## Medição

Contagem física reproduzível: `node -e "const s=require('fs').readFileSync('backend/public/admin.js','utf8');console.log(s.split(/\r?\n/).length-(s.endsWith('\n')?1:0))"`. Inclui comentários e linhas vazias; nenhuma função foi minificada ou transferida para arquivo gerado.

| Marco | Linhas de `admin.js` | Módulos carregados antes do shell |
| --- | ---: | ---: |
| Linha de base da modularização profunda | 11.980 | 24 |
| Entrada desta etapa | 5.697 | 38 |
| Resultado desta etapa | 3.421 | 53 |

Redução nesta etapa: **2.276 linhas (40,0%)**. Redução acumulada desde a linha de base: **8.559 linhas (71,4%)**. O maior módulo novo é `integration-administration.js`, com 716 linhas; os demais novos têm menos de 300. `bindEvents` permanece no shell como único ponto que registra os binders, na mesma ordem da inicialização anterior.

## Donos das responsabilidades

| Responsabilidade e arquivos | Entrada, autoridade e persistência | Risco / verificação |
| --- | --- | --- |
| Lista, formulário, teste e simulador de integração: `integration-administration.js` | `GET/PUT/POST /api/admin/integrations/*`, inclusive simulações de webhook; owner/`integrations.manage` no backend; configuração em `settings` e histórico de simulações continuam sob os escritores existentes | Testar uma conexão pode ter efeito externo, somente após clique explícito. [Teste dirigido](../../tests/admin-final-extraction.test.mjs) e [E2E](../../e2e/admin-email-campaign.spec.js) |
| Clique delegado, shell e conta: `delegated-events.js`, `account-events.js`, `dashboard-and-overlay-events.js` | Reutilizam os comandos e a sessão do shell; logs, 2FA, pedidos e integrações continuam nas rotas e permissões existentes; nenhuma escrita no import | Ordem de clique, Escape, overlay, conta e 2FA; [composição](../../tests/admin-module-composition.test.mjs), [permissões](../../tests/admin-marketing-isolation.test.mjs) |
| Filmes, sessões, salas e poltronas: `catalog-and-room-events.js` | `POST/PUT/DELETE` de catálogo/sessões/salas continuam com `movies.manage`, `sessions.manage` e `rooms.manage` no backend; escritores `movieRepository`, `sessionRepository`, `roomRepository` | Sugestão manual, conflito, limpeza e formulário; [teste](../../tests/movie-session-suggestion-ui.test.mjs), [E2E](../../e2e/admin-session-actions.spec.js) |
| Bilheteria, ingressos, bomboniere e pagamentos visíveis: `sales-and-ticket-events.js` | Mesmos endpoints de venda, Point, pedidos, validação e catálogo comercial; backend mantém idempotência, transação, autorização e estoque | Removidos três listeners duplicados de filtros de vendas; um registro por controle é [testado](../../tests/admin-final-extraction.test.mjs). [E2E de bilheteria](../../e2e/admin-box-office-realtime.spec.js) |
| Campanhas, promoção, equipe, clientes e Clube: `marketing-events.js`, `administrative-record-events.js` | Mesmo `api` com cookies/CSRF; campanhas e usuários continuam sob os repositórios e permissões do servidor; o painel apenas atualiza estado após resposta | Nenhum envio no import ou render. [Teste de isolamento](../../tests/admin-marketing-isolation.test.mjs), [E2E de campanha](../../e2e/admin-email-campaign.spec.js) |
| Apresentações de 2FA, logs, mapa de sessão, insights de bomboniere, marketing e visibilidade RBAC: `two-factor-settings-view.js`, `admin-log-view.js`, `session-seat-detail-view.js`, `concession-insights-view.js`, `marketing-overview-view.js`, `admin-access-visibility.js` | Leitura do `state` injetado; RBAC visual não substitui autorização do backend; as leituras de dados continuam nos endpoints anteriores | Fábricas sem efeito no carregamento; [composição](../../tests/admin-module-composition.test.mjs), [visibilidade](../../tests/admin-marketing-isolation.test.mjs) |
| Selects responsivos: `responsive-select-controls.js` | DOM local; nenhum endpoint ou escrita persistente | Seletores são montados uma vez por `initAdmin`; ordem de scripts e CSP protegidas pelo [teste](../../tests/admin-module-composition.test.mjs) |

Os módulos publicam APIs congeladas em `CineAdminModules` e CommonJS para testes. Recebem referências ao estado, DOM, API e comandos por injeção; nenhum importa `admin.js`. `admin.html` carrega todos antes do shell e mantém `social-studio.js` depois. `initAdmin` continua single-flight. A bridge WebView2, câmera QR, impressão, estados Point e recuperação permanecem nos módulos especializados da etapa anterior; esta extração não muda seus payloads.

## Verificação e limites

- Testes dirigidos de composição, render de integração sem chamada ao provedor e listener único de vendas: aprovados. Lote `tests/admin-*.test.mjs`: **95 aprovados, 3 ignorados, 0 falhas**.
- Testes de catálogo, logs, ações de sessão e isolamento de campanhas foram atualizados para localizar o mesmo comportamento nos módulos novos, mantendo asserções.
- `npm run test:unit`: aprovado no estado final, sem falhas nos subcomandos encadeados.
- `npm run test:security:local`: **25/25** aprovados; scripts adicionais de imagem, assinatura de webhook e tempo real passaram.
- `npm run test:desktop`, `npm run lint`, `npm run build` e `npm run docs:check`: aprovados.
- `npm run test:e2e`: **19/19** aprovados no estado final.
- `node scripts/measure-modularization.mjs --summary`: confirmou **3.421** linhas de `admin.js`. Testes PostgreSQL descartáveis não foram executados nesta etapa, pois não houve mudança de servidor, persistência ou transação.

O shell conserva estado compartilhado, carregamento, transporte, navegação, integração legada `window.*`, inicialização de streams e coordenação de módulos. Os binders usam o ciclo único de `initAdmin`; timers de debounce continuam pertencendo ao ciclo da página, e os recursos QR/Point mantêm os encerramentos anteriores. Os testes locais não comprovam um provedor real, terminal ou homologação operacional. Não houve deploy, merge, migração, acesso à VPS ou operação financeira externa.
