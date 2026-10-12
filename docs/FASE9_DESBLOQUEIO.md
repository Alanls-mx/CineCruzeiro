# Fase 9 - intencao Point, estornos e restauracao

Registro tecnico da branch `codex/modularize-server-admin`. A [Fase 8](FASE8_HOMOLOGACAO.md) permanece como linha de base historica. Esta fase nao autoriza deploy, merge, contato com terminal Point, pagamento/reembolso real ou banco operacional. O codigo e a fonte definitiva; resultados e decisoes no fim deste documento so podem ser promovidos depois do CI no HEAD final.

## Cobranca Point

`POST /api/box-office/sales`, `POST /api/tickets/manual` e `POST /api/admin/concession-counter-sales` compartilham a preparacao em [server.js](../backend/server.js). No PostgreSQL, Point exige `clientRequestId` valido; ausencia ou formato invalido retorna 422 antes do provedor. A mesma identidade com valor, composicao, terminal ou conta do provedor divergente retorna 409. A referencia, o identificador local do pagamento e a chave idempotente incluem a instalacao configurada, sem marca fixa no modulo compartilhado.

O primeiro commit grava pedido, pagamento pendente, referencia, valor, moeda, terminal, fingerprint da conta, requisicao de recuperacao e estado `prepared`. Outro commit reivindica a tentativa com lease persistido; outro grava `sending` e instante pre-envio. Somente entao [cardTerminalProvider](../backend/services/cardTerminalProvider.js) cria a Order fora da transacao. O resultado conhecido e persistido antes de liberar direitos. Timeout ou perda da resposta mantem `unknown`; retry pela mesma identidade so ocorre depois do lease e reutiliza a chave original. O provedor documenta [a chave idempotente e o reuso da Order](https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/migrate-payment-intent-to-orders), mas o banco e o provedor nao formam uma transacao atomica.

