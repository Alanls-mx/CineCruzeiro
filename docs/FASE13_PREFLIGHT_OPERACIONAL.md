# Fase 13 - preflight operacional (Portao A)

**Somente preparacao. Portao B nao autorizado.** Base historica: [auditoria](FASE12_AUDITORIA_VPS.md) e [plano](FASE12_PLANO_ATUALIZACAO.md) da Fase 12. O codigo da branch e a fonte para comportamento de startup e deploy; este registro nao concede acesso a dados de negocio nem muda a instalacao.

## Identidade e isolamento

| Item | Evidencia / limite |
| --- | --- |
| Instalacao | Desenvolvimento Cine Cruzeiro em `https://lumixengine.com/projects/cinecruzeiro`; `current` observado na Fase 12 em `releases/20261010-041635-ea7c5df`, manifesto de `ea7c5df24cf44d64516d00d81585cb2b0f7efe09`. Reconfirmar na janela futura. |
| Codigo, processos e arquivos | Raiz `/home/ubuntu/projects/cinecruzeiro`, `shared/uploads`, PM2 `cinecruzeiro-frontend` (3100) e `cinecruzeiro-backend` (4100). Nginx, PM2, PostgreSQL e dominio sao compartilhados. Quatro outros cinemas estao habilitados no registro **real** da VPS; nao usar o exemplo local como inventario. |
| Banco e role | Consulta somente de metadados autorizada em 12/10/2026: fingerprints SHA-256 truncados do nome do banco e role `e599e94bf4eb` (coincidencia de nomes nesta instalacao); role dono do banco, nao-superusuario, sem `CREATEDB`, `CREATEROLE`, replicacao ou `BYPASSRLS`. Comparacao em memoria com as quatro entradas habilitadas: 4/4 configuracoes legiveis, nenhuma colisao de nome de banco ou role. **Ressalva critica:** `has_database_privilege` indica `CONNECT` e `TEMP` em seis outros bancos nao-template; o role nao e dono e nao possui `CREATE` nesses bancos, mas a impossibilidade de escritas em tabelas alheias nao foi provada. Nenhuma conexao aos outros bancos foi feita. URL, nomes e senhas nao foram impressos. |
| Esquema instalado | Metadados da Fase 12: PostgreSQL 18.6, 48 arquivos aplicados ate `050_room_cleanup_minutes.sql`, sem `ticket_email_jobs`; `051`/`052` pendentes. Reconfirmar o conjunto/hashes antes de qualquer migracao. Nenhum dado de cliente foi consultado. |
| Espaco | Leitura `df`/`du` em 12/10/2026: particao raiz 28 GB, 18 GB usados, 11 GB disponiveis; release antiga ~699 MB (node_modules ~589 MB, `.next` ~70 MB), uploads ~106 MB, diretorio de backups antigos ~25 MB. Tamanho de arquivo **nao** prova integridade/restaurabilidade; nao e orcamento da release nova, dump, WAL/temporarios e reserva de rollback. Reconfirmar antes da janela. |
| Rotas e headers | `HEAD` publico retornou 200 no prefixo. CSP `frame-ancestors 'none'`; resposta inclui `X-Frame-Options: DENY` **e** `SAMEORIGIN` e headers de politica repetidos. Investigar dono de cada cabecalho antes de qualquer mudanca; nao recarregar Nginx compartilhado neste portao. |

## Achados que bloqueiam a atualizacao

