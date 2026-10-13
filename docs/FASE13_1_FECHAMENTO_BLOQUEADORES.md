# Fase 13.1 - fechamento dos bloqueadores

**Sem deploy, migration remota, leitura operacional, backup real, mudanca de grants ou reinicio.** Base: branch `codex/modularize-server-admin`, SHA inicial `a08dc319ec9bd108833ba44f94bee872abbb4899`. O SHA final e o resultado dos workflows devem ser conferidos na branch antes de promover um artefato; este relatorio nao concede Portao B. Ver [matriz tecnica](FASE13_1_MATRIZ_ISOLAMENTO_PAUSA.md), [preflight](FASE13_PREFLIGHT_OPERACIONAL.md), [runbook](FASE13_RUNBOOK_EXECUCAO.md), [autorizacao](FASE13_AUTORIZACAO_ATUALIZACAO.md).

## A - alvo de migrations

O runner generico criava `schema_migrations` antes de verificar o banco. Agora ele recusa o slug ou fingerprint do Cine Cruzeiro antes de qualquer DDL; o modo `--guarded-pilot` exige manifesto restrito e verifica, **na mesma conexao/transacao de 051/052**, URL, nome/fingerprint do DB e role, `session_user`, origem TCP, dono do DB e tabelas, privilegio CREATE, release SHA, hashes dos arquivos, 48 entradas aplicadas e estado exato do esquema. Lock e timeout sao locais a essa transacao; falha anterior ao COMMIT reverte as duas migrations e seus marcadores. Falha de rede durante COMMIT e classificada como **resultado incerto** e exige inspecao, nunca repeticao automatica. `deploy-all-vps.mjs` segue fechado para o piloto. Outros cinemas continuam no runner comum, com slug explicitado pelo deploy.

O fingerprint de 12 hex (`e599e94bf4eb`) veio de metadados da Fase 13. Nomes completos, URL, origem efetiva, ownership de `orders/payments/schema_migrations` e hashes do artefato **na VPS nao foram reconfirmados** nesta fase. Isso pode causar recusa legitima futura; nao relaxar a verificacao para vencer a recusa. Manifesto de autorizacao nao deve ser versionado nem conter senha. Estrutura exigida: `instance`, `database`, `role`, `expectedRelease`, `candidateSha`, `origin: {host,port,serverAddress,serverPort}`, `applied` (001-050), `pending` (051/052), `hashes` SHA-256 de cada SQL. Host/porta da URL e endereco/porta observados no servidor sao pares diferentes em Docker/NAT; ambos sao verificados. O `DATABASE_URL` e `release-info.json.commit` do processo devem corresponder exatamente. O runner nao procura outro banco nem atualiza historico se a assercao falhar. O role ainda tem CONNECT/TEMP em seis DBs alheios; isso nao demonstra direito de alterar tabelas, mas exige revisao de minimo privilegio separada. Nenhum grant sera revogado automaticamente.

Teste dirigido: `test:postgres-safety` cobre binding e URL; `test:postgres:guard` cria dois bancos marcados com o mesmo esquema 050 e verifica recusa por alvo/role/instalacao/origem/SHA/historico/arquivos, repeticao e ausência de alteracao, alem de sucesso atomico 051/052 somente no alvo autorizado. O segundo banco e removido apenas apos conferir marcador de teste. Docker local indisponivel; o resultado PG16/18 precisa do CI no SHA final. A aprovacao tecnica A depende desse resultado e do confronto autorizado da origem/owners/fingerprint reais; nao e autorizacao de DDL.

## D - pausa e transicao

`backend/start.js` exige `CINE_INSTANCE_SLUG=cinecruzeiro`, `CINE_OPERATION_MODE=quiescent|normal` e `CINE_EXPECTED_SHA` igual ao manifesto da release. Em `quiescent`, carrega apenas `maintenanceServer.js`, sem `server.js`, DB, servico de assentos ou workers; expõe `GET/HEAD /api/health/maintenance` e responde 503 `no-store`/`Retry-After` para todas as demais rotas, inclusive GET Point, admin, pagamentos e callbacks. Upgrades WS recebem 503. Invocar `server.js` diretamente com modo quiescente falha antes dos imports. Duas instancias do modo fechado foram ensaiadas com URL de DB deliberadamente invalida. Isso evita falso sucesso de webhook; **nao** garante retentativa do provedor sem verificacao especifica.

