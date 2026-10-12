# Fase 11 - homologacao interna assistida do piloto

Branch `codex/modularize-server-admin`. Linha de base: `253270ec662cc878463ac1b042e2e866792a04bd`; correcao dirigida: `e6f941a`. O HEAD publicado desta fase deve ser obtido com `git rev-parse HEAD` e conferido nos tres workflows desse mesmo SHA. **Cine Cruzeiro (Cruzeiro/SP) foi escolhido como piloto pelo responsavel.** A escolha nao autoriza sandbox, terminal, VPS, banco operacional, pagamento, e-mail externo, Wallet externo ou deploy. O [caderno da Fase 10](FASE10_CADERNO_PILOTO.md) permanece a matriz-base F01-F12 e P01-P20; a [ficha do primeiro sandbox](FASE11_AUTORIZACAO_SANDBOX.md) registra o que falta autorizar.

## Versao e ambiente

O [registro de exemplo](../config/cinema-instances.example.json) identifica `cinecruzeiro` como unica entrada habilitada e deixa as outras quatro candidatas e `cine-romeu` desativados. `deploy:validate` valida a fixture, nao uma instalacao. Nesta estacao o daemon Docker segue inacessivel e nao ha `TEST_POSTGRES_ADMIN_URL`, `CINE_TEST_SERVER_TOKEN` ou `TEST_DATABASE_URL`; nao se montou um piloto PostgreSQL local e nao se tentou apontar a um banco existente. O [harness protegido](TESTES_POSTGRESQL.md) e o workflow PostgreSQL sao o unico caminho para smoke, concorrencia e restauracao destrutivos. E2E e JSON legado usam fixtures temporarias, nao substituem esse caminho.

Ambiente piloto reproduzivel, **a preparar somente em recurso autorizado**: instalacao isolada, origem/rota e processos proprios; PostgreSQL descartavel marcado e role de teste; migrations e dados `.invalid` gerados por execucao; sala, filme, sessao, assentos, ingresso, produto/estoque, plano/credito e clientes sinteticos; admin com 2FA e permissoes minimas; provedores simulados sem segredo real; logs sanitizados; limpeza por marcador. Confrontar URL, origem, marca, conta do provedor e armazenamento antes de qualquer nivel B. Nao copiar dados ou credenciais operacionais.

## Alteracao dirigida

O [provedor Point](../backend/services/cardTerminalProvider.js) truncava `description` em 255 caracteres, embora a [documentacao atual de Orders Point](https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/migrate-payment-intent-to-orders) limite a descricao a 150. Agora envia no maximo 150. A impressao tinha `CINE CRUZEIRO` fixo no modulo compartilhado; [server.js](../backend/server.js) passa `settings.cinemaName`/`settings.name`, com fallback generico, ao conteudo de impressao. [Teste dirigido](../scripts/mercado-pago-point-tests.js) verifica ambos. Valor, chave idempotente, referencia, estado financeiro e contrato HTTP permaneceram inalterados. Um nome de sala ou QR legado pode ainda carregar convencoes anteriores: conferir o comprovante completo por cinema antes de operacao externa.

## Evidencia interna executada

| Comando / ambiente | Resultado | Alcance e limite |
| --- | --- | --- |
| `node scripts/mercado-pago-point-tests.js` | Passou | Fetch simulado; payload, descricao, marca de impressao, cancelamento e refund unitarios; sem Order externa. |
| `npm run test:unit` | Passou | Inclui financeiro 50/50, Point, 2FA, email, Studio, seguranca de ingresso e sessoes. Testes PostgreSQL condicionais ficaram ignorados localmente. |
| `npm run test:security:local` | 25/25 | Inclui HMAC simulado, origem/CORS, dados publicos e assentos; nao certifica CSP de producao. |
| `npm run test:payment-metadata`, `test:google-wallet`, `test:multi-cinema:synthetic` | 7/7, 20/20, 5/5 | SDK/payload local, marca Wallet e fixture isolada; nenhuma API externa nem instalacao real. |
| `npm run test:e2e` | 19/19 | Browser em modo de desenvolvimento, servidor/JSON sinteticos; aviso CSP de `eval` do dev e canal de email ausente nos fixtures. |
| `npm run test:legacy:json`, `test:operations` | Passaram | Smoke JSON temporario e retencao em diretoria temporaria; sem banco operacional. |
| `npm run lint`, `npm run build`, `npm run deploy:validate` | Passaram | Tipos/build e registro de exemplo (`REGISTRY_OK=1`); nao sao deploy. |
| `npm run docs:check`, `npm run docs:coverage` | Passaram: 17 documentos e 196 arquivos no escopo | Links/simbolos e candidatos; cobertura semantica requer revisao humana. |
| PostgreSQL local protegido | Nao executado | Docker inativo e marcadores ausentes; CI do HEAD final deve executar smoke, concorrencia, repositarios e restore. |

