# Mapa Inteligente da Arquitetura

Índice progressivo verificado no código. **Não é um inventário completo**. O código-fonte prevalece sobre este mapa. `npm run docs:coverage` mede o escopo bruto sem confundir caminhos candidatos com rotas ativas.

| Entrada | Use quando |
| --- | --- |
| [Domínios](domains.md) | Você conhece a funcionalidade ou termos de busca. |
| [Módulos](modules.md) | Você procura um arquivo, serviço, handler, repositório ou teste. |
| [Fluxos](flows.md) | A mudança atravessa interface, API, transação e tarefas. |
| [Operação assíncrona](operations.md) | Você investiga recuperação de e-mails ou campanhas. |
| [Endpoints](endpoints.md) | Você precisa conferir método, estado, autenticação, persistência e teste de uma rota verificada. |
| [Persistência](persistence.md) | Você precisa localizar as tabelas e os responsáveis por leitura/escrita. |
| [Auditoria transacional](transactions.md) | Você investiga resposta antes do commit ou efeito externo. |
| [Símbolos](symbols.md) | Você precisa de um ponto de entrada técnico validado no código. |
| [Dependências](dependencies.md) | Você quer avaliar impacto entre serviço, API, tabela, evento e painel. |
| [Exercícios de navegação](navigation.md) | Você quer verificar como o mapa orienta solicitações reais. |
| [Auditoria estrutural](audit.md) | Você quer entender a ordem das extrações e as responsabilidades adiadas. |
| [Histórico da modularização](../MODULARIZACAO_ARQUITETURA.md) | Você precisa entender decisões e pendências anteriores. |
| [Relatório consolidado](../RELATORIO_FINAL_REFATORACAO.md) | Você precisa da decisão formal, evidências e bloqueios residuais da Fase 8. |
| [Testes PostgreSQL](../TESTES_POSTGRESQL.md) | Você precisa configurar validação isolada. |
| [Fase 9](../FASE9_DESBLOQUEIO.md) | Você investiga a intenção Point, estornos ou o ensaio de restauração. |
| [Fase 10](../FASE10_PRE_HOMOLOGACAO.md) | Você prepara o portao de autorizacao, matrizes de integracao e a decisao de pre-homologacao. |
| [Caderno do piloto](../FASE10_CADERNO_PILOTO.md) | Você procura roteiro funcional, incidentes, backup/reversao ou checklist por cinema. |
| [Fase 11](../FASE11_HOMOLOGACAO_PILOTO.md) | Você procura a evidencia interna do Cine Cruzeiro confirmado como piloto, os limites do ambiente e a decisao A-E. |
| [Autorizacao do sandbox](../FASE11_AUTORIZACAO_SANDBOX.md) | Você precisa solicitar o primeiro teste externo sem assumir que a escolha do piloto libera pagamentos. |
| [Instalações](../../config/cinema-instances.example.json) | Você precisa distinguir configuração compartilhada e específica. |

## Navegação por intenção

- Validade de cupom: [domínio Promoções](domains.md), [couponLifecycleService](../../backend/services/couponLifecycleService.js), [teste](../../tests/coupon-lifecycle.test.mjs).
- Devolução de créditos: [fluxo Clube](flows.md), [clubDomainService](../../backend/services/clubDomainService.js), [smoke PostgreSQL](../../scripts/smoke-tests.js).
- Botão no painel: [módulos do painel](modules.md), [admin.html](../../backend/public/admin.html), [admin.js](../../backend/public/admin.js), E2E em [e2e](../../e2e/core-navigation.spec.js).
- Disponibilidade de poltronas: [sessionSeatAvailability](../../backend/services/sessionSeatAvailability.js), [teste](../../tests/session-seat-availability.test.mjs).
- Emissão e entrega de ingressos: [fluxo de compra](flows.md), [operação assíncrona](operations.md).
- Webhook Mercado Pago: [fluxo de compra](flows.md), [paymentService](../../backend/services/paymentService.js), [teste de assinatura](../../scripts/mercado-pago-webhook-tests.js).
- Cobrança Point inconclusiva: [fluxo presencial](flows.md), [limites de commit](transactions.md), [smoke PostgreSQL](../../scripts/smoke-tests.js).
- Backup/restauração: [procedimento protegido](../TESTES_POSTGRESQL.md), [ensaio sintético](../../scripts/postgres-backup-restore-test.js).
- Google Wallet e isolamento de marca: [layout](../../backend/services/googleWalletPassLayoutService.js), [teste](../../tests/google-wallet-integration.test.mjs), [portao externo](../FASE10_CADERNO_PILOTO.md#outras-integracoes).
- Impressao Point e descricao da Order: [provedor](../../backend/services/cardTerminalProvider.js), [fluxo](flows.md), [teste local](../../scripts/mercado-pago-point-tests.js), [limites do piloto](../FASE11_HOMOLOGACAO_PILOTO.md#alteracao-dirigida).

## Regra de manutenção

Ao modificar uma responsabilidade, confirme o endpoint e as permissões em [server.js](../../backend/server.js), o esquema em [migrations](../../backend/db/migrations/001_init.sql), os testes relevantes e os limites de commit. Atualize o domínio, o fluxo e o índice de módulos afetados. `npm run docs:check` verifica caminhos e símbolos curados; ele não valida a semântica das descrições ou detecta todos os consumidores. O [relatório da Fase 8](../FASE8_HOMOLOGACAO.md) registra lacunas e decisão de prontidão.
