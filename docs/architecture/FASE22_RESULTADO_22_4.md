# Fase 22.4 — resultado da extração controlada

Branch `codex/cine-backend-desacoplamento`; base `50bd2c9`. Commits de implementação: `436749b` (evento desconhecido Mercado Pago), `9d32c23` (prévias de cupom e Clube), `476c6db` (ECDSA PagBank HTTP/SQL). O SHA final é o commit documental posterior; consultar `git rev-parse HEAD` e os workflows referentes a esse SHA.

## Medição reproduzível

`node scripts/measure-modularization.mjs --summary` conta todas as linhas, inclusive espaços e comentários. Base → etapa: `backend/server.js` **10.307 → 10.220** (−87; −0,84%); `handleApi` **3.265 → 3.167** (−98; −3,00%); `backend/public/admin.js` **3.421 → 3.421**. A diferença entre redução do arquivo e do dispatcher decorre de imports e composição explícita. `mercadoPagoUnknownEventHandler.js` e `checkoutPreviewRoutes.js` têm responsabilidades estreitas; nenhum novo arquivo substitui `server.js`.

## Equivalência e portão

O [mapa de ramos](FASE22_ROTAS_FINANCEIRAS_EXTRAIDAS.md) registra entrada, guarda, persistência, resposta e testes. O único escritor extraído é o registro de evento Mercado Pago **ignorado** após HMAC válido; o dispatcher conserva `req.commitResponseAfterMutation` e todos os caminhos de aprovação. As prévias são consultas comerciais: o cliente é obtido da sessão, a reprecificação não atribui poltronas, e os mesmos códigos/payloads são retornados. ECDSA PagBank ganhou teste HTTP com PostgreSQL e chave sintética, sem mover sua máquina de estados.

**Meta indicativa de 9.300–9.800 linhas não atingida.** A redução é deliberadamente menor que o orçamento de 500–1.000 linhas: as rotas de maior porte ainda misturam efeito externo, transação, reconhecimento de direitos e respostas, e a [matriz](FASE22_COBERTURA_FINANCEIRA_AVANCADA.md) continua parcial. A meta arquitetural de 3.000–5.000 linhas permanece pendente. Não houve compactação artificial nem alteração de `admin.js`.

## Validação

Testes dirigidos: `phase22-financial-boundary.test.mjs` (4/4), `mercado-pago-webhook-authority.test.mjs` (4/4), `mercado-pago-webhook-tests.js`, cupons e precificação (11/11), e smoke PostgreSQL descartável antes/depois das duas extrações e após o novo ensaio ECDSA. O smoke confirma rollback sem evento/ingresso, retry com uma escrita, autenticação da notificação e contrato das prévias. O retry PagBank ECDSA passou no caminho HTTP/SQL com chave e Order sintéticas; não comprova a operação externa real.

Suites gerais executadas com código zero: `test:characterization`, `test:unit`, `test:security:local`, `test:finance`, `test:modularization:finance`, `test:maintenance`, `lint`, `build`, `docs:check` e `test:e2e` (**19/19**). `test:legacy:json` falhou inicialmente por porta 4199 ocupada durante execução paralela do smoke PostgreSQL; repetido isoladamente, passou. PostgreSQL descartável: PG16 e PG18 `smoke concurrency repositories guard`, `backup-restore` e PG18 `upgrade`, todos com código zero. O E2E registrou aviso esperado de e-mail sem webhook configurado no ambiente sintético. Os workflows no SHA final serão registrados após a publicação. Nenhum teste em banco operacional, provedor real, VPS, deploy, migração operacional ou merge foi realizado.

## Próximos lotes

1. Completar matriz HTTP PostgreSQL PagBank `AUTHORIZED`, `DECLINED`, `CANCELED`, `REFUNDED`, falha de lookup, evento fora de ordem e divergência antes de extrair qualquer outra transição.
2. Caracterizar duas instâncias HTTP disputando o mesmo checkout e um provedor simulado compartilhado; incluir resposta externa perdida e captura PagBank `AUTHORIZED`.
3. Cobrir refund por provedor/item com dois operadores e último crédito Clube entre processos, verificando SQL depois de cada failpoint.
4. Separar leitura/projeção não financeira restante no dispatcher somente com contratos dirigidos, mantendo a ordem de guards e rotas.

Prontidão técnica: **parcial**. Prontidão operacional: **não avaliada**; os bloqueadores da Fase 13 não foram removidos por esta etapa.