A release antiga `ea7c5df` nao usa esse entrypoint. Em sua inicializacao, `readDb` configura CRM/Discord e `server.listen` inicia manutencoes, Social Studio, campanha, e-mail de ingresso, log e CRM outbox. GET Point pode criar/consultar no provedor e conciliar estado. WS pode adquirir/liberar holds. SIGTERM para alguns workers e fecha o listener, mas o timeout de 10 s pode interromper efeito externo in-flight; nao existe medicao de transacoes abertas nem dreno por rota. O modo novo **nao** pausa o antigo. Para a transicao sera preciso mecanismo de proxy limitado ao prefixo, drenagem de HTTP/WS e workers da release velha, tratamento de webhooks e estados financeiros inconclusivos, todos ensaiados antes de alterar Nginx/PM2. O modo `normal` atual reabre rotas e workers simultaneamente: retomada por categoria ainda nao foi implementada. Assim, **D permanece bloqueado**. Nao usar o entrypoint fechado como prova de que 503 pode durar indefinidamente.

## Compatibilidade de retorno

O ensaio PG18 preserva 001-050 identicas ao commit `ea7c5df`, aplica 051/052 em fixture, prova rollback SQL, trigger sem backfill, CHECK Point, lock timeout e sonda da release antiga antes/depois. O probe apos 052 agora inclui login de cliente sintetico e leitura HTTP de ingresso vinculado a pedido pago. Isso cobre leitura de direito, nao criacao de cobranca. As operacoes abaixo continuam classificadas:

| Operacao antiga no esquema 052 | Estado |
| --- | --- |
| Startup, readiness, catalogo | Compativel no ensaio sintetico anterior; revalidar SHA final. |
| Login e leitura de ingresso pago | Ensaio adicionado; CI PG18 pendente. |
| Trigger de job 051, CHECK de metodo 052, preservacao de pedido/pagamento | Compatibilidade estrutural em fixture; nao equivale a rollback financeiro. |
| Pix/cartao criados pela release antiga, webhook, cancelamento/refund, bilheteria/Point, estoque, Clube, concorrencia e recovery legada | **Nao executado** contra a release antiga; sem conclusao de compatibilidade. Nao chamar rollback apenas de codigo de seguro. |

Se o retorno do codigo antigo nao passar os fluxos financeiros requeridos, a alternativa depende de backup operacional novo, restauração ensaiada e conciliacao de efeitos externos ocorridos apos o snapshot, sob autorizacao especifica. Um restore de DB nao desfaz pagamento, estorno, e-mail, Wallet, impressao ou publicacao.

## Validacao e decisoes

| Portao | Estado nesta fase |
| --- | --- |
| A isolamento | Implementado no codigo; **pendente** do CI PG16/18 e confronto autorizado com metadados reais. CONNECT cruzado permanece risco residual. |
| B candidata | Pendente de SHA final, CI e artefato fixado. Nao avancar automaticamente. |
| C PostgreSQL 18 | Evidencia sintética anterior preservada; novos testes no CI final pendentes. Lock em carga real nao medido. |
| D pausa | **Bloqueado**: entrypoint novo fechado testado, mas release antiga, dreno, callbacks e retomada gradual nao comprovados. |
| E backup | Backup novo/restauração operacional nao autorizados nem executados; fixture nao substitui. |
| F solicitar atualizacao | Bloqueado por D/E, inventario de estados, responsaveis/janela e ficha. |
| G atualizar VPS | **Nao executado.** |

Validacoes locais: `test:postgres-safety` (6), `test:maintenance` (3), `test:operations`, `test:unit`, `test:security:local`, `lint`, `build`, `docs:check`, `docs:coverage`, `test:deployment`, `test:legacy:json`, `test:multi-cinema:synthetic` e E2E browser (19/19) passaram. O Docker local nao iniciou, portanto `test:postgres:guard` e o probe PG18 dependem do CI. No primeiro CI desta fase (`41be274`), Security e Browser passaram, mas PostgreSQL 16/18 falhou em um teste novo que nao rejeitava `instance` divergente na funcao interna; a verificacao foi corrigida em `6755d4d`. Revalidar PostgreSQL 16/18 e os demais workflows no SHA final; o verde anterior nao e transferivel automaticamente. Nenhum desses testes comprova isolamento, backup ou pausa na VPS.
