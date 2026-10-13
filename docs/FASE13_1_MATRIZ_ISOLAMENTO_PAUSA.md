# Fase 13.1 - matriz de isolamento e pausa

**Codigo e fixtures, nao autorizacao operacional.** O estado executado deve ser conferido no [relatorio](FASE13_1_FECHAMENTO_BLOQUEADORES.md). As quatro outras instalacoes nao receberam alteracao. O servidor antigo `ea7c5df` nao possui este entrypoint.

## Alvo do DDL

| Limite | Controle da candidata | Evidencia / lacuna |
| --- | --- | --- |
| Selecao | `db-migrate.js --guarded-pilot <manifesto restrito>`; o modo comum recusa slug `cinecruzeiro` ou fingerprint observado. `deploy-all-vps.mjs` continua recusando o piloto. | Teste unitario e `test:postgres:guard` em bancos marcados; nenhum runner remoto foi autorizado. Chamadas manuais de outros cinemas ao modo comum continuam fora deste guard. |
| Identidade independente | Prefixo SHA-256 de 12 hex do nome do banco **e** role (`e599e94bf4eb`), observado na Fase 13, fixado no codigo; manifesto fornece nomes completos, origem e SHA da release. | Reconfirmar o algoritmo/fingerprint por metadados autorizados antes de usar; nome/fingerprint nao atesta privilegios em objetos de outros bancos. |
| Conexao real | Na mesma conexao e transacao do DDL: `current_database`, `current_user`, `session_user`, endereco/porta do servidor, dono do banco, `public` e donos de `schema_migrations`, `orders`, `payments`. URL sem parametros e origem exata. | Origem TCP real, owners de objetos e URL de runtime nao foram confirmados na VPS. Diferenca bloqueia; nenhuma tentativa de outro banco. |
| Conteudo | SHA da candidata comparado com `release-info.json`, lista exata de arquivos/hashes, 48 migrations 001-050 aplicadas, somente 051/052 pendentes, trigger/tabela 051 ausentes e CHECK 052 antigo. | Manifesto de autorizacao deve ser criado fora do Git por operador designado; nao inferir de variaveis do backend. Schema com drift bloqueia. |
| Atomicidade | Lock transacional, `lock_timeout=5s`, `statement_timeout=60s`; 051+052 e marcadores de migration na mesma transacao; qualquer erro reverte ambos. | Ensaio PG16/18 mede fixture pequena, nao duracao/lock operacional. O runner legado mantem transacoes por arquivo para outros cinemas. |

## Entradas e efeitos na pausa

