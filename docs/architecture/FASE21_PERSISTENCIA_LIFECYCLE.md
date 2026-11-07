# Fase 21 — persistência e lifecycle

Branch `codex/cine-backend-finalizacao`. Base desta etapa: `9f7cefb` (10.876 linhas em `backend/server.js`, 3.261 em `handleApi`). A meta de 3.000–5.000 linhas é indicativa e **não foi alcançada**. Nenhum banco operacional, VPS ou provedor real foi acessado; não houve migration, deploy ou merge.

## Inventário e extrações

| Área | Antes | Depois, contrato e risco |
| --- | --- | --- |
| Configuração do snapshot | `normalizeDb` aplicava defaults de nome/preço/moeda/canal, anúncio, imagens do Clube e eventos, 2FA e regras de distribuidor, além de higienizar URLs. | [snapshotSettingsNormalizer](../../backend/services/snapshotSettingsNormalizer.js) recebe identidade editorial da instalação e funções de validação. Mantém precedência de campos explícitos sobre defaults e as sete URLs normalizadas. Sem I/O no import. Risco: valores ausentes versus explícitos e URLs inválidas. |
| Filmes/sessões | Ordenação por `sortOrder`/título, slug, `workflowStatus`, metadados, tipos ativos, deduplicação de IDs e preços de sessão estavam em `normalizeDb`. | [snapshotMovieNormalizer](../../backend/services/snapshotMovieNormalizer.js) roda depois das configurações; mantém fallback de preços e ordem. A regra comercial final do checkout permanece no servidor/serviços existentes. Risco: preço visível divergente para sessão antiga. |
| Clube e direitos | Arrays de planos, assinaturas, créditos, ciclos, unidades, resgates, contabilidade, itens e documentos; `releaseExpiredReservations` durante normalização; imagem e ordenação de planos. | Mantidos em `normalizeDb`: a limpeza temporal durante uma leitura pode influenciar persistência e direitos. Exige caracterização de tempo, concorrência e snapshots antes de extração. |
| Marketing e bomboniere | Defaults de três produtos, promoção, anúncio, normalização de produto/anúncio; campanhas e integrações legadas. | Mantidos por ora. O filtro de anúncio WhatsApp, a relação `settings.integrations` e o fallback de campanha JSON/PG são compatibilidade ativa. |
| Conta Admin | Seed do owner, ambiente, hash de senha e preferência pelo e-mail configurado. | Mantido em `normalizeDb` por depender de identidade e política de autenticação. Nenhuma credencial foi consultada ou alterada nesta etapa. |
| Snapshot/lock | `readDb`, `writeDb`, fila JSON e `mutationContext` residiam em `server.js`. | [snapshotPersistenceRuntime](../../backend/services/snapshotPersistenceRuntime.js) possui essas quatro capacidades, com `normalizeDb`, auditoria, caminho JSON e operações PostgreSQL injetadas. Continua lendo → normalizando → rastreando baseline; escrita PostgreSQL ainda usa `writeDbToPostgres`, snapshot incremental e lock exclusivo; JSON ainda usa arquivo temporário, rename e fila serializada. `ticketEmailDeliveryCoordinator` recebe a mesma instância de `mutationContext`. Risco: alterar ordem de normalização ou perda do baseline causaria divergência transacional. |
| Agenda normal | O callback de `server.listen` criava intervalos de Studio, logs, assinaturas, imagens, anexos, CRM e Discord, além dos workers PG. | [backendRuntimeSchedule](../../backend/services/backendRuntimeSchedule.js) preserva a ordem de disparos e frequência, inicia uma vez e cancela todos os intervalos no fechamento. Recebe tarefas e workers por injeção; importação não inicia timers, banco ou provedor. `backend/start.js` em `quiescent` continua sem importar o servidor operacional. Risco: `stop()` não prova dreno de trabalho externo já iniciado. |

`requestContext` continua no servidor porque liga HTTP, auditoria, logs e respostas. `postgresStore` ainda possui seu próprio contexto de transação, snapshot cache, locks e invalidadores. HTTP, WebSocket, SSE e serviços de provedores não foram substituídos nem recompostos; a ordem de `handleApi`, guards, CSRF, origem, cookies, status e payloads permaneceu intacta. O fechamento de `server` agora cancela os timers da agenda e registra a parada do lifecycle também nos encerramentos não sinalizados. No sinal, a parada continua antes de `server.close`, com timeout existente de 10 s.

