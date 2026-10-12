# Operações assíncronas e limites de recuperação

## Ingressos por e-mail

Fonte: [finalizePaidOrder](../../backend/server.js), [migration 051](../../backend/db/migrations/051_ticket_email_jobs.sql), [repositório](../../backend/repositories/ticketEmailJobRepository.js), [worker](../../backend/services/ticketEmailWorker.js), [emailService](../../backend/services/emailService.js).

- Na confirmação do pedido, `ticketEmailRequested` só é marcado quando há e-mail, ingresso e entrega digital aplicável. O trigger cria `ticket_email_jobs` dentro da mesma transação de `orders`; rollback não deixa trabalho órfão. Pedidos anteriores à migration não são reenviados em massa.
- O worker PostgreSQL reivindica um job por vez com `FOR UPDATE SKIP LOCKED`, lease de dez minutos e heartbeat. Fica ativo no início do servidor e consulta novamente a cada cinco segundos. Jobs `processing` abandonados voltam a ser reivindicáveis após o lease.
- Antes de enviar, o worker relê o pedido e seus ingressos. Pedido ausente, não pago, sem ingresso/e-mail ou com entrega física é cancelado; `emailDeliveredAt` já gravado conclui sem novo envio. Falha temporária reprograma com backoff; após cinco tentativas, o job fica `dead` para inspeção. O reenvio manual continua disponível no endpoint existente.
- Se o provedor aceitar a mensagem e o processo cair **antes de persistir** `emailDeliveredAt`, uma retomada pode duplicar o e-mail. O provedor usado aqui não fornece confirmação transacional com o banco; logo a garantia é de *pelo menos uma tentativa recuperável*, não de exatamente um envio. Se a confirmação local já foi gravada mas a conclusão do job falhou, a retomada detecta `emailDeliveredAt` e não reenvia.
- O modo JSON mantém o agendamento em memória apenas para compatibilidade. Produção usa PostgreSQL. Não executar migrations em bancos operacionais durante testes.
- Diagnóstico: correlacione `ticket_email.job_completed`, `ticket_email.worker_failed` e `ticket_email.background_completed` nos logs, `orders.metadata.emailDeliveredAt` e o estado de `ticket_email_jobs`. Investigue jobs `dead` antes de qualquer reprocessamento manual.
- Reversão: interromper o worker no código sem apagar a tabela mantém jobs para retomada. Remover trigger/tabela perderia pendências; só considerar após drenagem e backup, em operação planejada separada. Não há migration destrutiva de rollback automático.

Testes: [worker](../../tests/ticket-email-worker.test.mjs), [commit/rollback PostgreSQL](../../tests/database-persistence-postgres.test.mjs), [smoke](../../scripts/smoke-tests.js).

## Campanhas do Social Studio

Fonte: [orquestrador](../../backend/services/social-studio/automation/orchestrator.js), [repositório](../../backend/repositories/socialStudioAutomationRepository.js).

- A recuperação varre campanhas `queued` e trabalhos `processing`/`qa` inativos há dez minutos, em páginas de 20, ordenadas por criação e ID. Cada página é drenada antes da próxima; o processo mantém no máximo dois trabalhos simultâneos **por instância**.
- `claim` é condicional no PostgreSQL e impede que duas instâncias reivindiquem a mesma campanha ao mesmo tempo. Heartbeat atualiza o registro durante renderizações longas. Um timer de um minuto descobre trabalhos que ficaram elegíveis depois da inicialização; chamadas concorrentes de recuperação não iniciam varreduras paralelas na mesma instância.
- Atualizações de etapa e estado terminal exigem o número da tentativa reivindicada. Após expiração e novo claim, a instância antiga não pode gravar `ready` ou `failed` sobre a nova. O heartbeat também informa perda do claim. A operação de renderização já em curso não pode ser cancelada atomicamente; seus arquivos externos ainda precisam de observação/deduplicação.
- Falha de renderização conclui a campanha como `failed`, preservando a ação explícita de reprocessar. Um crash antes de marcar `ready` pode repetir geração de arquivos após o lease; o resultado persistido continua identificado pela campanha. Verificar o efeito externo de upload ao investigar duplicações.
- O armazenamento JSON de compatibilidade ainda limita histórico a 100 campanhas; backlog superior a 100 é validado para PostgreSQL. O teste unitário exercita 125 registros sem memória ilimitada.

