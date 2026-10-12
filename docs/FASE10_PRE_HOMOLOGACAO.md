# Fase 10 - pre-homologacao controlada

Branch `codex/modularize-server-admin`; linha de base `7944dfb588d433b6999945d1734e9b5df1fc0a1b`. Commits de implementacao/documentacao `dc64009` e `c70e55e916986a0ed5207142d9f8f01e6a5db48a`; o HEAD final deste pacote, que inclui a presente atualizacao de evidencias, deve ser confirmado por `git rev-parse HEAD` na branch publicada. Este relatorio registra a versao candidata e os limites para **solicitar** homologacao futura. Nao autoriza deploy, merge, terminal fisico, credencial externa, pagamento/reembolso, e-mail comercial, VPS ou banco operacional. O [caderno do piloto](FASE10_CADERNO_PILOTO.md) contem o portao de autorizacao, a matriz funcional/Point, as cinco instalacoes, os incidentes e o checklist de implantacao futura. A [Fase 9](FASE9_DESBLOQUEIO.md) permanece a evidencia financeira anterior.

## Escopo e versao

O codigo de Point, refund e backup/restauracao da Fase 9 foi preservado. A revisao da Wallet revelou que a verificacao de `EventTicketClass` podia enviar nome/logo do Cine Cruzeiro a outra instalacao. A identidade da classe agora vem de `settings.cinemaName`/`settings.name` e do `logo-display.webp` da URL da propria instalacao; a falta de nome interrompe o teste de integracao antes de chamar o Google. Fallbacks visiveis no objeto Wallet deixaram de incluir Cruzeiro. O teste sintetico confirma que somente a entrada `cinecruzeiro` esta habilitada, enquanto `cine-romeu` continua desativada e fora das cinco instalacoes planejadas. A marca e o ativo reais de cada cinema ainda exigem conferencia autorizada antes de Wallet externo.

Arquivos de implementacao: [layout Wallet](../backend/services/googleWalletPassLayoutService.js), [coordenador/diagnostico](../backend/server.js), [teste Wallet](../tests/google-wallet-integration.test.mjs), [teste multi-cinema](../tests/phase8-multi-cinema.test.mjs). Nao houve migration, endpoint ou permissao nova. O diagnostico Wallet existente pode criar/alterar classe e iniciar revisao no Google; isso pertence ao nivel B/C e **nao** foi invocado. O [Mapa Inteligente](architecture/README.md) indica os proprietarios de configuracao, persistencia, permissao, transacao e testes.

## Resultado interno

