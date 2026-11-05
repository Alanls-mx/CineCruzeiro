# Fase 13.2 — Portão D: corte e dreno do Cine Cruzeiro

**Estado: bloqueado.** Este é um plano de ensaio, não uma autorização para alterar Nginx, PM2, banco ou provedores. O código da candidata e o ensaio `test:maintenance` demonstram apenas que **um processo novo** em `quiescent` responde 503 sem iniciar o backend operacional. A release instalada `ea7c5df` continua capaz de receber requests, manter WebSockets e executar tarefas até ser isolada e encerrada.

## Evidência no código

| Superfície | Comportamento atual | O que falta demonstrar |
| --- | --- | --- |
| Entrada | O Nginx compartilhado encaminha o prefixo Cine Cruzeiro; o backend antigo não possui modo `quiescent`. | Um corte restrito ao prefixo, inclusive API, admin, arquivos e upgrades, que não bloqueie os outros quatro cinemas. Inspecionar primeiro a configuração efetiva, sem presumir que o snippet de demo corresponde à VPS. |
| Requests em andamento | `backend/server.js` chama `server.close()` em SIGTERM e força saída após 10 segundos. | Medir requests/upgrade ativos **antes** de parar o processo. Um request com efeito externo pode continuar após o corte e exceder o prazo de saída. Sem observabilidade do dreno, parar. |
| WebSockets | O serviço de poltronas mantém conexões e pode modificar holds. | Encerrar e observar as conexões existentes; impedir novos upgrades. `server.close()` não é prova de fechamento das sessões WS já abertas. |
| Workers | O backend inicia recovery Social Studio, e-mail, CRM, manutenção e outros timers no startup normal. `stop()` de alguns workers apenas cancela o próximo tick. | Identificar jobs/leases ativos e efeitos externos em andamento; aguardar conclusão ou classificar resultado incerto com responsável. O processo antigo não oferece um gate único de pausa. |
| Callbacks | O modo novo retorna 503 inclusive para Mercado Pago e demais provedores, sem autenticar nem processar o evento. | Confirmar política de retry e prazo de cada provedor; registrar o intervalo de corte e reconciliar eventos que poderiam ter chegado nele. Um 503 não prova entrega posterior. |
| Retomada | `CINE_OPERATION_MODE=normal` inicia rotas e todas as categorias de trabalho juntas. | Criar e testar liberação por categoria e reconciliação prévia. Não usar HTTP 200 como evidência de retomada segura. |

O limite de transação em [transactions.md](architecture/transactions.md) é decisivo: requests Point, Pix, cartão, refunds, impressões e entregas podem ter efeito externo antes da confirmação local. Um timeout de HTTP, corte de proxy ou saída do processo não autoriza repetição com chave nova.

## Ensaio local obrigatório antes da janela

O comando `npm run test:phase13:proxy` executa uma prova **sintética** em Nginx dentro de Docker: prefixo Cine Cruzeiro recebe 503 para HTTP e WS, inclusive locais que em situação normal teriam `location` própria; prefixos vizinhos retornam 200. O teste cria e remove apenas seu contêiner temporário. O filtro usado é um experimento de precedência, **não** um arquivo para incluir na configuração da VPS. Ele não mede dreno, headers de retry, regras reais de Nginx nem comportamento dos provedores.

Execução local em 05/11/2026: `npm run test:phase13:proxy` passou com `nginx:stable-alpine` (Nginx 1.30.6). O teste cobriu 7 entradas Cine Cruzeiro, upgrade WS e 3 controles negativos. Essa evidência não muda o estado bloqueado do Portão D.

### Leitura limitada da VPS e ensaio ampliado — 05/11/2026

Após autorização explícita de leitura da configuração Nginx, metadados PM2 e contagem de conexões, `nginx -T` passou. A configuração efetiva está em `/etc/nginx/sites-enabled/lumixengine`, com Nginx 1.28.3. Foram observadas nove classes de `location` Cine Cruzeiro: raiz exata, webhook WhatsApp exato (410), API, admin exato e prefixo, uploads, images, trailers e frontend. API/admin/arquivos apontam para `127.0.0.1:4100`; frontend para `127.0.0.1:3100`. Nenhum guard de pausa por prefixo foi encontrado. A presença de um `location` exato torna insuficiente adicionar apenas um `location` genérico de manutenção.

O endereço SSH `54.207.79.219` registrado em documentação local antiga não respondeu. O usuário confirmou `18.231.175.103`, que corresponde a `tiana.lumixengine.com` e permitiu a leitura da instalação Cine Cruzeiro. Qualquer procedimento futuro deve confirmar novamente a identidade do host e não reutilizar o endereço antigo por inferência.

Os processos PM2 `cinecruzeiro-frontend` e `cinecruzeiro-backend` estavam online, com diretório `current` resolvido para a release `20261010-041635-ea7c5df`. Uma amostra de `ss` mostrou somente sockets `LISTEN` nos ports 3100/4100, sem conexões estabelecidas naquele instante. Isso **não** demonstra ausência de requests, WebSockets ou trabalhos externos em outro momento. Nenhuma configuração, processo ou dado operacional foi modificado.

O ensaio foi ampliado para a versão local `nginx:1.28.3-alpine`, com as nove classes observadas e três fases: configuração inicial, guard de 503 e reversão. API/WhatsApp e rotas vizinhas foram verificadas antes e depois; HTTP e upgrade WS receberam 503 durante o corte; vizinhos permaneceram em 200. A imagem Alpine e as rotas sintéticas não reproduzem todos os `include`, headers, TLS e condições da instalação Ubuntu. É necessário ensaiar a configuração efetiva sanitizada e um dreno observável antes de considerar D aprovado.