No commit `ffdc1138406a35fc06ef36238f4271e494458aca`, [Security regression](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/38288870765), [PostgreSQL integration](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/38288870707) e [Browser E2E](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/38288870730) terminaram com `success`. O job PostgreSQL confirmou servico Docker proprio, smoke repetido, concorrencia, repositarios e backup/restauracao sintetico. A presente atualizacao documental cria outro HEAD: a verificacao desses tres workflows **nesse HEAD** continua obrigatoria antes de fechar B, sem reutilizar apenas o resultado de `ffdc113`.

## Matriz funcional do piloto

`Parcial` significa que o teste citado prova apenas as invariantes nomeadas. Nenhuma linha recebeu aceite operacional. Reutilizar procedimentos e resultados esperados em [F01-F12](FASE10_CADERNO_PILOTO.md#matriz-funcional-interna).

| ID | Evidencia fresca / alcance | Classificacao interna | Pendencia |
| --- | --- | --- | --- |
| F01 | Unitarios de publicacao/catalogo na `test:unit`; sem ciclo completo de curadoria no painel | Parcial | Catalogo real e revisao humana. |
| F02 | Conflitos/limpeza em `test:unit`; E2E abre editor e sincroniza sessao vendida | Parcial | Capacidade/grade fisica e virada comercial no piloto. |
| F03 | E2E de hold e concorrencia; seguranca de assentos 25/25 | Parcial | Ultima vaga e expiracao transacionais no PostgreSQL do CI. |
| F04 | E2E Pix pendente, aprovado por webhook simulado e recusado; metadados de cartao 7/7 | Parcial | Cartao Brick e API real apenas em B autorizado. |
| F05 | E2E venda rapida; Point mock e impressao dirigida | Parcial | Terminal, firmware e impressora reais somente em C. |
| F06 | E2E venda com bomboniere; financeiro 50/50; smoke JSON | Parcial | Inventario/relatorio fisicos e disputa PG no CI. |
| F07 | E2E Clube com credito e Pix; unitarios de elegibilidade | Parcial | Saldo e plano operacionais; concorrencia PG no CI. |
| F08 | Unitarios de QR/anti-reuso; validacao em smoke | Parcial | Leitor e fluxo de acesso fisicos. |
| F09 | Worker e retry em `test:unit`; notificacoes E2E sem canal configurado | Parcial | Entregabilidade e destinatario externo autorizados. |
| F10 | 2FA/permissoes em `test:unit`; shell/admin E2E | Parcial | Revisao de todos os papeis e contas reais. |
| F11 | Automacao Studio em `test:unit` | Parcial | Publicacao comercial proibida nesta fase. |
| F12 | Wallet 20/20 e marca multi-cinema 5/5 | Parcial | Issuer, classe/objeto e dispositivo reais em B/C. |

## Point e contratos externos

A [Orders API](https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/migrate-payment-intent-to-orders) exige `X-Idempotency-Key` para criar, cancelar e reembolsar, aceita `type=point`, referencia alfanumerica de ate 64 caracteres e valor string. Reusar chave com body diferente e erro; nao inferir prazo ilimitado de idempotencia. O [guia de teste Point](https://www.mercadopago.com.br/developers/pt/docs/mp-point/integration-test) descreve `SBX0000001`, simulacao de estados e webhooks configurados; o virtual nao serve para medicao de qualidade. [Cancelamento `at_terminal`](https://www.mercadopago.com.br/developers/pt/docs/mp-point/payment-processing) pode devolver HTTP 202 sem conclusao; refund de Order Point e integral, com limite documentado de 90 dias; GET por Order ID e documentado para Orders com menos de tres meses. Esses limites precisam ser reconferidos antes do teste autorizado. Nao ha busca por `external_reference` comprovada. Nenhuma chamada ao Mercado Pago foi feita nesta fase.

| P01-P20 do caderno | Prova interna atual | Proximo portao |
| --- | --- | --- |
| P01-P04 criacao, pendencia, aprovacao, recusa | Smoke/Point simulados; sem resposta oficial | B: app, credencial e terminal virtual autorizados. |
| P05-P07 desconexao, timeout, retorno tardio | Intencao/estado incerto simulados, sem terminal real | B para timeout de API; C para desconexao fisica; conciliacao humana em atraso. |
| P08-P10 repeticao, concorrencia, restart | Chave/lease e duas instancias no PG protegido da Fase 10; revalidar CI | B para prazo/idempotencia do provedor; C para comportamento fisico. |
| P11-P12 impressao/falha | Payload/acao mock e recuperacao local | C: terminal/impressora reais. |
| P13-P15 cancelar, 202, refund | Estados e permissao simulados | B apenas operacoes expressamente autorizadas; C para terminal fisico. |
| P16-P19 divergencia, GET, sem ID, aprovacao tardia | Bloqueio/retry pela mesma chave no smoke PG; sem busca por referencia | B para consulta real; conciliador humano para divergencia. |
| P20 cobranca legada sem vinculo | Procedimento assistido da [Fase 9](FASE9_DESBLOQUEIO.md) | Humano; nao reconciliar automaticamente. |

Pix, cartao, webhook, PagBank condicional, email, Wallet e Studio seguem a [matriz de integracoes](FASE10_CADERNO_PILOTO.md#outras-integracoes). Pix/Cartao nao foram medidos no provedor; PagBank somente se habilitado na instalacao; Wallet pode alterar classe no Google; email pode duplicar apos aceite remoto sem commit; Studio nao publicou. Estado externo de todos: **nao autorizado / nao executado**. Um mock verde nao prova notificacao, entrega, aceite ou reembolso reais.

## Seguranca, incidentes e recuperacao

Foram exercitados permissao, 2FA, origem/CORS, HMAC local, limite de dados publicos, anti-reuso de QR, protecao de SQL e seguranca de URL nos testes. A CSP de desenvolvimento gerou avisos de `eval` no E2E; confirmar a politica de producao apenas em ambiente autorizado. Segredos, logs, rate limiting efetivo sob carga, isolamentos de banco/rota/arquivo em processos reais e retencao de auditoria ainda precisam de revisao operacional. Nao desativar controles para homologar.

Para Point incerto, reembolso pendente, ingresso sem pagamento, falha de impressao, estoque divergente, job abandonado ou falha PostgreSQL, usar o [playbook da Fase 10](FASE10_CADERNO_PILOTO.md#incidentes-e-observabilidade): pausar a operacao afetada, preservar IDs/estado sem PII/segredo, consultar o provedor somente sob autorizacao e escalar ao responsavel financeiro. Parar a sequencia diante de cobranca/ingresso duplicado, valor ou identidade divergente, direito liberado cedo, webhook invalido aceito ou backup sem integridade. A [retencao temporaria](../scripts/backup-retention-tests.js) passou localmente; backup/restore de duas bases marcadas sera verificado no CI do SHA final. Restore nao desfaz efeitos externos posteriores e nao mede RTO/RPO. Sem responsavel, janela e plano de conciliacao aprovados, nao retomar trabalhadores operacionais.

## Decisao preliminar

| Decisao | Estado | Motivo |
| --- | --- | --- |
| A. Refatoracao estrutural | Aprovada com ressalvas | Mantida da Fase 10; sem modularizacao ampla. |
| B. Estabilidade tecnica da candidata | Aprovada com ressalvas, sujeita ao CI do HEAD deste relatorio | Regressao local e tres workflows verdes em `ffdc113`; verificar Security regression, PostgreSQL integration e Browser E2E novamente no SHA final. |
| C. Preparacao do ambiente piloto | Aprovada com ressalvas | Especificacao e fixture verificadas; piloto PG local nao montado, infraestrutura real nao inspecionada. |
| D. Prontidao para **solicitar** sandbox | Aprovada com ressalvas apos B | [Ficha](FASE11_AUTORIZACAO_SANDBOX.md) e paradas preparadas; autorizacao ainda ausente. |
| E. Homologacao operacional do Cine Cruzeiro | Nao executada | Nenhuma operacao externa ou fisica autorizada. |

As outras quatro instalacoes e Cine Romeu continuam sem homologacao. **Nao houve deploy, merge, acesso a VPS/banco operacional, pagamento, refund, email externo nem Wallet externo.**