| Entrada | Dono / efeito no servidor normal | Modo `quiescent` da candidata | Lacuna para transicao antiga |
| --- | --- | --- | --- |
| HTTP publico, checkout, bilheteria, admin, uploads | `backend/server.js` / `handleApi`; PostgreSQL, arquivos, pagamento, bilhete, estoque, credito, configuracao | `backend/maintenanceServer.js` responde 503 `no-store`, `Retry-After`; nenhuma rota operacional e carregada | Frontend Next pode permanecer visivel, mas APIs antigas devem ser cortadas por rota e requests ativos drenados. |
| GETs com efeito (Point, diagnosticos, conciliacao) | `GET /api/box-office/point-payments/:id` pode reivindicar lease, consultar/criar no Point e atualizar `orders/payments/tickets`; logs de GET tambem podem gravar | Mesmo 503, sem excecao por verbo | Nenhuma allowlist de GET da release antiga foi provada. |
| Mercado Pago/PagBank e outros callbacks | Verificacao HMAC/token, deduplicacao `webhook_events`, consulta ao provedor e transicao financeira | 503 antes de parse/autenticacao; **nao** significa autenticado nem processado, forca retentativa quando provedor a oferece | Prazo/retry por provedor precisa ser confirmado; 503 permanente ou corte no proxy pode perder notificacao. Reconciliacao humana necessaria. |
| WebSocket poltronas | `seatRealtimeService` recebe `join_session`, `select_seat`, `release_seat`, `heartbeat`; `seat_holds`/estado | Upgrade rejeitado 503; servidor WS operacional nem e importado | Conexoes antigas nao sao encerradas pelo novo entrypoint; fechar/drain no backend antigo antes da troca. Holds expiram conforme regra existente. |
| Startup e logs | `readDb`, configuracao Discord/CRM, `runtimeLifecycle`, manutencoes, `appendSystemLogToPostgres` | `backend/start.js` exige cinema, modo e SHA; nao importa `server.js`; sonda nao acessa banco | Integridade em quiescencia cobre apenas artefato/identidade e listener. Validacao de esquema e estados requer procedimento separado autorizado. |
| Workers e recovery | `ticketEmailWorker`, `emailCampaignWorker`, Social Studio `resumePending`, manutencao de assinaturas/imagens/anexos, CRM outbox, logs e Discord | Nao criados. Reinicio quiescente conserva o bloqueio; dois processos nao compartilham estado | Jobs/leases em andamento na release antiga nao sao drenados por este codigo. Ativar modo normal inicia todos; retomada por categoria ainda nao existe. |
| Efeitos externos | Mercado Pago/Point/PagBank, SMTP, Wallet, Studio, impressao e webhooks CRM/Discord | Sem importacao de provedores ou chamadas de rede da aplicacao | Chamada antiga ja enviada pode concluir apos o corte. Backup/restauracao nao desfaz efeito externo. |

## Ensaios e limites

- `test:maintenance`: GET com efeito, POST, webhooks, WS, processo quiescente com URL de DB invalida, dois processos, configuracao/release incorretas. Nao cobre drenagem in-flight da release antiga, retry de provedor, leases ou liberacao gradual.
- `test:postgres:guard`: bancos descartaveis protegidos com esquema semelhante, alvo trocado apos preflight, role/nome/historico/arquivo/SHA/origem divergentes, tentativa repetida, ausencia de alteracao apos recusa, 051/052 atomicas. Executado no CI PG16/18; **nao** contra banco operacional.
- `test:postgres:upgrade`: PG18, versao antiga antes/depois de 051/052; readiness/catalogo e login/leitura de ingresso pago apos 052. Nao testa criacao/cancelamento/refund/Point com provedor da release antiga. Rollback somente de codigo continua condicionado a ensaio mais amplo e backup restaurado.
- Estado de grants cruzados: role proprio/dono do DB, sem superuser/CREATEDB/CREATEROLE, mas CONNECT/TEMP em seis outros DBs; CREATE DB negado. Nenhum grant foi alterado; consultar privilegios de objetos e proposta de minimo privilegio sob autorizacao separada.

## Sequencia futura, ainda bloqueada

1. Autorizar escopo, reconciliador e janela; aprovar filtro/proxy apenas para rota Cine Cruzeiro com ensaio sintético de requests, WS e 503 para webhooks. Nao recarregar Nginx compartilhado por inferencia.
2. Impedir novas entradas da release antiga, medir in-flight/leases/jobs, aguardar ou classificar efeitos externos incertos e encerrar somente processos Cine Cruzeiro. Se nao houver dreno observavel, STOP.
3. Backup novo/restauração em destino isolado autorizados; preparar manifesto restrito com DB/role/origem/SHA/hashes. Executar runner guardado somente apos verificar pausa e restore.
4. Iniciar `backend/start.js` em `quiescent` pelo PM2 exclusivo do piloto, validar sonda/artefato/esquema com instrumentos sem escrita. Nao mudar `CINE_OPERATION_MODE` por default.
5. A ativacao `normal` hoje inicia todos os workers e rotas de uma vez: **STOP** ate existir liberacao por categoria, reconciliacao de estados e prova dos retries de webhook. Nao chamar pagina HTTP 200 de retomada segura.