### Preflight para a solicitação de deploy — 05/11/2026

O pedido explícito de deploy não remove os bloqueios técnicos. A release instalada segue `ea7c5df`; `/` tinha 4,0 GB livres (86% usado), e havia somente uma release Cine Cruzeiro em `releases` (~699 MB). `shared` ocupava ~152 MB e os backups anteriores ~25 MB. Nenhum arquivo foi removido. A candidata `719b1ed` passou Security, Browser e PostgreSQL 16/18, mas o deploy genérico recusa o piloto e o runner guardado ainda exige pausa e backup restaurado.

Três amostras agregadas, estritamente `READ ONLY`, em 30 segundos retornaram 3 pedidos `pending_payment` e 3 pagamentos de cartão `pending`; as contagens não provaram vínculo entre eles. Campanhas de e-mail não estavam em `sending`, destinatários não estavam em `processing`, e outbox CRM/Studio estavam vazios nas amostras. Esses números não substituem classificação individual de pendências nem demonstram ausência de efeito externo em andamento. IDs, valores e dados de clientes não foram extraídos para o relatório.

A [documentação oficial de notificações do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/optional-notifications) diz que os webhooks usuais são reenviados após falta de 200/201, mas o tópico opcional de alerta de fraude `stop_delivery_op_wh` **não segue** essa política e pode ser perdido. Não foi verificado se esse tópico está ativo na aplicação do cinema. Assim, o guard sintético que devolve 503 a todos os callbacks não é um mecanismo de corte aprovado; ele exige identificação dos tópicos ativos e uma estratégia de recebimento durável, sem processar finanças durante a pausa. O comportamento dos demais provedores também permanece por confirmar.

### Ensaio isolado na própria VPS e backup local — 05/11/2026

O Nginx 1.28.3 **da VPS** iniciou com uma configuração sintética em pasta temporária e porta `127.0.0.1` independente. O teste verificou nove classes de rota nas fases antes/corte/restauração: HTTP e upgrade WS Cine Cruzeiro receberam 503 durante o corte, os controles vizinhos permaneceram 200 e o webhook WhatsApp voltou ao 410 original. O processo de teste foi encerrado e sua pasta temporária removida. **A configuração ativa de Nginx não foi recarregada**, e o ensaio não mede sessões ou workers da release antiga.

Foi encontrado em Documentos o backup de 28/10/2026 com `postgres/cinecruzeiro.dump` (970.580 bytes) e `arquivos/cinecruzeiro.tar.gz` (394.398.549 bytes). Os SHA-256 dos dois arquivos conferem com o manifesto local; `pg_restore --list` reconhece as tabelas essenciais, incluindo `orders`, `payments`, `tickets` e `schema_migrations`. O tar contém releases, uploads e configuração, sem caminhos de membro com `..`; um de seus 22 links é o `current` absoluto apontando para a release antiga. Não extrair o tar inteiro em destino de teste sem tratar esse link. O backup **não foi restaurado** e antecede a janela de atualização, portanto não substitui um novo snapshot operacional.

A leitura restrita previamente autorizada mostrou que os três pedidos `pending_payment` correspondem a três pagamentos de cartão `pending`, cada um com identificador externo e referência do Mercado Pago; todos tinham cerca de 26 dias. Não há sinalizador local de reconciliação. Isso não determina o status atual das Orders no provedor. A verificação dos tópicos de webhook no painel autenticado também segue pendente.

1. Reproduzir a configuração **efetiva** do Nginx em ambiente isolado, após leitura de configuração autorizada. Usar backends sintéticos distintos por cinema; nenhuma credencial ou banco operacional.
2. Cobrir GET, POST, uploads, admin, API, webhook e upgrade WS no prefixo Cine Cruzeiro. Após o corte, nenhuma nova requisição deve chegar ao backend antigo. Checar prefixos vizinhos, caminhos semelhantes e fronteiras de barra final.
3. Abrir um request sintético prolongado e uma conexão WS antes do corte; medir separadamente novas entradas e sessões já estabelecidas. Demonstrar como cada uma termina ou é classificada antes de encerrar o processo.
4. Reproduzir um worker sintético com trabalho em andamento. Cancelar o próximo tick **não** pode ser confundido com conclusão do trabalho. Medir o tempo de espera e a condição de parada; classificar qualquer efeito cujo resultado permaneça incerto.
5. Testar falha no corte e retorno da configuração anterior. `nginx -t` e respostas dos outros cinemas são critérios necessários, mas não bastam para provar dreno ou retry de provedor.
6. Registrar matriz de callbacks por provedor, tempo máximo de indisponibilidade, mecanismo de consulta/reconciliação, operador e condição de STOP. A verificação não deve disparar chamada externa sem autorização específica.

## Evidência operacional que falta para decidir o Portão D

- Configuração e precedência reais das rotas Nginx, inventário dos processos Cine Cruzeiro e métricas de requests/WS/leases, lidos sob escopo aprovado.
- Ensaio sintético do corte sobre essa configuração, com controle negativo dos outros cinemas e do retorno.
- Procedimento observável de dreno da release antiga, inclusive requests externos e jobs já reivindicados.
- Política de retry/consulta dos callbacks e conciliação humana de estados incertos.
- Implementação e teste de retomada gradual. O startup `normal` atual não a fornece.

Se um item faltar, **Portão D permanece bloqueado**. Mesmo com D aprovado, o [Portão E](FASE13_AUTORIZACAO_ATUALIZACAO.md) exige backup novo e restauração operacional em destino isolado, sob autorização separada. A [ficha do Portão B](FASE13_AUTORIZACAO_ATUALIZACAO.md) continua sem aprovação e não há deploy implícito.