| Escopo | Evidencia | Estado nesta fase |
| --- | --- | --- |
| Point duravel, retry, disputa entre instancias | [smoke PG](../scripts/smoke-tests.js), [segundo processo](../scripts/point-smoke-second-instance.js) | Provedor simulado; reexecucao no CI do SHA final pendente. |
| Estornos prioritarios e direitos | [smoke PG](../scripts/smoke-tests.js), [financas](../tests/concession-cancellation.test.mjs) | `test:finance` 50/50 local; failpoints PG no CI. Matriz externa/manual ainda parcial. |
| Backup/restauracao | [ensaio protegido](../scripts/postgres-backup-restore-test.js) | Retencao em `%TEMP%` passou; restore sintetico no CI do SHA final pendente. |
| Programacao, compra, bilheteria, Clube, email, Studio, admin | [matriz funcional](FASE10_CADERNO_PILOTO.md#matriz-funcional-interna) | Testes internos mapeados, sem aceite operacional. |
| Wallet e isolamento de marca | `node --test tests/google-wallet-integration.test.mjs tests/phase8-multi-cinema.test.mjs` | 25/25 aprovados localmente; nenhuma API externa chamada. |
| Piloto local completo | Docker e marcadores | Nao executado: daemon Docker inativo e `TEST_POSTGRES_ADMIN_URL`/`CINE_TEST_SERVER_TOKEN` ausentes. CI possui container proprio. |

Regressao local: `test:unit` passou (testes PG dependentes de banco ficaram ignorados), `test:security:local` 25/25, `test:finance` 50/50, `lint`, `build`, `test:legacy:json`, `test:operations` (retencao temporaria), `deploy:validate` (`REGISTRY_OK=1`), `test:multi-cinema:synthetic` 5/5, `test:e2e` 19/19, `docs:check` e `docs:coverage` passaram. E2E registrou avisos do modo de desenvolvimento (CSP/`eval`) e webhook de e-mail nao configurado nos fixtures; nenhum teste falhou. Isso nao prova CSP de producao nem entregabilidade. `docs:coverage` mediu 196 arquivos, 1.878 declaracoes candidatas, 20 simbolos curados e 32 entradas de endpoint; nao mede completude semantica. Nao converter uma coluna interna verde em homologacao externa.

No commit `c70e55e916986a0ed5207142d9f8f01e6a5db48a`, os workflows [Security regression](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/38286190817), [PostgreSQL integration](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/38286190809) e [Browser E2E](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/38286190819) terminaram com `success`. O job PostgreSQL executou smoke repetido, testes de repositarios e ensaio sintetico de backup/restauracao no container protegido. A publicacao deste complemento documental cria outro HEAD; os mesmos tres workflows **devem ser verificados nele** antes da decisao final. Sem essa verificacao, a evidência de `c70e55e` nao basta.

## Contratos externos e limites

- **Point:** a [Orders API](https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/migrate-payment-intent-to-orders) requer chave de idempotencia para criacao/cancelamento/reembolso; a recuperacao local usa Order ID ou reenvia a mesma intencao/chave apos lease. Nao ha consulta por referencia externa comprovada. O [guia de teste](https://www.mercadopago.com.br/developers/pt/docs/mp-point/integration-test) permite simular status e usar terminal virtual, mas isso nao testa a maquininha real; [qualidade Point](https://www.mercadopago.com.br/developers/pt/docs/mp-point/integration-quality) exige uma Order produtiva no terminal fisico. Nenhuma dessas chamadas foi feita nesta fase.
- **Cancelamento/impressao:** a [documentacao Point](https://www.mercadopago.com.br/developers/pt/docs/mp-point/payment-processing) distingue `202` de conclusao; [acoes de impressao](https://www.mercadopago.com.br/developers/pt/docs/mp-point/configure-printings) tem status proprio. Nao repetir cobranca para corrigir impressao. A implementacao e seus mocks ainda nao provam comportamento de firmware/terminal.
- **Online:** Pix, cartao, webhook assinado e refund exigem aplicacao/contas de teste autorizadas. Os [testes Pix oficiais](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix) nao equivalem a pagamento bancario real. PagBank e condicional ao provedor habilitado na instalacao; [webhooks oficiais](https://developer.pagbank.com.br/reference/webhooks) precisam de URL de teste propria.
- **Wallet:** o [checklist de lancamento](https://developers.google.com/wallet/tickets/events/test-and-go-live/launch-checklist) pede classe/objeto por Issuer, usuarios de teste e aprovacao para publicar. O codigo local nao comprova que o Issuer, a Service Account, as origens e o ativo de marca reais estao corretos em cada cinema.
- **Email/Studio:** worker persistente, retries e fencing foram exercitados internamente, mas aceitar e-mail/upload externo antes de persistir resultado local pode duplicar efeito. Nao prometer exatamente uma vez, nem publicar campanha real nesta fase.

## Riscos e portoes

1. Nenhum cinema foi confirmado como piloto pelo responsavel. Cine Cruzeiro e somente o candidato do registro de exemplo.
2. Credenciais, conta Mercado Pago, terminal, Issuer Wallet, SMTP, dominio, banco e backup reais nao foram conferidos por instalacao. A fixture tem quatro das cinco instalacoes desativadas; Cine Romeu tambem esta desativado e nao integra o plano.
3. Matriz automatica de refund nao cobre todos os fornecedores e operacoes manuais. Referencias Point legadas sem vinculo e resultados externos divergentes requerem conciliacao humana. Uma transacao entre PG e provedor nao e atomica.
4. O ensaio de restore e sintetico. RTO/RPO, retencao, capacidade, on-call, janela e destino de restore devem ser definidos por operador; restituir backup antigo nao desfaz pagamento, email, impressao ou campanha.
5. O inventario de observabilidade e parcial: estados/logs permitem investigacao dirigida, mas nao demonstram correlacao completa e alertas eficazes em todas as instalacoes. Ver [playbook](FASE10_CADERNO_PILOTO.md#incidentes-e-observabilidade).

O portao de nivel B/C exige ficha de cinema/ambiente/responsavel, escopo, credenciais de teste por canal seguro, valores, janela, parada, rollback e evidencias sem PII. Sem ficha e autorizacao especifica, o estado permanece **nao executado/bloqueado por autorizacao**. O checklist preparado nao deve ser executado automaticamente por agentes futuros.

## Decisoes formais

| Decisao | Estado preliminar | Evidencia ou condicao |
| --- | --- | --- |
| A. Modularizacao estrutural | Aprovada com ressalvas | Mantem decisao da Fase 9; nenhuma extracao ampla. |
| B. Prontidao tecnica da candidata | Aprovada com ressalvas, sujeita ao CI do HEAD deste relatorio | Regressao local e tres workflows verdes em `c70e55e`; verificar Security, PostgreSQL e Browser E2E novamente no SHA final. |
| C. Pronta para **solicitar** homologacao externa autorizada | Aprovada com ressalvas somente apos B final | Matrizes, portoes e parada preparados; nao e autorizacao para executar B/C. |
| D. Homologacao operacional do piloto | Nao executada | Falta escolha/ambiente/responsavel/operacoes autorizadas e prova real. |
| E. Homologacao das demais instalacoes | Nao executada | Quatro candidatas desativadas; nenhuma validacao individual real. |

O HEAD final e os tres workflows devem ser lidos na [branch publicada](https://github.com/Alanls-mx/CineCruzeiro/tree/codex/modularize-server-admin) antes de promover B; o resultado final do CI nao deve ser presumido a partir de um SHA anterior. **Nenhum deploy ou merge na `main`.**
