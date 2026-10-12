# Fase 8 - checklist de homologacao

Este e um plano, **nao** uma autorizacao de deploy, conexao operacional, pagamento, cancelamento, reembolso, e-mail ou campanha real. Usar plano de rollback, contas e valores de teste aprovados pelo operador de cada cinema. Registrar ambiente, versao, horario, resultado e evidencia sem dados pessoais ou segredos.

## Bloqueios antes de qualquer homologacao operacional

- [ ] CI verde no HEAD final da branch: seguranca, PostgreSQL e navegador.
- [ ] Resolver falhas reproduziveis de commit/resposta e lacunas criticas de cancelamento, reembolso e consulta Point listadas em [transacoes](architecture/transactions.md).
- [ ] Definir procedimento de conciliacao para cobranca Point criada no provedor com commit local falho; verificar idempotencia e recuperacao por referencia.
- [ ] Autorizar explicitamente janela, instalacao, ambiente, credenciais de teste e responsavel pelo rollback. Nao usar bancos operacionais nos testes destrutivos.
- [ ] Confirmar backup, restauracao ensaiada, observabilidade e nenhum job pendente desconhecido antes de qualquer migracao.

## Matriz por instalacao

Executar cada linha separadamente para **Cine Cruzeiro**, **Cine Estacao Amparo**, **CineMax Piraju**, **Cine Gama** e **CineMania Cosmopolis**. O [registro sintetico](../config/cinema-instances.example.json) nao prova configuracao operacional.

| Area | Verificacao observavel |
| --- | --- |
| Identidade e isolamento | Dominio, marca, e-mail, carteira, banco, provedor, configuracao de pagamento e Google Wallet corretos; uma instalacao nao acessa dados de outra. |
| Programacao | Filme, sessao, sala real, limpeza e conflito; compra na virada de dia comercial. |
| Checkout | Pix e cartao de teste: reserva temporaria, aprovacao, recusa, expiração, retorno apos login, idempotencia e webhook autentico. |
| Bilheteria e Point | Dinheiro, Pix externo e Point simulado/autorizado; ultima poltrona e ultimo estoque, cancelamento `202`/`200`, reconexao e falha de impressao. |
| Pedidos e direitos | Ingressos, QR, status de poltrona, Clube/creditos, cupons, bomboniere, estoque, cancelamento e reembolso; leitura imediata apos sucesso. |
| Comunicacao | Job de ingresso criado no commit, entrega e reenvio controlado, backoff, lease, diagnostico; campanha Studio com recuperacao e artefato obsoleto. |
| Administracao e seguranca | Perfis/permissoes, 2FA, CSRF, CSP, logs, auditoria, uploads e ausencia de dados sensiveis no cliente. |
| Resiliencia | Reiniciar processo durante fila, pagamento pendente e renderizacao; conciliar estados sem cobranca/ingresso duplicado. |

## Classificacao de pendencias

- **Critico para homologacao:** CI do commit final, conciliacao do Point apos falha local, validação dos fluxos financeiros restantes e plano de reversao.
- **Importante, nao bloqueante para testes isolados:** cobertura de todos os endpoints administrativos no mapa e auditoria de cada ramo de consulta Point/impressao.
- **Dependencia externa:** confirmacao de idempotencia de envio pelo provedor de e-mail e cancelamento de upload/renderizacao ja iniciado no Studio.
- **Melhoria futura:** reduzir responsabilidades restantes de `server.js`/`admin.js` somente com teste de contrato e navegador.

Registrar cada caso como aprovado, falhou, nao executado, ignorado ou bloqueado por ambiente. Nao converter resultado de teste isolado em homologacao das cinco instalacoes.

## Evidencia tecnica isolada da Fase 8

Os commits `a01b4dd`, `d98003f`, `3c53633`, `b023346` e `813c1d3` corrigiram e testaram a sincronizacao Point apos commit, o aviso de divergencia provedor/pedido e a separacao transacional de estornos. O [smoke PostgreSQL](../scripts/smoke-tests.js) usa provedor simulado e banco com marcadores descartaveis. A falha inicial do harness ao usar `DROP ... WITH (FORCE)` foi eliminada: o processo filho termina antes do `DROP DATABASE` simples, sem tentar matar sessao de outro role. O primeiro fixture de estorno marcava o JSON no nivel errado; o teste agora confirma `providerEnvironment` antes de simular o reembolso. Os erros foram mantidos visiveis no historico do CI.

| Area | Estado isolado | Evidencia / limite |
| --- | --- | --- |
| Point pendente, aprovado, concorrente e repetido | Aprovado nos cenarios exercitados | [smoke PG](../scripts/smoke-tests.js): referencia/valor, impressao, commit falho, leitura imediata e ingressos sem duplicacao. Nao foi usado terminal real. |
| Point aprovado apos cancelamento ou revertido apos venda | Aprovado com ressalvas | `reconciliationRequired` e gravado; nao se concede novo direito nem se estorna automaticamente. Falta ferramenta de conciliacao de cobranca orfa. |
| Estorno de ingressos em duas etapas | Aprovado nos cenarios exercitados | Falha no commit de preparo e no commit final, retry com a mesma chave, ingresso valido ate confirmacao. Outros ramos de reembolso nao tem a mesma matriz de failpoints. |
| Criacao externa Point seguida de rollback local | **Bloqueado** para prontidao tecnica plena | A UI usa `clientRequestId`, mas a API ainda aceita ausencia da chave e nao persiste uma intencao antes de chamar o provedor. Nao ha prova de identificacao automatica de toda cobranca orfa. |
| Backup e restauracao isolados | Nao executado | O CI aplica migrations/seeds em banco descartavel. Nao ha ensaio de `pg_dump`/`pg_restore` nesta fase; nao substitui backup operacional. |

