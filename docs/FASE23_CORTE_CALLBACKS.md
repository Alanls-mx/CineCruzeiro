# Fase 23 — dreno, callbacks e retomada: portão ainda bloqueado

## Reavaliação em 09/11/2026

O preflight SSH **somente de leitura** confirmou que `current` aponta para a release `20261105-221045-6d216eb`, manifesto `6d216eb5fb956bba88d9726b3cf7aaaf8de86f8b`. O código desse SHA foi lido no objeto Git local: ao receber SIGTERM/SIGINT, ele cancela timers e chama `server.close`, mas força a saída após dez segundos. Não registra o término de requisições, WebSockets, jobs ou efeitos externos já iniciados. Portanto, a versão candidata não pode servir de prova do dreno da versão instalada. Nenhum processo remoto foi sinalizado.

O inventário agregado do banco exclusivo `cinecruzeiro` encontrou **três pedidos `pending_payment` e três pagamentos Mercado Pago `pending`**, criados em 09–10/10. As filas consultadas não mostraram leases travados nem holds ativos naquele instante. Esse retrato não demonstra ausência de operações em curso nem resolve os três pagamentos; é necessária conciliação individual autorizada antes de abrir checkout. Não foram lidos dados pessoais, IDs nem valores.

A candidata passou a oferecer `CINE_CONTROLLED_STARTUP=1`, com portão HTTP/WebSocket e promoção local de **uma** etapa por SIGUSR2: `preflight → auth → callbacks → checkout → workers → full`. Sem a opção, o startup anterior permanece. `health/live` responde 200 durante o preflight, mas `health`/`ready` ficam 503 até `full`, para não apresentar a release como pronta antes da promoção. No estágio `callbacks`, o reconciliador online começa; `workers` liga e-mail/CRM; `full` liga manutenção, Studio e demais integrações. A promoção é somente do processo Cine Cruzeiro e precisa ser observada nos eventos `release.startup_stage_changed`. Reinício volta a `preflight`. [Testes](../tests/controlled-startup-service.test.mjs) e [HTTP/WebSocket](../tests/controlled-startup-http.test.mjs) demonstram o bloqueio e a ordem local, **não** o corte entre releases. As três pendências antigas podem não possuir a intenção durável da candidata e não devem ser consideradas reconciliadas por esse timer.

Os handlers atuais consultam a autoridade e persistem as transições conhecidas antes do 200, porém **não existe inbox durável comum** para todos os callbacks durante a troca; alguns eventos sem referência retornam 200 sem registro. A [documentação oficial de Orders do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications) descreve resposta 200/201 em até 22 segundos e novas tentativas após ausência de confirmação, mas isso não cobre automaticamente todos os tópicos opcionais ou o PagBank. A [documentação PagBank de autenticidade](https://developer.pagbank.com.br/reference/validacao-de-autenticidade) exige validar a assinatura antes de atualizar estados; não foi encontrada garantia aplicável de reenvio para todos os eventos usados aqui. Assim, 503 no intervalo de corte não é uma estratégia demonstrada. **Portão D permanece NO-GO.**

Faltam ensaio sintético com o SHA antigo, proxy, PG descartável, request/WS/job/callback em andamento; escolha supervisionada entre parada com conciliação ou release intermediária; e prova de recuperação de callback PagBank/estorno. Nenhuma das alternativas foi executada remotamente.

## Registro anterior à verificação da VPS

Este documento define o ensaio necessário antes de trocar a release da instalação de desenvolvimento Cine Cruzeiro. A configuração da VPS e a release em execução não foram consultadas nesta etapa. O teste sintético de Nginx da Fase 13.2 demonstra precedência do prefixo e isolamento dos cinemas vizinhos, mas não observa trabalho já aceito pelo processo antigo.

**Reavaliação da candidata:** `backendRuntimeSchedule.stop()` cancela disparos futuros, mas `runObserved` não aguarda as promessas em curso. `backend/start.js` em `normal` carrega `server.js` e dispara os workers sem portões separados. O reconciliador novo recupera pagamentos online por consulta quando a autoridade permite; ele não torna duráveis callbacks de reembolso nem drena retrospectivamente a release instalada. Os objetos Git `6d216eb` e `ea7c5df` são referências históricas disponíveis localmente, não prova de qual SHA roda hoje. Não foi feito ensaio integrado com a release instalada. **Portão D: bloqueado.**

| Superfície | Condição para dreno observável | Situação |
| --- | --- | --- |
| HTTP/SSE | Bloquear novas mutações no prefixo; contar requests com efeito ainda ativos, IDs de operação e conclusão/estado incerto antes do encerramento. | Release antiga não fornece prova integral. |
| WebSocket | Recusar upgrades novos e fechar/contar conexões antigas, incluindo holds de poltrona. | `server.close()` isolado não basta. |
| Workers | Impedir novos claims, registrar jobs em andamento e aguardar efeito externo ou marcar inconclusivo com identidade preservada. | `stop()` de timer não prova conclusão. |
| Point/checkout/refund | Conferir claims, leases e intenções por identidade; nenhum retry com chave nova. | A intenção online candidata é durável; a release antiga não ganha essa garantia retroativamente. |
| Callbacks MP/PagBank | Receber e confirmar somente após persistência durável, conservar material para verificação de assinatura, deduplicar e consultar autoridade antes de liberar direitos. | O processo `quiescent` devolve 503; reenvio de todos os eventos não foi comprovado. |
| Retomada | Liberar leitura, autenticação, checkout, callbacks, workers e integrações em etapas observáveis, com reconciliação prévia das intenções incertas. | O modo `normal` atual inicia as categorias juntas. |

## Ensaio de corte exigido

Usar PostgreSQL descartável e proxy isolado com uma release antiga **representativa da instalada**, uma candidata e simuladores de provedor. Manter request prolongado, WS e job em andamento antes do bloqueio; injetar callback assinado e operação financeira inconclusiva durante o corte; repetir com falha de troca e falha de retomada. Verificar estados por SQL, uma identidade por operação, zero direitos antecipados, ausência de callback perdido e respostas inalteradas dos quatro cinemas vizinhos. O teste de prefixo já existente é apenas um componente; não representa essa prova integrada.

Se a release antiga não expõe requests/jobs ativos nem impede novos claims, manter **NO-GO** até construir uma etapa intermediária de dreno observável ou planejar parada com reconciliação individual de todas as operações inconclusivas sob janela e responsável específicos. Não inferir segurança da ausência momentânea de sockets. A liberação de callbacks requer conhecer os tópicos efetivamente configurados e uma estratégia de persistência/consulta para os eventos que não forem reenviados; devolver 503 indiscriminadamente não é recuperação.

Antes de qualquer comando remoto, refazer o inventário exclusivo do Cine Cruzeiro, validar Nginx e vizinhos, obter autorização operacional de janela/limites/reversão, criar backup atual e demonstrar restore isolado. A dispensa do ensaio manual dos provedores permanece **dispensada, não executada** e não dispensa dreno, callback ou reconciliação local.
