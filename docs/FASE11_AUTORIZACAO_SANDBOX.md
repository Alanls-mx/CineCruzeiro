# Fase 11 - ficha de autorizacao do primeiro sandbox

Esta ficha **nao e uma autorizacao**. A selecao do piloto Cine Cruzeiro esta confirmada; o nivel B ainda depende de aprovacao explicita para cada servico, ambiente e operacao. Nivel C (terminal/impressora fisicos, VPS, banco existente, dinheiro real, email externo ou publicacao) exige uma autorizacao separada. Ver [relatorio](FASE11_HOMOLOGACAO_PILOTO.md) e [portao geral](FASE10_CADERNO_PILOTO.md#portao-de-autorizacao).

| Campo a confirmar pelo responsavel | Proposta / estado |
| --- | --- |
| Cinema | Cine Cruzeiro (`cinecruzeiro`), piloto confirmado. |
| Versao candidata | SHA final da branch `codex/modularize-server-admin`, a fixar apos CI verde. |
| Primeiro provedor | Mercado Pago Point via Orders API de teste; **nao autorizado**. |
| Aplicacao e ambiente | ID da aplicacao de teste e conta de teste vinculada: **pendentes**; nunca usar conta/credencial operacional. |
| Credenciais | Access Token de teste por canal seguro, fora do Git/relatorio/logs: **pendente**. |
| Terminal | Virtual compativel com `SBX0000001`, modelo/ID exato a confirmar com a conta; nenhum terminal fisico. |
| Operacoes propostas | P01-P04 (criar e simular pendente/aprovado/recusado), P08 (mesma requisicao/chave), P17 (consultar por Order ID). Aprovacao deve enumerar exatamente quais delas sao permitidas; cancelamento/refund, 202 e eventos adicionais precisam de permissao nominal. |
| Valores e limite | Valor sintetico por Order, teto agregado e quantidade maxima: **pendentes**; nenhuma cobranca real. |
| Webhook de teste | URL HTTPS exclusiva, segredo e origem da aplicacao de teste, sem apontar para producao: **pendentes**. Validar assinatura e correlacao; nao usar callback operacional. |
| Rede e dados | Host/rota isolados, saida apenas ao provedor de teste, PostgreSQL descartavel marcado, usuarios `.invalid`, sem PII/cartao real. |
| Responsavel/observador | Nomes e canal de escalonamento: **pendentes**. |
| Janela | Inicio, termino e fuso horario: **pendentes**. |
| Parada | Qualquer referencia/valor/terminal divergente, duplicidade, aprovacao sem commit, segredo operacional, webhook invalido, estado incerto sem recuperacao. |
| Recuperacao | Preservar Order ID, chave, referencia, status, horario e logs sanitizados; nao gerar nova chave para corrigir incerteza; conciliacao pelo responsavel. |
| Evidencia | SHA, ambiente, operacao aprovada, request/response sanitizados, status antes/depois, webhook autenticado, estado local e limpeza do banco descartavel. |

O [Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/mp-point/integration-test) descreve simulacao com terminal virtual e credenciais de teste, mas o dispositivo virtual nao substitui medicao em terminal produtivo. A [Orders API](https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/migrate-payment-intent-to-orders) usa `X-Idempotency-Key`; manter a mesma identidade em retry e nao supor validade infinita. Antes da primeira chamada B, revisar novamente os contratos, confirmar os campos pendentes, registrar aprovacao escrita e criar um ambiente de teste separado. Se qualquer campo necessario estiver ausente, a execucao continua bloqueada.