## Conciliacao assistida de Point

1. Interromper novas tentativas da mesma venda quando o resultado externo for incerto; preservar pedido, terminal, horario aproximado, valor e `clientRequestId` sem registrar dados de cartao.
2. Quando houver `clientRequestId`, conferir no provedor a referencia `point-venda-lote-<clientRequestId>` (limitada aos primeiros 64 caracteres por `safeReference`) e a chave idempotente completa `point-venda-lote-<clientRequestId>`. Conferir tambem identificador de Order, terminal, valor e status. Nao presumir que uma resposta HTTP falha significa ausencia de cobranca.
3. Buscar `payments.provider_reference`, `provider_payment_id` e `metadata.clientRequestId` no registro local por acesso administrativo autorizado. Se houver registro local, consultar a rota Point, que valida referencia/valor e registra divergencia para conciliacao. Nao repetir uma criacao com chave diferente.
4. Se o provedor tiver cobranca mas nao existir pagamento local, abrir incidente financeiro com a evidencia e suspender a venda correspondente. A aplicacao **nao possui** uma ferramenta segura de importacao/conclusao dessa cobranca orfa. Reembolso, compensacao ou recriacao de direitos exigem decisao humana e procedimento operacional autorizado, nunca um novo POST cego.
5. Se `clientRequestId` estiver ausente ou a consulta por referencia for inconclusiva, nao cobrar novamente. Comparar registros do terminal e do provedor por horario/valor com aprovacao humana; classificar como bloqueio de conciliacao automatica.

Esse procedimento identifica parte das divergencias, mas **nao** comprova recuperacao automatica nos cenarios de timeout, crash antes do commit ou requisicao sem chave estavel. O PostgreSQL nao desfaz cobranca externa.

## Matriz sintetica por cinema

`npm run deploy:validate` e `npm run test:multi-cinema:synthetic` verificam registro, unicidade de rota/porta/diretorio/processo e marca isolada em diretorios temporarios. Nao usam banco, credencial, dominio de producao, carteira ou servico de e-mail. Quatro instancias estao desabilitadas no registro de exemplo; isso nao e erro do teste.

| Cinema | Configuracao e cenario sintetico | Resultado | Pendencia operacional e evidencia necessaria |
| --- | --- | --- | --- |
| Cine Cruzeiro | Identidade-base, rota `/projects/cinecruzeiro`, porta e processo exclusivos | Aprovado com ressalvas | Conferir banco, credenciais, provedor, Wallet, SMTP, jobs, sala e dominio em ambiente autorizado; evidenciar compra/cancelamento controlados. |
| Cine Estacao Amparo | Marca transformada em fixture proprio, rota `/projects/cine-estacao-amparo` | Aprovado com ressalvas | Confirmar logo, nome na Wallet, banco/segredos isolados, sala, programacao e e-mail por teste autorizado. |
| Cinemax Piraju | Marca transformada em fixture proprio, rota `/projects/cinemax-piraju` | Aprovado com ressalvas | Confirmar base de dados, provedor, marca, sessoes, bilheteria e comunicacao em instalacao autorizada. |
| Cine Gama | Marca transformada em fixture proprio, rota `/projects/cine-gama` | Aprovado com ressalvas | Confirmar configuracoes e identidade real, banco, provedor, Wallet e jobs em instalacao autorizada. |
| CineMania Cosmopolis | Marca transformada em fixture proprio, rota `/projects/cinemania-cosmopolis` | Aprovado com ressalvas | Confirmar banco, marca, carteira, e-mail, sessoes, bilheteria e jobs em instalacao autorizada. |

Para cada homologacao futura: indicar cinema, ambiente descartavel ou de teste aprovado, responsavel, janela, credenciais de teste fornecidas fora do repositorio, backup verificado, plano de reversao, cenarios permitidos e evidencias sem dados pessoais. Nenhuma linha acima aprova operacao real.

## Reversao e recuperacao futura

- Reverter **codigo** via release anterior somente depois de avaliar compatibilidade das migrations aditivas e pausar novas vendas no cinema afetado. Nao usar `git reset --hard` para desfazer dados.
- Reverter **configuracao** por valores versionados/registrados com janela e responsavel; nunca restaurar segredo de outro cinema.
- Restaurar **banco** somente a partir de backup verificado em janela autorizada e apos ensaio em instancia descartavel. Reconciliar cobranças, estornos, ingressos e jobs ocorridos apos o backup; nao presumir que o restore reverte operacoes de provedor.
- Inspecionar `ticket_email_jobs`, campanhas Studio, pagamentos pendentes e `reconciliationRequired` antes de religar workers. Lease/heartbeat podem retomar trabalho; envio aceito pelo provedor e renderizacao externa nao oferecem exatamente uma execucao.
- Interromper a homologacao se houver cobranca sem referencia local, erro de autorizacao, divergencia entre valor/provedor, ingresso duplicado, falha de backup/restore ou CI obrigatorio falho. A aprovacao humana deve delimitar explicitamente terminal, contas, valores e eventual reembolso permitido.
