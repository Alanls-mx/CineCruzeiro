# Fase 23 — dreno, callbacks e retomada: portão ainda bloqueado

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