`GET /api/box-office/point-payments/:id` retoma tentativa sem Order ID pela mesma chave, ou consulta [Order conhecida por ID](https://www.mercadopago.com.br/developers/pt/reference/in-person-payments/point/orders/get-order/get). Referencia, valor, terminal e estado local sao conferidos antes da sincronizacao. Divergencia e aprovacao tardia apos encerramento local exigem conciliacao humana, nao emissao ou estorno automatico. A implementacao nao possui uma busca Point comprovada por `external_reference` sem Order ID; uma chave antiga sem intencao local nao se torna recuperavel por esta alteracao.

Para cobranca anterior sem vinculo: pausar novas tentativas, registrar incidente financeiro com cinema, terminal, operador, horario, valor, referencias e evidencia do provedor (sem dados de cartao), verificar o historico local e do terminal por pessoal autorizado e nunca associar por mera coincidencia de horario/valor. Nenhum retry com chave nova ou importacao automatica. Confirmacao, compensacao ou estorno dependem de decisao humana auditada.

## Estornos e direitos

O [smoke PostgreSQL](../scripts/smoke-tests.js) injeta falhas no commit de preparo e no commit final para ingresso, bomboniere parcial, resolucao de falha de impressao Point e cancelamento integral. Verifica chave persistida, retry, permissao financeira, ingresso, estoque e HTTP sem falso sucesso. As rotas POST de reembolso exigem sessao administrativa e `orders.refund`. No cancelamento integral, a preparacao mantem os ingressos fisicamente ativos, mas bloqueia sua validacao enquanto o reembolso esta pendente; cancelamento, devolucao de estoque/credito e invalidacao ocorrem somente no commit de confirmacao. Resultado inconclusivo permanece pendente com a mesma referencia.

Cobertura nao exaustiva: provedor e impressora sao simulados; nao ha garantia distribuida de exatamente uma execucao. Caminhos manuais de devolucao, PagBank, cancelamento Point no terminal e disputa real exigem homologacao dirigida. Uma reversao externa depois de uma aprovacao local demanda conciliacao, nao alteracao inferida de direitos.

## Backup e restauracao

`npm run test:postgres:backup-restore` executa [o ensaio](../scripts/postgres-backup-restore-test.js) somente com servidor PostgreSQL marcado como descartavel, role nao-superusuario com `CREATEDB` e duas bases novas `cinecruzeiro_test_<hex>` marcadas por tokens independentes. Rejeita `DATABASE_URL`, `POSTGRES_URL` ou `TEST_DATABASE_URL` herdados. Aplica migrations na origem, cria apenas fixtures `.invalid` de filmes, sessoes, salas, cliente, pedidos, pagamentos, ingresso, estoque, Clube, job de e-mail, campanha e intencao Point pendente. `pg_dump -Fc` omite dono/ACL e o marcador exclusivo; `pg_restore` usa banco de destino diferente e protegido. Invariantes de esquema, relacoes, estados e quantidades sao comparadas nos dois bancos. Nao inicia servidor, worker, envio, impressao ou provedor. Sem marcador valido, nao remove banco; nao usa `DROP DATABASE ... WITH (FORCE)`.

O CI usa PostgreSQL 16 em contêiner descartavel. O ensaio nao valida recuperacao de dados reais nem a defasagem entre backup e provedor. Antes de religar workers em uma futura restauracao autorizada, reconciliar pagamentos/estornos Point, ingressos, impressao, jobs e campanhas executados depois do instante do backup. Restaurar o banco nao desfaz cobrancas externas.

## Evidencias e decisao

| Area | Evidencia | Limite |
| --- | --- | --- |
| Criacao/retry Point | [smoke PG](../scripts/smoke-tests.js) com failpoints de preparacao, claim, resultado e timeout | Sem terminal real; reuso da chave depende do contrato do provedor. |
| Estornos | [smoke PG](../scripts/smoke-tests.js) com falhas de commit, permissoes e direitos | Matriz parcial; demais fornecedores e operacoes manuais nao homologados. |
| Backup/restauracao | [ensaio protegido](../scripts/postgres-backup-restore-test.js) e [workflow](../.github/workflows/postgres-integration.yml) | Confirmar execucao verde no HEAD final antes de classificar aprovado. |
| Cinco instalacoes | `test:multi-cinema:synthetic` | Fixtures nao substituem configuracoes e operacoes de cada cinema. |

O [workflow PostgreSQL `38202732573`](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/38202732573), no commit `cd81ba0`, registrou `BACKUP_RESTORE_OK`: PostgreSQL 16, arquivo custom de 164.048 bytes, dois bancos `cinecruzeiro_test_<hex>` com tokens separados, 50 migrations, 2 pedidos, 2 pagamentos e um exemplar verificado de ingresso, estoque, credito, job, campanha e intencao pendente. Ambos foram limpos apos verificacao do marcador. A primeira execucao falhou por JSON sintetico malformado; a segunda por assercao fixa de `>50` migrations quando o repositorio possuia exatamente 50. Ambas foram corrigidas sem remover invariantes. A execucao local sem `TEST_POSTGRES_ADMIN_URL` recusa iniciar; nao houve banco operacional.

Localmente, `test:unit`, `test:security:local` (25/25), `test:finance` (50/50), `test:legacy:json`, `test:e2e` (19/19), `lint`, `build`, `docs:check`, `docs:coverage`, `deploy:validate` e `test:multi-cinema:synthetic` (5/5) passaram nesta fase. `docs:coverage` apontou 196 arquivos, 1.877 declaracoes candidatas, 20 simbolos curados e 30 entradas de endpoint; esses numeros **nao** medem completude semantica. O smoke PostgreSQL e o restore rodam apenas no CI protegido, nao nesta maquina.

Commits financeiros/infraestrutura da fase: `46218ec`, `042e8c0`, `f72cc0c`, `084733f`, `7f9dbd6`, `cd81ba0`, `cb3d80a`, `2691f3c`, `de6c11f` e `1dd9107`. Falhas intermediarias do CI ficam visiveis no historico: auth/permissao de POST reembolso, fixture JSON, contagem de migration e failpoint de commit interceptado por worker de e-mail. Nenhum banco real, terminal, pagamento ou reembolso foi usado.

Decisao A (modularizacao): classificacao da Fase 8 mantida, **aprovada com ressalvas**. Decisao B (prontidao tecnica para solicitar homologacao): **bloqueada ate prova no HEAD final**, incluindo os tres workflows, disputa entre duas instancias independentes e matriz de estornos ainda parcial. O lock PostgreSQL e o retry idempotente estao implementados, mas a evidencia HTTP atual nao cobre todo o comportamento entre processos nem cada provedor. Decisao C (homologacao das cinco instalacoes): **bloqueada**, sem acesso ou autorizacao operacional nesta fase. A execucao sintética do restore nao representa plano de recuperacao operacional completo.
