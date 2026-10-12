# Fase 10 - caderno de pre-homologacao do piloto

Este roteiro e preparatorio. **Nenhum passo abaixo autoriza deploy, SSH, banco existente, terminal, cobranca, reembolso, e-mail externo ou publicacao.** O [relatorio](FASE10_PRE_HOMOLOGACAO.md) distingue evidencia interna de homologacao operacional. A fonte dos endpoints, permissoes e transacoes e o [Mapa Inteligente](architecture/README.md), sujeito a conferencia no codigo antes da execucao.

## Portao de autorizacao

| Nivel | Permitido nesta fase | Condicao para avancar |
| --- | --- | --- |
| A - interno | Codigo, fixtures `.invalid`, provedores simulados, browser E2E, PostgreSQL descartavel com marcador, relatorios | Nunca reutilizar URL, dados ou credenciais operacionais. |
| B - sandbox externo | **Nao executado** | Autorizacao escrita para cinema, aplicacao/ambiente, credenciais de teste por canal seguro, operacoes, responsavel, janela, limite financeiro, parada, reversao e evidencia. |
| C - operacional assistido | **Nao executado** | Nova autorizacao especifica por cinema/recurso; plano de rollback e backup aprovados, conciliador identificado, janela e limite de transacao. |

Ficha a preencher antes de B ou C: `cinema`, `ambiente`, `responsavel`, `operador/observador`, `versao SHA`, `servicos`, `operacoes`, `contas de teste`, `valor maximo`, `janela`, `backup verificado`, `criterio de parada`, `procedimento de reversao`, `local de evidencias sem PII`. Uma ficha incompleta bloqueia a acao. Credenciais nunca entram no Git, neste documento ou em logs. O Cine Cruzeiro e **candidato** a piloto, nao uma autorizacao implicita.

## Preparacao do piloto

1. Confirmar com o responsavel que o piloto sera Cine Cruzeiro; definir uma instalacao de teste separada da operacional, com dominio/rota, porta, processos, diretoria, configuracao, credenciais e PostgreSQL exclusivos. Registrar a identidade de cada recurso sem registrar os segredos.
2. Usar apenas um PostgreSQL local/container descartavel com `cine_test_server_marker`, role dedicado nao-superusuario, `TEST_POSTGRES_ADMIN_URL` e `CINE_TEST_SERVER_TOKEN` validos; o [harness](TESTES_POSTGRESQL.md) cria os bancos e descarta somente os seus marcados. Nao apontar `DATABASE_URL`/`POSTGRES_URL` de uma instalacao para um teste destrutivo.
3. Aplicar migrations e fixtures somente pelo harness; montar filme, sessao, sala, limpeza, tipo de ingresso, cliente `.invalid`, produto/estoque, plano/credito e intencao Point simulados. Validar que a rota publica exibe somente o catalogo da fixture e que o mapa de assentos usa a sala configurada.
4. Usar sessao administrativa de teste com 2FA e permissoes minimas por tarefa. Provedores ficam simulados; nao salvar Access Token, Service Account ou SMTP operacional. Verificar rede de saida e URLs antes de qualquer teste de integracao.
5. Guardar SHA, comandos, horario, logs sanitizados, saidas de teste e responsavel. Encerrar processos, confirmar ausencia de jobs ativos e limpar exclusivamente recursos com marcadores validos. Falha de limpeza exige intervencao humana, nao exclusao forcada.

Nesta estacao o Docker daemon nao estava acessivel e os marcadores do harness nao estavam configurados; a preparacao local completa **nao foi executada**. O workflow PostgreSQL usa seu proprio conteiner protegido e nao cria uma instalacao piloto permanente.

## Matriz funcional interna

`I` = teste interno/simulado; `B` = sandbox externo; `C` = instalacao/servico operacional. Os testes citados demonstram apenas os cenarios que de fato afirmam, nao todas as variacoes da linha. Para cada execucao futura, anotar resultado, SHA, evidencia, operador, horario e bloqueio na ficha do portao.

