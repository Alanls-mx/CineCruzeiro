# Fase 22.5 — auditoria e estabilização arquitetural

**Branch:** `codex/cine-backend-desacoplamento`. **Base auditada:** `4d951fa06a98069da84d1352aff0ae71b3311985` (working tree limpo no início; nenhum commit posterior no remoto naquele momento). **Correção isolada:** `3cfed065d03cce448c897f58d5bd9137494b90e4`. O SHA final do commit documental consta na entrega e deve ser conferido com `git rev-parse HEAD`, pois um commit não pode conter seu próprio hash. Nenhuma mudança em `main`, VPS, bancos operacionais ou provedores reais.

## Decisão

**CONCLUÍDA COM RESSALVAS.** As responsabilidades extraídas nas Fases 21/22 têm donos e testes dirigidos; a redução numérica de `server.js` não é mais critério. A falha reproduzida do agendador foi corrigida. A cobertura financeira permanece parcial por ramo, e homologação externa e prontidão operacional são decisões separadas. Não há evidência nesta fase de regressão crítica introduzida pelas extrações nos cenários executados; isso não prova ausência de defeitos fora deles.

## Arquitetura examinada

O [Mapa Inteligente](architecture/README.md) liga domínios, entradas, módulos, escritores e fluxos. `backend/start.js` valida instalação, modo e SHA; o modo `quiescent` carrega apenas `maintenanceServer.js`. O modo normal carrega `server.js`, que conserva contexto de requisição, guards, precedência de rotas, composição e resposta após commit. Handlers em `backend/services/` recebem serviços e repositórios por dependências injetadas; `backend/repositories/` e `backend/db/` mantêm persistência e transações. `backend/public/admin.js` compõe o shell e liga eventos, com funções de domínio nos 53 arquivos `admin-modules/`. O [resultado 22.4](architecture/FASE22_RESULTADO_22_4.md) delimita as últimas extrações financeiras e de prévia comercial; esta fase não as ampliou.

Medição reproduzível: `node scripts/measure-modularization.mjs --summary` (linhas físicas, incluindo vazias e comentários). Na base, `server.js` tinha **10.220 linhas**, `handleApi` **3.167**, `admin.js` **3.421**. Depois da correção de lifecycle, são **10.223**, **3.167** e **3.421**, respectivamente. O aumento de três linhas no servidor é a injeção de telemetria de falha, sem extração artificial. O módulo do agendador permanece pequeno e coeso. `admin.css`, `social-studio.js`, `postgresStore.js`, `paymentService.js` e o próprio dispatcher ainda são arquivos grandes; tamanho isolado não justificou nova refatoração.

## Achados, gravidade e alterações

| Achado | Gravidade e evidência | Decisão |
| --- | --- | --- |
| Varreduras de imagens/anexos podem rejeitar após erro de banco/arquivo; o agendador descartava suas Promises. Erro síncrono também interrompia `start`. | **P1** de estabilidade. Um teste novo falhou antes da correção ao lançar na manutenção de imagem; depois cobriu falha síncrona, rejeição e ticks posteriores. | `backendRuntimeSchedule` observa as falhas das tarefas e as repassa ao `logEvent` como `runtime.schedule_task_failed`; mantém ordem, períodos, guarda PostgreSQL e timers. Falha ao iniciar workers ainda propaga. Nenhuma rota, tabela ou permissão mudou. [Dono e risco](architecture/modules.md). |
| `system-logs-retention.test.mjs` exigia a grafia antiga do callback do intervalo, embora o comportamento estivesse preservado. | **P2** de testabilidade, revelado pela correção P1. | Substituído por teste funcional de primeiro disparo e repetição em seis horas; a exigência de retenção e configuração permanece. |
| Varredura estática de `require` literal encontrou 21 caminhos cíclicos em Social Studio. | **P2 potencial**, sem falha reproduzida. A inspeção das arestas apontadas mostrou `require` tardio dentro das funções em vez de dependência mútua de inicialização; testes de Studio existentes cobrem carregamento. | Sem reestruturação especulativa. Medir falha concreta de import/execução antes de alterar esses contratos visuais. Não foi encontrado import de `server.js` por serviços, repositórios ou DB. |
| Fallbacks de marca e variantes de normalização ainda aparecem em código compartilhado. | **P2 potencial** multi cinema. O [mapa 22.2](architecture/FASE22_RESULTADO_22_2.md) já registrou o risco; não há divergência reproduzida nesta auditoria. | Mantidos; futuras alterações exigem comparação por instalação. |

Não se encontrou motivo demonstrado para alterar contratos HTTP, autorizações, migrações, `admin.js`, provedores ou limites financeiros. A auditoria estática não certifica ausência global de duplicação ou efeitos de importação; o escopo confirmado é o dos módulos inspecionados e testes executados.

## Segurança financeira e consistência

