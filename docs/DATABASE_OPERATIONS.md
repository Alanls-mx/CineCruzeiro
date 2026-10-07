# Banco de dados: desempenho e capacidade

## Persistencia

Os repositorios direcionados continuam sendo o caminho preferencial para novos endpoints.
A camada de compatibilidade agora calcula diferencas por entidade e por chave de configuracao:
nao apaga/reinsere o banco inteiro. IDs, reservas, consentimentos e itens de pedidos sem alteracao
sao preservados. Auditoria e incremental, sem apagar o historico.

Leituras rastreadas guardam fingerprints. Gravar um registro alterado desde a leitura retorna
409 (`DATABASE_CONCURRENT_CHANGE`); o cliente deve recarregar os dados antes de tentar novamente.
Alteracoes em registros independentes podem ser mescladas. Importacao integral exige
`importSnapshot: true`, reservado aos scripts de importacao e testes.

Transacoes de repositorio adquirem um lock compartilhado de compatibilidade. A camada antiga
adquire o lock exclusivo desde o inicio. Nao converter uma transacao compartilhada em exclusiva.
As consultas de snapshot fora de transacao usam `REPEATABLE READ READ ONLY`, evitando combinar
partes de estados diferentes. Falhas de consulta ou auditoria abortam a operacao, em vez de
transformar tabelas indisponiveis em listas vazias.

## Leituras e cache

- Requisicoes operacionais nao carregam o historico completo de auditoria.
- Cache de snapshot por processo, com coalescencia de consultas simultaneas e copias isoladas.
- Invalidacao local apos commit e entre processos por `LISTEN/NOTIFY` (migracao 039).
- Resultado antigo em voo nao pode repopular cache depois de uma invalidacao.
- Se a conexao de notificacoes cair, leituras deixam de reutilizar o cache ate reconectar.
- O payload publico nao inclui anexos/modelos internos de e-mail.

O snapshot operacional ainda carrega varias colecoes. Esta rodada remove a regravacao destrutiva,
mas nao transforma todos os endpoints em consultas paginadas: migrar os fluxos restantes por
dominio, acompanhando volume real e planos de consulta.

## Limites por processo

| Variavel | Padrao | Faixa aceita |
| --- | ---: | ---: |
| POSTGRES_POOL_MAX | 6 | 2-30 |
| POSTGRES_CONNECT_TIMEOUT_MS | 3000 | 500-15000 |
| POSTGRES_IDLE_TIMEOUT_MS | 30000 | 1000-120000 |
| POSTGRES_STATEMENT_TIMEOUT_MS | 15000 | 1000-120000 |
| POSTGRES_LOCK_TIMEOUT_MS | 3000 | 250-15000 |
| POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS | 60000 | 5000-180000 |
| POSTGRES_SNAPSHOT_CACHE_TTL_MS | 30000 | 2000-60000 |

Existe uma conexao adicional de notificacao por backend. Erros em conexoes ociosas sao tratados
sem encerrar abruptamente o processo. Os timeouts sao aplicados nas conexoes da aplicacao,
nao alteram globalmente os limites de migracoes, backup ou outros sistemas.

## Regras para escalamento

1. Somar `instancias * (pool + 1)` de TODOS os cinemas, mais n8n, workers e outros clientes.
   Manter esse total abaixo de 70% de `max_connections`, reservando capacidade operacional.
2. Investigar p95 HTTP interno acima de 200 ms por 5 minutos, espera no pool persistente,
   lock wait acima de 250 ms e event loop p95 acima de 50 ms. Sao metas de investigacao,
   nao promessa de latencia para renderizacoes ou integracoes externas.
3. Se houver espera no pool com CPU/IO folgados, ajustar uma conexao por vez, respeitando
   o orcamento global e repetindo a medicao. Nao aumentar `max_connections` indiscriminadamente.
4. CPU sustentada acima de 75%, memoria acima de 80%, swap recorrente ou disco acima de 80%
   pedem investigacao de consultas, retencao e capacidade antes de mais workers.
5. Escalar horizontalmente somente com cache invalidado entre processos, fila idempotente e
   budget de conexoes. Renderizacao e chamadas externas devem ficar fora das transacoes.
6. PgBouncer pode ser avaliado quando o numero de processos crescer. A conexao LISTEN deve
   permanecer direta ou usar session pooling; nao usar transaction pooling para essa conexao.

Estas regras nao contratam recursos nem mudam a VPS automaticamente.

## Diagnostico e verificacao

Com o ambiente correto carregado, `npm run db:diagnostics` faz somente consultas de leitura.
Retorna ocupacao, locks, transacoes ociosas, maiores tabelas, estimativas de tuplas mortas,
autovacuum e orcamento de conexoes. Nao imprime credenciais, consultas de usuarios ou conteudo
de pedidos. Os limites calculados sao teoricos e exigem descontar os outros servicos.

O endpoint administrativo `GET /api/admin/logs/performance` inclui pool (total, idle, waiting)
e cache (hits, misses, invalidacoes, p95 de carregamento e estado das notificacoes).

Executar `npm run test:database` para testes de diff, conflitos, cache e limites.
Com `TEST_DATABASE_URL` apontando EXCLUSIVAMENTE para banco descartavel, esse comando tambem
testa persistencia, rollback de auditoria e notificacao entre conexoes. `npm run test:postgres`
substitui dados de teste e valida concorrencia de ingressos, estoque, pagamentos e clube.
Nunca apontar os testes para producao.

Antes de deploy: backup verificado, migracoes e testes isolados. Depois: comparar contagens,
readiness, erros, memoria e latencias; medir cache frio e aquecido separadamente. Usar
`EXPLAIN (ANALYZE, BUFFERS)` apenas em consultas de leitura e com janela controlada.
Nao executar `VACUUM FULL`, apagar auditoria ou reindexar indiscriminadamente em horario ativo.