| ID | Objetivo e pre-condicao sintetica | Procedimento / resultado esperado | Evidencia interna inicial | Pendente fora de I |
| --- | --- | --- | --- | --- |
| F01 | Filme novo, edicao, publicacao e ocultacao | Usar API/painel sinteticos; publico nao lista filme oculto | [publicacao](../tests/movie-publication-policy.test.mjs), [catalogo](../tests/movie-catalog-handler.test.mjs) | C: curadoria e catalogo real |
| F02 | Sessao, sala, capacidade, limpeza, preco e virada de dia | Criar sobreposicao e limite; conflito recusado, hora comercial coerente | [conflitos](../tests/session-room-conflict.test.mjs), [agenda](../e2e/admin-session-actions.spec.js), [timezone](../scripts/session-timezone-tests.js) | C: sala e horario fisicos |
| F03 | Poltrona e hold em checkout | Ultima vaga concorrente, expiracao e retorno; nunca dupla emissao | [smoke PG](../scripts/smoke-tests.js), [assentos](../tests/session-seat-availability.test.mjs), [E2E](../e2e/checkout-payment.spec.js) | C: pagamento/retorno real |
| F04 | Pix/cartao simulados e webhook assinado | Aprovar, recusar, atrasar, repetir; pedido/ingresso seguem status autenticado | [smoke PG](../scripts/smoke-tests.js), [webhook](../scripts/mercado-pago-webhook-tests.js), [metadados](../tests/mercado-pago-order-metadata.test.mjs) | B: API e Card Brick com conta de teste |
| F05 | Venda presencial, manual e Point simulado | Preparar antes do provedor, recuperar sem nova chave, imprimir/retomar | [smoke PG](../scripts/smoke-tests.js), [Point](../scripts/mercado-pago-point-tests.js), [impressao](../tests/box-office-print-fulfillment.test.mjs) | B: Orders de teste; C: terminal/impressora |
| F06 | Bomboniere e ultimo estoque | Venda avulsa/com ingresso, baixa, reposicao confirmada e parcial | [smoke PG](../scripts/smoke-tests.js), [financas](../tests/concession-finance.test.mjs), [cancelamento](../tests/concession-cancellation.test.mjs) | C: inventario fisico/relatorio |
| F07 | Clube, elegibilidade e credito | Compra/uso, disputa, cancelamento e historico | [smoke PG](../scripts/smoke-tests.js), [concorrencia](../scripts/postgres-concurrency-tests.js), [E2E](../e2e/club-credit.spec.js) | C: saldo e plano operacional |
| F08 | Ingresso e direitos durante reembolso | QR unico, revalidacao recusada, pendencia bloqueia uso, confirmacao invalida | [seguranca](../tests/ticket-security.test.mjs), [smoke PG](../scripts/smoke-tests.js) | C: leitor e acesso reais |
| F09 | E-mail automatico e reenvio | Job apos commit, lease/retry; diagnostico sem promessa de entrega unica | [worker](../tests/ticket-email-worker.test.mjs), [PG](../tests/database-persistence-postgres.test.mjs) | B/C: entregabilidade e destinatario autorizado |
| F10 | Admin, 2FA e permissoes | Usuario sem `orders.refund` nao estorna; origens e papeis respeitados | [permissoes](../tests/admin-permissions.test.mjs), [2FA](../scripts/admin-two-factor-tests.js), [seguranca](../tests/security/abuse.test.mjs) | C: contas e papeis por cinema |
| F11 | Studio e campanhas | Claim/heartbeat/fencing, retomada e artefato obsoleto sem publicacao | [automacao](../tests/social-studio-automation.test.mjs), [PG](../tests/database-persistence-postgres.test.mjs) | C: publicacao comercial proibida nesta fase |
| F12 | Wallet e identidade | Classe/objeto com marca da instalacao; nome ausente impede teste externo | [Wallet](../tests/google-wallet-integration.test.mjs), [multi-cinema](../tests/phase8-multi-cinema.test.mjs) | B: issuer/test users; C: aprovacao e leitura no dispositivo |

Lacunas deliberadas: nao ha teste externo de todos os provedores, de cada reembolso manual, de todas as telas/acoes do painel, nem de entrega por SMTP real. Uma linha `I` verde nao se torna `B`/`C` verde por inferencia.

## Mercado Pago Point - roteiro dirigido