Os guards de sessão, origem, CSRF e permissão permanecem no dispatcher; a correção do agendador não toca em rotas. A [matriz avançada](architecture/FASE22_COBERTURA_FINANCEIRA_AVANCADA.md) e [transações](architecture/transactions.md) identificam intenção, commit, chamada externa, retry e reconhecimento de direitos por ramo. Os testes financeiros locais e o smoke PostgreSQL com provedores simulados verificam os ramos cobertos, incluindo resposta de webhook após commit, rollback/retry, hold, estoque e Point. Isto não equivale a homologação do Mercado Pago, PagBank ou terminal físico. Permanecem sem prova integral: corrida de duas instâncias HTTP pelo mesmo checkout, captura `AUTHORIZED` do cartão PagBank, perda de resposta externa por provedor, reembolsos por item com dois operadores, último crédito Clube entre processos e todas as transições fora de ordem. Nenhum fluxo financeiro foi extraído nesta fase; esses ramos continuam protegidos contra refatoração ampla.

O PostgreSQL normal, o JSON de compatibilidade, `normalizeDb`, snapshots, leases e locks não foram modificados. Os ensaios descartáveis usam contêiner local `tmpfs`, marcador aleatório, role limitado e guard que recusa `DATABASE_URL`, `POSTGRES_URL` e URLs de teste herdadas. O smoke e os testes de concorrência/backup cobrem invariantes sintéticas; não demonstram reconciliação com provedor ou restauração operacional.

## Lifecycle e desempenho

O agendador inicia uma vez, é parado no fechamento/sinal e cancela intervalos. Os testes verificam modo `quiescent` sem banco/workers e a observação de falhas periódicas. `stop()` **não drena** tarefas externas já iniciadas; e-mail/CRM/Studio/Point mantêm políticas próprias de lease/recuperação. Esta limitação e o corte da release antiga seguem no [bloqueador da Fase 13.1](FASE13_1_FECHAMENTO_BLOQUEADORES.md). Não interpretar a correção como autorização de implantação.

Não houve benchmark comparável antes/depois nem regressão mensurável de latência ou memória atribuída a um módulo. Logs de smoke sob carga local não representam perfil de produção. Por isso não se alterou SQL, cache, índices, timers ou processamento por hipótese de desempenho. Medição de event loop, memória e latência por rota, com fixture/volume controlados e repetição, é a próxima evidência necessária para otimização.

## Validação e limites

| Conjunto | Resultado local |
| --- | --- |
| Teste dirigido do agendador, manutenção e quiescent | 11/11 passaram após a correção. Uma execução concorrente de `test:maintenance` falhou sem detalhe de asserção para `maintenance-startup`; o arquivo isolado e a suíte inteira repetida passaram. Não foi classificada como regressão reproduzida. |
| `test:characterization` | 41/41 passaram. |
| `test:unit` | Código 0; 53 casos no último resumo, 46 aprovados e 7 ignorados por condição de ambiente em subgrupo. |
| `test:security:local`, `test:finance`, `test:modularization:finance` | 25/25, 54/54, 30/30 no resumo principal; verificações auxiliares de segurança passaram. |
| `test:deployment`, `test:multi-cinema:synthetic`, `lint`, `docs:modularization:report` | Código 0; 7/7 e 5/5 nos testes sintéticos. |
| PostgreSQL 16/18 descartável: smoke, concurrency, repositories, guard; backup-restore e PG18 upgrade | Os quatro grupos passaram nas duas versões; `PG_GUARDED_MIGRATION_OK`, `BACKUP_RESTORE_OK` em PG16 e `PG18_UPGRADE_OK` (50 migrations). O primeiro backup PG18 terminou com código de processo Windows `3221226505` sem detalhe; a repetição isolada passou com `BACKUP_RESTORE_OK`. Causa da primeira saída não determinada. |
| `test:legacy:json`, `build`, `test:e2e`, `docs:check` | Código 0; smoke JSON isolado aprovado, build concluído, E2E **19/19**, mapa com 52 documentos e links locais existentes. O mock E2E registrou `WEBHOOK_NOT_CONFIGURED` para e-mail, aviso esperado sem provedor configurado. |

O workflow do SHA final deve ser conferido separadamente para Security regression, Browser E2E e PostgreSQL integration 16/18. Aprovação de commits anteriores não é herdada. A [cobertura do mapa](architecture/modularization-coverage.json) orienta candidatos; não prova completude semântica.

## Próximas prioridades

1. Completar a matriz de falha parcial por ramo financeiro indicada em [22.3](architecture/FASE22_RESULTADO_22_3.md) antes de qualquer nova extração crítica.
2. Ensaiar dreno de HTTP/WS e trabalhos em curso, com estado de lease, antes de reconsiderar o Portão D operacional.
3. Medir desempenho com carga e volume controlados antes de otimizar SQL ou memória.
4. Ao criar funcionalidades, seguir o dono em [domains](architecture/domains.md), conferir escritores em [persistence](architecture/persistence.md), guards e limites em [transactions](architecture/transactions.md), e acrescentar teste de contrato para a rota afetada.

**Prontidão arquitetural:** suficiente para evolução com ressalvas documentadas. **Estabilidade demonstrada:** restrita aos cenários da validação local e CI deste SHA. **Homologação financeira externa:** pendente. **Prontidão operacional/implantação:** não concedida pela Fase 22.5.