1. O role e o banco tem identificadores proprios, mas o role ainda pode **conectar** a seis outros bancos. O executor futuro precisa validar a identidade exata (`current_database`, `current_user`, alvo do URL e ownership) imediatamente antes do DDL, e o operador deve revisar privilegios cruzados em procedimento separado. Sem prova de que erro de configuracao nao alcanca outros bancos/tabelas, **isolamento de migracao bloqueado**. Nao alterar grants sem autorizacao especifica.
2. [Deploy multi-instalacao](../scripts/deploy-all-vps.mjs) agora exige `--only` e SHA completo; para `cinecruzeiro`, a execucao efetiva e recusada por `CINECRUZEIRO_DEPLOY_GATE_PENDING`. Seu fluxo antigo ainda migraria com backend ativo, nao validaria restore, ligaria workers automaticamente e poderia limpar releases. **Nao usar esse script para Portao B.** O teste de selecao usa fixtures locais; nao foi executado na VPS.
3. [Startup](../backend/server.js) chama manutencao de assinaturas/imagens/anexos, retoma campanhas Studio e inicia workers de campanha e ingresso. `readDb()` inicial tambem configura CRM; GETs como consulta Point podem reconciliar estado. Nao existe pausa unica demonstrada para HTTP, WebSocket, jobs, callbacks e efeitos externos. **Portao D bloqueado.** Parar o processo antigo e iniciar o novo sem gate nao equivale a pausa segura.
4. Contagens/estados de pedidos, Point, refunds, estoque, creditos, jobs e campanhas **nao foram lidos**. E necessaria autorizacao especifica para o inventario minimo descrito no [runbook](FASE13_RUNBOOK_EXECUCAO.md); nao fazer retry externo como diagnostico.
5. Dumps anteriores nao tiveram restauracao demonstrada. O [ensaio sintetico](TESTES_POSTGRESQL.md) valida apenas fixture; nenhum backup novo ou restore de dados operacionais foi autorizado. A existencia de `.e2e-data` na release precisa de classificacao antes de qualquer limpeza.
6. O ensaio 050->051->052 passou no PostgreSQL 18 descartavel no commit `3e2df6f`, com sonda executavel da release `ea7c5df` antes/depois da mudanca (`readiness` e catalogo), backup/restore sintetico e regressao PG16. A variante 18 verifica lista/conteudo das 48 migrations antigas, rollback, trigger sem backfill, CHECK Point e idempotencia. O teste adicional de contencao/`lock_timeout` de 052 esta preparado para o **SHA final**; seu CI deve ser conferido na ficha. Readiness/catalogo nao comprovam todos os caminhos financeiros da release antiga, e nenhum teste pequeno mede tempo de DDL sob carga operacional.

## Decisoes independentes

| Portao | Estado do Portao A | Condicao para avancar |
| --- | --- | --- |
| A - isolamento | **Bloqueado para migracao/deploy** apesar de banco e role proprios: `CONNECT` em seis outros bancos e nenhum executor com assert de identidade no DDL | Revisar privilegios cruzados sem afetar terceiros; executor futuro deve falhar se banco/role/owner/URL divergir, com prova em fixture. Reconfirmar `current`, rotas e arquivos na janela. |
| B - candidata | **Pendente** do SHA final e CI completo | Fixar SHA, build/base path, regressao e artefatos. |
| C - PostgreSQL 18/migrations | **Aprovado com ressalvas** na evidencia intermediaria: 050->051->052, rollback, trigger, constraint, runner idempotente, old-code readiness/catalogo e restore sintetico; CI do SHA final pendente | Confirmar CI final e teste de lock; ampliar rollback antigo aos fluxos financeiros necessarios, medir impacto de 052 sob carga representativa e definir parada operacional. |
| D - workers/efeitos | **Bloqueado** | Pausa especifica, testada em inicio, HTTP, WebSocket, recovery e integracoes; conciliacao humana. |
| E - backup/restore | **Procedimento preparado; ensaio sintetico PG16/18 executado; backup remoto novo nao autorizado, backup real nao realizado, restore real nao comprovado** | Novo backup completo e restore em destino isolado com autorizacao propria. |
| F - solicitar atualizacao | **Bloqueado** | Todos os portoes tecnicos e operacionais, responsaveis, janela e ficha assinada. |
| G - atualizacao | **Nao executada** | Nova instrucao explicita do responsavel. |

Ver [matriz](FASE13_MATRIZ_ATUALIZACAO.md), [runbook](FASE13_RUNBOOK_EXECUCAO.md) e [ficha](FASE13_AUTORIZACAO_ATUALIZACAO.md). Nenhuma migration, backup, reinicio, deploy, pagamento ou leitura de negocio ocorreu na VPS nesta fase.