Base oficial: [teste de integracao Point](https://www.mercadopago.com.br/developers/pt/docs/mp-point/integration-test), [Orders API/idempotencia](https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/migrate-payment-intent-to-orders), [cancelamento/reembolso](https://www.mercadopago.com.br/developers/pt/docs/mp-point/payment-processing) e [impressoes](https://www.mercadopago.com.br/developers/pt/docs/mp-point/configure-printings). A documentacao consultada descreve chave `X-Idempotency-Key` para criar/cancelar/reembolsar Orders; a aplicacao persiste a chave antes do POST. GET por Order ID existe, mas **nao foi comprovada busca Point por `external_reference`** nesta implementacao. A documentacao de teste oferece terminal virtual `SBX0000001` e simulacao de status; isso nao substitui a medicao de qualidade em terminal fisico nem autoriza cobranca real. Cancelamento em `at_terminal` pode ser assincrono (`202` nao e conclusao); o reembolso de Order Point documentado e total. Antes de qualquer B, verificar de novo a versao vigente desses contratos.

| ID | Cenario | Base interna / esperado | Proximo nivel e bloqueio |
| --- | --- | --- | --- |
| P01 | Pagamento iniciado | Intencao `prepared` persistida antes de POST; [smoke](../scripts/smoke-tests.js) | B; app/conta de teste autorizados |
| P02 | Pagamento pendente | Sem ingresso nem produto entregue enquanto pendente; [smoke](../scripts/smoke-tests.js) | B; status externo nao validado |
| P03 | Pagamento aprovado | Commit local e direitos uma vez; [smoke](../scripts/smoke-tests.js) | B; aprovacao real nao validada |
| P04 | Pagamento recusado | Estado terminal nao emite direitos; [Point](../scripts/mercado-pago-point-tests.js) | B; recusa externa nao validada |
| P05 | Terminal desconectado | Preservar intencao/referencia e mostrar reconexao; [smoke](../scripts/smoke-tests.js) | C; equipamento indisponivel |
| P06 | Timeout | `unknown` nao vira autorizacao para nova chave; [smoke](../scripts/smoke-tests.js) | B/C; efeito remoto pode ter ocorrido |
| P07 | Retorno tardio | Pedido encerrado nao recebe direito automaticamente; [smoke](../scripts/smoke-tests.js) | B/C; conciliacao humana |
| P08 | Mesma solicitacao repetida | Fingerprint/valor/terminal conferidos; mesma chave ou 409; [smoke](../scripts/smoke-tests.js) | B; prazo de idempotencia externo nao comprovado |
| P09 | Duas consultas simultaneas | Duas instancias, um claim/chamada simulada; [segundo processo](../scripts/point-smoke-second-instance.js) | B; provedor real nao testado |
| P10 | Reinicializacao do backend | Intencao PG recuperada apos restart; [smoke](../scripts/smoke-tests.js) | B/C; janela/lease operacional nao medidos |
| P11 | Impressao concluida | Acao associada sem recobrar; [impressao](../tests/box-office-print-fulfillment.test.mjs) | C; impressora real nao testada |
| P12 | Falha de impressao | Reconsultar/ resolver sem nova cobranca; [smoke](../scripts/smoke-tests.js) | C; firmware/papel/terminal nao testados |
| P13 | Cancelamento confirmado | Resultado terminal, direitos coerentes; [smoke](../scripts/smoke-tests.js) | B/C; webhook externo requerido |
| P14 | Cancelamento inconclusivo | `202` permanece pendente, nao cancelado; [smoke](../scripts/smoke-tests.js) | B/C; confirmar status futuro |
| P15 | Reembolso autorizado | Chave/permissao e direitos apos confirmacao; [smoke](../scripts/smoke-tests.js) | B/C; nenhum estorno real autorizado |
| P16 | Divergencia provedor x banco | `reconciliationRequired` e bloqueio de direitos; [smoke](../scripts/smoke-tests.js) | B/C; operador financeiro necessario |
| P17 | Recuperacao por Order ID | GET e correlacao valor/referencia/terminal; [smoke](../scripts/smoke-tests.js) | B; contrato externo a confirmar |
| P18 | Sem Order ID recuperavel | Retry somente mesma chave depois de lease; [smoke](../scripts/smoke-tests.js) | B; nao ha busca por `external_reference` comprovada |
| P19 | Pedido local cancelado e pagamento aprovado | Nao reativar direito; [smoke](../scripts/smoke-tests.js) | B/C; conciliacao humana |
| P20 | Cobranca antiga sem referencia local | [procedimento assistido](FASE9_DESBLOQUEIO.md) impede associacao aproximada | Humano; nao recuperavel automaticamente |

Registrar para cada P01-P20: Order ID, referencia local, status antes/depois, terminal autorizado, resultado HTTP, notificacao assinada, commit local, direitos e evidencias sanitizadas. P01-P20 **nao foram executados externamente** nesta fase. A medicao de qualidade do Mercado Pago pede Order produtiva em terminal fisico, segundo a [pagina oficial](https://www.mercadopago.com.br/developers/pt/docs/mp-point/integration-quality); fica no nivel C, fora deste trabalho.

## Outras integracoes

| Integracao | Evidencia interna e criterio do proximo teste | Nivel pendente / parada |
| --- | --- | --- |
| Mercado Pago Pix | [checkout](../scripts/smoke-tests.js), [Orders Pix de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix): comparar valor, QR, expiracao, status e conciliacao | B somente com app/conta de teste autorizados; nao pagar QR real |
| Mercado Pago cartao | [metadados](../tests/mercado-pago-order-metadata.test.mjs), [E2E](../e2e/checkout-payment.spec.js): validar Brick, token, recusas, `statement_descriptor` e Device ID em Order de teste | B; nunca guardar PAN/CVV nem usar cartao real |
| Mercado Pago webhook | [assinatura](../scripts/mercado-pago-webhook-tests.js): HMAC `x-signature` e `x-request-id`, Order consultada antes da conciliacao; [guia oficial](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks) | B: URL de teste e segredo por canal seguro; nao aceitar payload isolado como pagamento |
| PagBank | [integracao](../tests/pagbank-integration.test.mjs): verificar se a instalacao o usa, estados e notificacao; [webhooks oficiais](https://developer.pagbank.com.br/reference/webhooks) | B apenas se habilitado e autorizado; caso contrario nao aplicavel |
| E-mail | [fila](../tests/ticket-email-worker.test.mjs): retries, backoff, lease, heartbeat e reenvio; medir template/entregabilidade com destinatario de teste | B/C; provedor pode aceitar antes do commit local, duplicacao e possivel |
| Google Wallet | [classe/objeto](../tests/google-wallet-integration.test.mjs): issuer, class ID, marca, logo e JWT por cinema; [checklist oficial](https://developers.google.com/wallet/tickets/events/test-and-go-live/launch-checklist) | B: test users/issuer; botao de testar pode criar/alterar classe e iniciar revisao, exige autorizacao externa |
| Social Studio | [worker](../tests/social-studio-automation.test.mjs): claim, fencing, artefato, QA | C: nao publicar nem fazer upload comercial nesta fase |

## Incidentes e observabilidade

Usar identificadores de pedido/pagamento/job/campanha e `auditLogs`, sem tokens, CPF, cartao ou payload bruto. A [operacao assincrona](architecture/operations.md) detalha jobs. Campos `pointCreateState`, `reconciliationRequired`, `refundStatus` e `ticket_email_jobs.status` ajudam a localizar estados; logs relevantes incluem `box_office_point_sale.reconnect_required`, `box_office_point_sale.synced`, `order.refund_pending`, `order.ticket_refund_pending`, `ticket_email.worker_failed` e `social_studio.automation.failed`. Confirmar configuracao de retencao, acesso e correlacao por instalacao antes de C; nao ha prova nesta fase de que todos os incidentes possuam um unico trace completo.

| Sinal | Acao segura antes de retomar |
| --- | --- |
| Intencao Point sem Order ID ou valor/terminal divergente | Pausar a venda daquela referencia; preservar chave, paymentId, terminal, horario e estado; consultar por ID quando existir. Sem ID, retry apenas com mesma chave apos lease ou conciliacao humana. |
| Aprovacao tardia ou pedido sem ingresso | Nao emitir automaticamente se pedido encerrado; comparar `orders`/`payments`/`tickets` e evidencia assinada do provedor, escalar ao responsavel financeiro. |
| Reembolso inconclusivo, estoque/credito divergente | Nao repetir com chave nova; examinar `refundStatus`, referencia, auditoria, estoque e creditos antes de qualquer ajuste autorizado. |
| Falha de impressao | Nao recobrar; consultar acao de impressao e rota de resolucao com permissoes. |
| E-mail/job/campanha parado | Examinar lease, heartbeat, tentativas e efeito externo possivelmente aceito; retomar pela fila existente sem disparo manual cego. |
| PostgreSQL indisponivel ou tentativa admin negada | Interromper novas vendas e mutacoes; preservar logs, verificar integridade e acesso, escalar sem relaxar permissao ou apontar para outro banco. |

Condicoes de parada: cobranca sem referencia duravel, duplicidade financeira/ingresso, webhook invalido aceito, direito liberado antes da aprovacao, estorno duplicado, vazamento entre cinemas, backup nao verificavel, segredo/PII em log, erro de permissao ou CI obrigatorio vermelho. Responsavel, canal de escalonamento e janela sao pendentes de designacao; nao inventar RTO/RPO.

## Backup, reversao e implantacao futura

Antes de qualquer instalacao: fixar SHA/release e aprovador; verificar artefatos e compatibilidade da versao anterior; revisar variaveis/segredos por cinema sem exibi-los; confirmar banco exclusivo, backup verificavel, migrations e plano de rollback; conferir processos/portas, proxy, HTTPS, dominio, CORS/origens, webhooks, Wallet, e-mail, logs/alertas e capacidade de pausar vendas. **Este checklist nao executa esses passos.**

Em futura janela autorizada: registrar ponto de recuperacao e testes de integridade, parar writes/workers, restaurar somente no destino aprovado, verificar schema, contagens, relacoes, pagamentos, direitos, estoque, creditos, jobs e campanhas. Conciliar **todas** as operacoes externas posteriores ao backup antes de religar workers: cobrancas, reembolsos, impressoes, e-mails e uploads. O [ensaio sintetico](TESTES_POSTGRESQL.md#ensaio-de-backuprestauracao-da-fase-9) nao mede RTO/RPO, nao restaura producao e nao reverte efeitos externos. Falha de reconciliacao bloqueia retomada. Rollback de codigo nao deve sobrescrever banco ou estado financeiro.

## Cinco instalacoes previstas

O [registro de exemplo](../config/cinema-instances.example.json) tem apenas `cinecruzeiro` habilitado; as demais linhas sao **candidatas planejadas e desativadas**, nao evidencias operacionais. `cine-romeu` e uma sexta entrada desativada, fora da matriz de cinco; nao ativar.

| Cinema | Rota no exemplo | Estado do exemplo | Exigencias especificas antes de C |
| --- | --- | --- | --- |
| Cine Cruzeiro | `/projects/cinecruzeiro` | Habilitado | Confirmar piloto com usuario; ambiente/banco/conta/terminal de teste, marca, sala, programacao, backup e responsavel. |
| Cine Estacao Amparo | `/projects/cine-estacao-amparo` | Desativado | Comprovar nome/logo Wallet, issuer, email, provedor, banco, dominio e sessao sem herdar Cruzeiro. |
| Cinemax Piraju | `/projects/cinemax-piraju` | Desativado | Confirmar marca, pagamentos, Point se usado, salas, estoque, email e reversao exclusivos. |
| Cine Gama | `/projects/cine-gama` | Desativado | Confirmar configuracao, dominio, Wallet, banco, programacao, jobs e operador. |
| CineMania Cosmopolis | `/projects/cinemania-cosmopolis` | Desativado | Confirmar identidade, provedor, Wallet, banco, sessoes, bomboniere e logs. |

Para **cada** cinema: capturar configuracao real somente em ambiente autorizado, comparar com a fixture, registrar responsavel e aprovar separadamente pagamentos, terminal, Wallet, e-mail, salas, dominio, banco, backup e rollback. A validacao sintetica do registro nao aprova nenhum desses recursos reais.