Commits incrementais desta etapa: `925054f` (caracterização JSON/PG), `a857581` (defaults de cinema e filmes), `f6e3d03` (contexto de persistência). A agenda e este relatório constituem um lote separado.

## Evidência de equivalência

A fixture sintética do [smoke](../../scripts/smoke-tests.js) verifica o mesmo nome/preço de cinema, slug/status/ordem do filme, tipos e preços de sessão no JSON legado e no PostgreSQL descartável. [Testes de normalização](../../tests/snapshot-normalization.test.mjs) cobrem defaults, valores explícitos, URLs, ordenação e deduplicação. [Testes de persistência](../../tests/snapshot-persistence-runtime.test.mjs) cobrem leitura rastreada, delegação PG, recusa de produção sem PG, serialização e recuperação da fila JSON, escrita por rename e limpeza do temporário. [Testes de agenda](../../tests/backend-runtime-schedule.test.mjs) cobrem import inerte, ordem, inicialização única, modo JSON sem workers PG, intervalos e parada. A [suite de manutenção](../../tests/system-logs-retention.test.mjs) acompanha o novo dono do intervalo de retenção, mantendo a mesma frequência.

Contagem reproduzível com `node scripts/measure-modularization.mjs --summary`: `server.js` **10.876 → 10.755** (−121, 1,11%); `handleApi` **3.261 → 3.261**. A meta inferior de 5.000 ainda dista **5.755 linhas**. Módulos novos são especializados: `snapshotSettingsNormalizer` 45 linhas, `snapshotMovieNormalizer` 30, `snapshotPersistenceRuntime` 67 e `backendRuntimeSchedule` 49. Nenhum bloco grande foi transferido para um agregador novo.

## Validação e limites

Os testes dirigidos passaram antes das suites amplas. O smoke JSON e o PostgreSQL descartável foram executados após a extração de persistência e novamente após a extração da agenda. O teste de upgrade usou somente um banco descartável PostgreSQL 18. Os resultados abaixo são locais nesta branch; não substituem CI do SHA final nem homologação operacional.

| Comando | Resultado no SHA final |
| --- | --- |
| `npm run test:legacy:json` | Aprovado; smoke com fixture sintética e encerramento `SERVER_CLOSE`. |
| `npm run test:maintenance` | 9/9 aprovados; agenda, startup quiescent e retenção de logs. |
| `npm run test:unit` | Concluído com código 0; há testes condicionais ignorados por ambiente dentro das suites. |
| `npm run test:security:local` | 25/25 aprovados, mais os scripts locais de imagem, assinatura Mercado Pago e poltronas. |
| `npm run test:finance` | 54/54 aprovados, sem provedor real. |
| `npm run lint`, `npm run build`, `npm run docs:check` | Aprovados; `docs:check` repetido após a edição deste relatório. |
| `npm run test:e2e` | 19/19 aprovados em servidor local isolado. |
| PostgreSQL descartável: smoke, concorrência, repositórios, guard, backup/restore, upgrade | Aprovados: smoke, concorrência, repositórios 11/11, `PG_GUARDED_MIGRATION_OK`, `BACKUP_RESTORE_OK` e `PG18_UPGRADE_OK` (50 migrations em banco sintético). |

`backend/start.js` em `quiescent` passa nos testes de recusa HTTP/WS sem banco ou workers. Isso **não** drena a release anterior, os requests/leases abertos ou um envio externo já aceito. A parada agora cancela gatilhos periódicos, mas não aguarda a conclusão de tarefas já disparadas; esse é um risco residual de lifecycle. Os bloqueios do Portão D e do Portão B na [Fase 13.1](../FASE13_1_FECHAMENTO_BLOQUEADORES.md) permanecem. `server.js` ainda contém coordenação financeira e a maior parte do dispatcher; a [matriz financeira](FASE21_EXTRACAO_FINANCEIRA.md) impede mover esses ramos sem cobertura adicional. Nenhum caminho legado foi removido apenas por ausência aparente de consumidores. Próximos lotes seguros exigem caracterizar os defaults temporais de Clube, o seed de conta Admin e a coordenação dos recursos HTTP/WS antes de mover seus donos.
