# Fase 23.2 — resiliência financeira e recuperação

Branch: `codex/cine-homologacao-fase23`, derivada de `e883e459d7fa2f42d73ca4210f4949f154082f26`. A Fase 23.1 continua sendo a linha de base funcional. Esta etapa não altera assinatura de webhook, máquina de estados financeira, esquema, permissões ou contratos HTTP.

## Decisão e ambiente

Testes executados somente no workspace local com SDKs substituídos por adaptadores Playwright, `PAYMENTS_MODE=test` e PostgreSQL criado pelo guard `with-local-disposable-postgres.js` (contêiner `tmpfs`, marcador aleatório e banco exclusivo). A suíte E2E JSON usa arquivo temporário criado pelo harness, não o `backend/data/db.json`. Os serviços de e-mail não receberam canal externo. O spy do provedor conta invocações dos adaptadores simulados em arquivo temporário compartilhado pelas duas instâncias. Os mesmos IDs idempotentes atravessam os dois servidores. O estado financeiro foi conferido por SQL; o HTTP sozinho não foi usado como prova de commit.

## Cobertura nova

1. **Mercado Pago, cartão no navegador:** SDK bloqueado; token vazio; criação com resposta perdida; reload; clique repetido; tentativa de mudar para Pix enquanto há resultado incerto; retry com a chave original; webhook Order assinado; duplicata; ingresso emitido uma vez somente após confirmação. O teste inicialmente demonstrou o defeito de chave nova no segundo clique. A correção e sua limitação estão em [bugs e correções](FASE23_2_BUGS_E_CORRECOES.md).
2. **PagBank, cartão no navegador:** SDK bloqueado; erro da criptografia; formulário limpa PAN/CVV; envio do valor criptografado sem PAN/CVV na requisição; pedido pendente sem ingresso. A fixture alterna o provedor de modo restrito ao banco E2E e restaura Mercado Pago ao encerrar.
3. **Pix no navegador:** primeira resposta perdida depois de `201`, reload e retry `200` com a mesma chave e um único pedido/pagamento. Os testes prévios continuam verificando Pix pendente, erro de consulta, aprovação, recusa, webhook repetido e bloqueio de acesso de outro cliente.
4. **PagBank captura:** testes de serviço cobrem `AUTHORIZED → PAID` após captura e perda da resposta de captura. O estado fica `processing` até a consulta confirmar `PAID`; retries usam a mesma chave da captura. Isso é simulação do contrato HTTP do provedor, não homologação externa.
5. **Concorrência PostgreSQL:** dois processos Node independentes, mesmo banco descartável, disputam a mesma cobrança Pix, última poltrona, última unidade, o último crédito do Clube e o mesmo webhook assinado. O teste verifica `orders`, `payments`, `tickets`, `concession_inventory`, `subscription_credits`, `subscription_usage` e `webhook_events` por SQL e confirma uma única invocação simulada do provedor nas disputas de criação. O servidor secundário só inicia após validar `NODE_ENV=test`, `PAYMENTS_MODE=test` e o marcador do banco descartável.

Os resultados por cenário, inclusive HTTP, estado SQL, contagem e risco residual, estão na [matriz de falhas](FASE23_2_MATRIZ_FALHAS.md).

## Limites financeiros confirmados

- O checkout público ainda chama o provedor antes de persistir uma intenção local durável. A chave do navegador agora sobrevive a falhas de rede, mas não substitui uma intenção persistida para conciliar aceite externo seguido de falha de commit e fechamento do cliente. Esse ramo permanece **BLOQUEADO** para homologação financeira integral. Desenhar uma intenção transacional com identidade estável e recuperação autorizada em trabalho próprio antes de mover a ordem do efeito externo.
- O modo de teste dos provedores gera respostas locais sem chamar os provedores reais. Por isso token não vazio rejeitado pelo Mercado Pago, criptografia real do PagBank, liquidação, captura real, terminal Point e impressora física permanecem **DEPENDENTES DE HOMOLOGAÇÃO EXTERNA** em portão operacional próprio.
- Dois operadores disputando o mesmo refund e cancelamento concorrente com aprovação ainda não têm ensaio distribuído completo. Os failpoints locais existentes protegem rollback, repetição e identidade do refund, mas não provam esses ramos entre instâncias. Classificação **BLOQUEADO** para os cenários não cobertos, sem estender a reprovação automaticamente a todos os ramos de refund.
- A suíte PostgreSQL nova lança requisições simultâneas depois do sinal `ready` da segunda instância e observa o lock. A ordem de chegada dos requests pode variar. O teste separado de hold usa IPC; os demais cenários exigiriam instrumentação de barreira no ponto de entrada para uma interleaving totalmente determinada.
- A interface administrativa de Point e o caminho de impressão após reload foram mantidos com a cobertura anterior de smoke e testes de módulo; a jornada visual completa ainda merece E2E próprio. HTTP `202` continua inconclusivo.

