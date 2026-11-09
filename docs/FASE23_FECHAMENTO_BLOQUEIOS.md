# Fase 23 — fechamento dos bloqueios financeiros e operacionais

**Decisão atual: NO-GO para troca da release na VPS.** Este registro sucede o relatório de encerramento anterior; não altera retrospectivamente o SHA nem a evidência da candidata antiga. A branch de trabalho permanece `codex/cine-homologacao-fase23`. Nenhum banco operacional, provedor real ou processo da VPS foi acessado nesta etapa. O ensaio manual externo permanece **dispensado, não executado**.

Commits de implementação desta continuação: `1c7f447` (intenção antes da chamada externa e recuperação por callback) e `0fc5ce3` (concorrência distribuída de checkout/reembolso). O SHA deste próprio relatório deve ser consultado no HEAD publicado da branch; os resultados de CI serão associados a esse SHA, não ao relatório anterior.

## Implementação verificada localmente

| Frente | Evidência | Limite |
| --- | --- | --- |
| Intenção Pix/cartão | [Fronteiras de commit](architecture/ONLINE_CHECKOUT_INTENT.md); smoke PG confirma o pedido antes da chamada externa e agora recupera via consulta simulada por referência/ID, sem navegador ou callback. Duas instâncias disputam um claim de reconciliação. | PagBank sem Order ID vai para revisão; nenhuma consulta real foi executada. A release instalada não tem o novo reconciliador. |
| Retry entre servidores | Duas instâncias sobre PostgreSQL descartável compartilham claim e chave; resposta perdida em uma instância, retry 202 na outra, uma chamada sintética e nenhum ingresso. | Simulador não comprova deduplicação do provedor real. |
| Callback antecipado | Cancelamento assinado durante o POST ao provedor não é rebaixado pela resposta pendente tardia; retorna 409 e não expõe QR nem envia ingresso. | Outros eventos fora de ordem ainda dependem de cobertura dirigida. |
| Reembolso integral concorrente | [Dois operadores e dois processos](architecture/FASE23_REEMBOLSO_CONCORRENTE.md) reutilizam uma identidade e terminam com um ingresso reembolsado. | O adaptador pode ser invocado mais de uma vez com a mesma chave; reembolso parcial e corrida cancelamento/aprovação não têm prova distribuída completa. |
| Corte e callbacks | [Plano de dreno](FASE23_CORTE_CALLBACKS.md); ensaio sintético de proxy preserva nove classes Cine e os cinemas vizinhos. | Release antiga sem dreno observável; `quiescent` devolve 503 a callbacks; modo normal inicia workers juntos. |

## Testes locais concluídos

Passaram: smoke financeiro e concorrência de duas instâncias em PostgreSQL 16 e 18, repositórios, guard e backup/restore nos dois ambientes, upgrade protegido PG18, E2E JSON 29/29, E2E PostgreSQL 29/29, `test:characterization`, `test:unit`, `test:security:local`, `test:finance`, `test:modularization:finance`, `test:maintenance`, `test:legacy:json`, `test:deployment`, `test:multi-cinema:synthetic`, `test:phase13:proxy`, `lint`, `build` e `docs:check`. Estes resultados referem-se ao código local durante esta etapa; os workflows no SHA final precisam ser conferidos após publicação. Uma execução PG18 em lote foi interrompida em repositórios pelo código nativo Windows `3221226505`, sem asserção; a repetição isolada de repositórios, guard, upgrade e backup/restore passou. Esse encerramento intermitente não foi classificado como teste aprovado. Uma execução do smoke após adicionar o caso de commit final atingiu o rate limit por excesso de compras sintéticas no mesmo IP; a fixture passou a usar um IP sintético próprio e o smoke PG16 voltou a passar, sem mudar o limite operacional.

## Bloqueadores objetivos para GO

1. PagBank sem Order ID não possui consulta automática confiável; manter revisão controlada. A nova consulta Mercado Pago por referência e a consulta por ID conhecido têm prova apenas sintética, sem validação externa manual (dispensada). Não fazer novo POST apenas para descobrir o resultado.
2. Prova distribuída de reembolso parcial e de cancelamento concorrente com aprovação tardia, mantendo direitos e estoque até confirmação. O teste atual comprova identidade local do estorno integral, não exatamente um efeito externo real.
3. Dreno verificável da **release instalada**, incluindo requests, WS, workers, Point, impressão, leases e efeitos externos inconclusivos; callback durável ou recuperação demonstrada; retomada gradual por categoria. O teste de proxy não satisfaz essas condições.
4. Preflight remoto atual, janela/responsável/limites/reversão, backup novo e restore isolado, conferência de schema e isolamento dos outros quatro cinemas. Nenhuma dessas ações foi realizada nesta etapa.

Quando os bloqueadores forem resolvidos, fixar novo SHA, executar toda a CI sobre ele e só então reavaliar o GO/NO-GO. A autorização anterior de desenvolvimento e a dispensa do ensaio manual não substituem a ficha operacional de corte.
