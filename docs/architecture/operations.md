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
- Falha de renderização conclui a campanha como `failed`, preservando a ação explícita de reprocessar. Um crash antes de marcar `ready` pode repetir geração de arquivos após o lease; o resultado persistido continua identificado pela campanha. Verificar o efeito externo de upload ao investigar duplicações.
- O armazenamento JSON de compatibilidade ainda limita histórico a 100 campanhas; backlog superior a 100 é validado para PostgreSQL. O teste unitário exercita 125 registros sem memória ilimitada.

Testes: [automação](../../tests/social-studio-automation.test.mjs), [isolamento pós-commit](../../tests/database-persistence-postgres.test.mjs).
