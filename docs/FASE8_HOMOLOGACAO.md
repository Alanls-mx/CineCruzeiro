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