## Testes e commits

| Comando | Resultado nesta revisão |
| --- | --- |
| `npm run test:e2e` | 29/29 aprovados em JSON descartável. A primeira execução detectou 429 causado pelo fixture; a execução posterior passou. |
| `npm run test:e2e:postgres` | 29/29 aprovados no PostgreSQL 16 descartável protegido. |
| `node scripts/with-local-disposable-postgres.js concurrency` | Aprovado com dois processos e consultas SQL. |
| `node scripts/with-local-disposable-postgres.js smoke concurrency repositories guard` | Aprovado no PostgreSQL 16: smoke financeiro, duas instâncias, 11 testes de repositório e guard de migration. |
| `node scripts/with-local-disposable-postgres.js --pg18 smoke concurrency repositories guard` | A primeira tentativa foi interrompida no smoke com código de processo Windows `3221226505`, sem asserção registrada. Na repetição, `smoke` isolado passou e `concurrency repositories guard` passou no PostgreSQL 18 descartável. O comando combinado original não foi reexecutado integralmente. |
| `node scripts/with-local-disposable-postgres.js backup-restore` | Aprovado no PostgreSQL 16 descartável; invariantes de migrations, pedidos, pagamentos, ingressos, estoque, créditos e jobs preservadas. |
| `node scripts/with-local-disposable-postgres.js --pg18 upgrade` | Aprovado: `PG18_UPGRADE_OK`, 50 migrations, 3 pedidos sintéticos. |
| `node --test tests/pagbank-integration.test.mjs` | 14/14 aprovados, inclusive dois novos testes de captura. |
| `npm run test:characterization` | Aprovado. |
| `npm run test:unit` | Aprovado; subtestes condicionais PostgreSQL foram ignorados no processo sem `TEST_DATABASE_URL` (3 em repositórios e 7 em campanhas, entre outros); não contados como aprovados. |
| `npm run test:security:local` | Primeira execução: 24/25, falha transitória no arquivo de estado público da poltrona; teste isolado 1/1 e segunda execução completa 25/25. |
| `npm run test:finance`, `npm run test:modularization:finance`, `npm run test:maintenance`, `npm run test:legacy:json` | Aprovados, cada comando executado separadamente. |
| `npm run lint`, `npm run build`, `npm run docs:check` | Aprovados após a última alteração de código. |

Commits desta etapa: `a401595` (identidade do cartão e E2E MP); `265badc` (E2E PagBank); `2c94d8d` (duas instâncias PostgreSQL); `f420a09` (fixture e Pix perdido); `5fce3d3` (erro Pix tratado); `612e1e1` (captura PagBank). O commit dos relatórios será registrado na entrega. Consulte os testes completos e os workflows no SHA final, sem reutilizar CI de commits anteriores.

## Próximas ações dirigidas

1. Projetar e caracterizar intenção financeira durável antes da chamada externa nos ramos Pix/cartão, incluindo crash após aceite do provedor e sem navegador presente. O contrato de reconciliação deve preservar as chaves atuais e jamais emitir ingresso por mera resposta HTTP.
2. Criar concorrência distribuída de refund integral/parcial e cancelamento versus aprovação, com spy compartilhado do efeito externo, failpoint de commit e verificação SQL de direitos/estoque.
3. Completar matriz PagBank em PostgreSQL para `AUTHORIZED`, `DECLINED`, `CANCELED` e `REFUNDED`, e E2E da administração Point e impressão após reload.
4. Solicitar portão de homologação externa específico antes de SDK/provedor/terminal reais. A bateria sintética desta fase não o autoriza.

Prontidão técnica e homologação operacional permanecem decisões separadas. Nenhum resultado desta fase autoriza deploy ou atualização da VPS.
