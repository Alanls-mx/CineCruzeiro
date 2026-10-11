# Mapa Inteligente da Arquitetura

Índice inicial verificado na Fase 5. **Não é um inventário completo**. O código-fonte prevalece sobre este mapa.

| Entrada | Use quando |
| --- | --- |
| [Domínios](domains.md) | Você conhece a funcionalidade ou termos de busca. |
| [Módulos](modules.md) | Você procura um arquivo, serviço, handler, repositório ou teste. |
| [Fluxos](flows.md) | A mudança atravessa interface, API, transação e tarefas. |
| [Operação assíncrona](operations.md) | Você investiga recuperação de e-mails ou campanhas. |
| [Histórico da modularização](../MODULARIZACAO_ARQUITETURA.md) | Você precisa entender decisões e pendências anteriores. |
| [Testes PostgreSQL](../TESTES_POSTGRESQL.md) | Você precisa configurar validação isolada. |
| [Instalações](../../config/cinema-instances.example.json) | Você precisa distinguir configuração compartilhada e específica. |

## Navegação por intenção

- Validade de cupom: [domínio Promoções](domains.md), [couponLifecycleService](../../backend/services/couponLifecycleService.js), [teste](../../tests/coupon-lifecycle.test.mjs).
- Devolução de créditos: [fluxo Clube](flows.md), [clubDomainService](../../backend/services/clubDomainService.js), [smoke PostgreSQL](../../scripts/smoke-tests.js).
- Botão no painel: [módulos do painel](modules.md), [admin.html](../../backend/public/admin.html), [admin.js](../../backend/public/admin.js), E2E em [e2e](../../e2e/core-navigation.spec.js).
- Disponibilidade de poltronas: [sessionSeatAvailability](../../backend/services/sessionSeatAvailability.js), [teste](../../tests/session-seat-availability.test.mjs).
- Emissão e entrega de ingressos: [fluxo de compra](flows.md), [operação assíncrona](operations.md).
- Webhook Mercado Pago: [fluxo de compra](flows.md), [paymentService](../../backend/services/paymentService.js), [teste de assinatura](../../scripts/mercado-pago-webhook-tests.js).

## Regra de manutenção

Ao modificar uma responsabilidade, confirme o endpoint e as permissões em [server.js](../../backend/server.js), o esquema em [migrations](../../backend/db/migrations/001_init.sql), os testes relevantes e os limites de commit. Atualize o domínio, o fluxo e o índice de módulos afetados. `npm run docs:check` verifica a existência dos caminhos linkados; ele não valida a semântica das descrições.