Testes: [automação](../../tests/social-studio-automation.test.mjs), [isolamento pós-commit](../../tests/database-persistence-postgres.test.mjs).

## Intenção Point e recuperação após restauração

Fonte: rotas de bilheteria e consulta em [server.js](../../backend/server.js), [cardTerminalProvider](../../backend/services/cardTerminalProvider.js), `orders`/`payments` em [PostgreSQL](../../backend/db/postgresStore.js). `payments.metadata` guarda chave idempotente, referência, fingerprint do pedido, terminal, hash da conta do provedor, estado da criação e lease. O pedido pendente e o pagamento são confirmados antes do POST externo; `prepared` não autoriza impressão, ingresso nem produto. `sending`/`unknown` após envio requer consulta com Order ID ou retry **da mesma chave**, após o lease. Erro definitivo ou divergência deve permanecer em revisão humana. A aplicação não consulta Point por referência externa sem Order ID. Ver [transações](transactions.md) e [procedimento da Fase 9](../FASE9_DESBLOQUEIO.md).

O [smoke PostgreSQL](../../scripts/smoke-tests.js) inicia uma [segunda instância Node](../../scripts/point-smoke-second-instance.js) no mesmo banco descartável. Duas consultas simultâneas da intenção devem produzir uma única chamada simulada ao provedor, registrada fora da memória dos servidores. Isso valida a disputa local entre processos, não a idempotência de um terminal real nem uma transação distribuída.

Após restore, não religar automaticamente workers nem repetir uma cobrança Point com nova referência. Compare o snapshot com o provedor para pagamentos e reembolsos que ocorreram após o backup; confirme estados de `ticket_email_jobs`, campanhas, ingressos e estoque antes de retomar. O [ensaio protegido](../../scripts/postgres-backup-restore-test.js) só valida dados sintéticos e não executa a recuperação operacional.

## Pre-homologacao e incidentes

O [caderno da Fase 10](../FASE10_CADERNO_PILOTO.md) separa teste interno, sandbox e operacao assistida, com ficha de autorizacao, paradas e roteiro por incidente. O diagnostico Wallet **nao** e read-only: pode alterar classe externa. Para Point incerto, refund pendente, job/e-mail ou campanha interrompida, preservar IDs e estados, pausar somente a operacao afetada e escalar ao responsavel designado; nao reexecutar efeitos externos com identidade nova. O backup sintetico nao substitui plano de restauracao e conciliacao por cinema. Nenhuma dessas instrucoes autoriza acesso a recurso operacional.

O [relatorio da Fase 11](../FASE11_HOMOLOGACAO_PILOTO.md) registra Cine Cruzeiro como piloto escolhido, evidencia interna e bloqueios. A [ficha de sandbox](../FASE11_AUTORIZACAO_SANDBOX.md) exige conta de teste, operacoes, limite, callback isolado, responsavel e parada antes de qualquer contato com o Mercado Pago. A escolha do piloto por si so nao autoriza teste externo nem implantacao.

## Instalacao existente e startup da Fase 12

A [auditoria read-only](../FASE12_AUDITORIA_VPS.md) confirmou a release `ea7c5df` na VPS, PostgreSQL 18.6 com migrations ate 050 e dois processos PM2 exclusivos no usuario `ubuntu`, sobre Nginx/PM2 compartilhados. O backend da candidata inicia worker de ingresso e retomada periodica do Studio; [migration 051](../../backend/db/migrations/051_ticket_email_jobs.sql) deve preceder seu startup. A [migration 052](../../backend/db/migrations/052_point_payment_methods.sql) amplia o CHECK de metodo Point. Nao iniciar backend candidato em paralelo contra o banco existente. O [plano futuro](../FASE12_PLANO_ATUALIZACAO.md) exige inventario de pendencias, pausa de escritas/efeitos externos especifica ao Cine Cruzeiro, backup verificavel, migracao autorizada e conciliacao antes de retomar trabalhadores. O deploy script atual nao fornece sozinho esse portao; nenhuma atualizacao ocorreu na Fase 12.
