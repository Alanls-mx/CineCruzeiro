# Mapa Inteligente da Arquitetura

Fase 22.4: [resultado](FASE22_RESULTADO_22_4.md) e [ramos financeiros efetivamente extraídos](FASE22_ROTAS_FINANCEIRAS_EXTRAIDAS.md). O webhook Mercado Pago desconhecido e as prévias comerciais ganharam handlers específicos; o PagBank ganhou caracterização ECDSA HTTP sem extração financeira ampla.

Fase 22.3: [cobertura financeira avançada](FASE22_COBERTURA_FINANCEIRA_AVANCADA.md), [matriz de concorrência](FASE22_MATRIZ_CONCORRENCIA.md) e [resultado da etapa](FASE22_RESULTADO_22_3.md) registram os failpoints PostgreSQL e os limites para a próxima extração.

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
| [Linha de base da modularização profunda](MODULARIZATION_BASELINE.md) | Você quer medir arquivos, funções, listeners, rotas candidatas e riscos no HEAD de referência. |
| [Fase 21: inventário ordenado de rotas](FASE21_INVENTARIO_ROTAS.md) | Você precisa da ordem real de `handleApi`, dos guards, contratos, escritores e lacunas antes de extrair rotas. |
| [Fase 21: plano de extrações](FASE21_PLANO_EXTRACOES.md) | Você quer o dispatcher composto, os portões de teste e o orçamento para reduzir `server.js` sem mover fluxos críticos prematuramente. |
| [Plano de modularização profunda](DEEP_MODULARIZATION_PLAN.md) | Você quer a sequência de extrações, módulos de destino, orçamento de linhas e critérios de equivalência. |
| [Preparação do Admin](ADMIN_MODULARIZATION_PLAN.md) | Você quer a linha de base de `admin.js`, contrato dos 14 módulos, estado, matriz de eventos/limpeza e sequência das próximas extrações. |
| [Extração financeira do Admin](ADMIN_FINANCIAL_UI_EXTRACTION_RESULT.md) | Você quer comparar linhas, módulos, contratos, testes e riscos dos fluxos de bilheteria, Point, bomboniere, ingressos e Clube. |
| [Resultado da modularização final do Admin](ADMIN_MODULARIZATION_RESULT.md) | Você quer comparar as linhas, os módulos de integração, eventos e apresentação, os testes e os limites restantes. |
| [Extração da infraestrutura HTTP](INFRASTRUCTURE_EXTRACTION_REPORT.md) | Você quer comparar linhas, módulos, contratos e verificações da etapa B01. |
| [Extração de catálogo e administração](CATALOG_ADMIN_EXTRACTION_REPORT.md) | Você quer comparar rotas, serviços, riscos, testes e linhas desta etapa. |
| [Extração comercial](COMMERCE_EXTRACTION_REPORT.md) | Você quer localizar preço, reservas, emissão, QR, Clube e a matriz de invariantes preservadas. |
| [Mapa transacional financeiro](FINANCIAL_TRANSACTION_MAP.md) | Você quer identificar commits, chamadas externas, chaves, recuperação, direitos e lacunas por fluxo. |
| [Fase 21: extração financeira dirigida](FASE21_EXTRACAO_FINANCEIRA.md) | Você quer ver os lotes extraídos, medições, failpoints e fluxos financeiros ainda bloqueados. |
| [Fase 21: persistência e lifecycle](FASE21_PERSISTENCIA_LIFECYCLE.md) | Você quer localizar a normalização por domínio, a fábrica do snapshot, os timers/workers e as ressalvas de shutdown. |
| [Auditoria final da Fase 21](../RELATORIO_FINAL_FASE21_BACKEND.md) | Você quer as métricas atuais, contratos exercitados, riscos financeiros, suites e decisão de encerramento do backend. |
| [Fase 22.1: mapa estrutural](FASE22_MAPA_ESTRUTURAL.md) | Você quer localizar funções dentro e fora do dispatcher, donos, efeitos, testes e limites de extração. |
| [Fase 22.1: resultado](FASE22_RESULTADO_22_1.md) | Você quer comparar reduções líquidas, módulos, testes e bloqueios dos primeiros lotes estruturais. |
| [Fase 22.2: contratos HTTP](FASE22_CONTRATOS_CONTEXTO_HTTP.md) | Você quer localizar ALS, identidade, logs, cookies, CSP, corpo e resposta após commit antes de mover infraestrutura. |
| [Fase 22.2: resultado](FASE22_RESULTADO_22_2.md) | Você quer comparar as extrações de ingresso, Studio, Wallet e corpo HTTP com testes e bloqueios. |
| [Fase 21: cobertura de falhas financeiras](FASE21_COBERTURA_FINANCEIRA.md) | Você quer localizar os testes de falhas parciais em PostgreSQL descartável, as invariantes verificadas e os bloqueios para novas extrações. |
| [Extração financeira dirigida](FINANCIAL_EXTRACTION_REPORT.md) | Você quer comparar módulos, linhas, testes de falha parcial e bloqueadores. |
| [Caracterização HTTP e do Admin](HTTP_CONTRACT_CHARACTERIZATION.md) | Você quer preservar respostas, cookies, origem, permissões e eventos antes das extrações. |
| [Relatório reproduzível da caracterização](MODULARIZATION_CHARACTERIZATION_REPORT.md) | Você quer contagens, cobertura, execução de testes e diferenças estáticas ante o snapshot. |
| [Histórico da modularização](../MODULARIZACAO_ARQUITETURA.md) | Você precisa entender decisões e pendências anteriores. |
| [Relatório consolidado](../RELATORIO_FINAL_REFATORACAO.md) | Você precisa da decisão formal, evidências e bloqueios residuais da Fase 8. |
| [Testes PostgreSQL](../TESTES_POSTGRESQL.md) | Você precisa configurar validação isolada. |
| [Fase 9](../FASE9_DESBLOQUEIO.md) | Você investiga a intenção Point, estornos ou o ensaio de restauração. |
| [Fase 10](../FASE10_PRE_HOMOLOGACAO.md) | Você prepara o portao de autorizacao, matrizes de integracao e a decisao de pre-homologacao. |
| [Caderno do piloto](../FASE10_CADERNO_PILOTO.md) | Você procura roteiro funcional, incidentes, backup/reversao ou checklist por cinema. |
| [Fase 11](../FASE11_HOMOLOGACAO_PILOTO.md) | Você procura a evidencia interna do Cine Cruzeiro confirmado como piloto, os limites do ambiente e a decisao A-E. |
| [Autorizacao do sandbox](../FASE11_AUTORIZACAO_SANDBOX.md) | Você precisa solicitar o primeiro teste externo sem assumir que a escolha do piloto libera pagamentos. |
| [Auditoria VPS Fase 12](../FASE12_AUDITORIA_VPS.md) | Você precisa do estado observado da instalacao LumixEngine, da release e do esquema, sem segredos. |
| [Plano de atualizacao Fase 12](../FASE12_PLANO_ATUALIZACAO.md) | Você precisa de preflight, backup, migracao, validacao e reversao antes de pedir autorizacao de deploy. |
| [Preflight Fase 13](../FASE13_PREFLIGHT_OPERACIONAL.md) | Você precisa das evidencias read-only de isolamento e dos bloqueios do Portao A. |
| [Matriz Fase 13](../FASE13_MATRIZ_ATUALIZACAO.md) | Você precisa dos criterios de parada e recuperacao por etapa. |
| [Runbook Fase 13](../FASE13_RUNBOOK_EXECUCAO.md) | Você prepara uma eventual janela operacional, sem executa-la. |
| [Ficha Portao B](../FASE13_AUTORIZACAO_ATUALIZACAO.md) | Você solicita autorizacao explicita por recurso e operacao; formulario vazio nao autoriza. |
| [Fase 13.1](../FASE13_1_FECHAMENTO_BLOQUEADORES.md) | Você avalia guard de migrations, startup quiescente e bloqueios restantes. |
| [Matriz 13.1](../FASE13_1_MATRIZ_ISOLAMENTO_PAUSA.md) | Você localiza entradas HTTP/WS/workers e as evidencias de pausa/isolamento. |
| [Portão D 13.2](../FASE13_2_PORTAO_D_CORTE_DRENO.md) | Você prepara o ensaio de corte e dreno da release antiga, sem operar a VPS. |
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
- Atualizacao da VPS existente: [preflight Fase 13](../FASE13_PREFLIGHT_OPERACIONAL.md), [matriz](../FASE13_MATRIZ_ATUALIZACAO.md), [runbook](../FASE13_RUNBOOK_EXECUCAO.md), [ficha](../FASE13_AUTORIZACAO_ATUALIZACAO.md), [deploy bloqueado para o piloto](../../scripts/deploy-all-vps.mjs), [ensaio PG18](../../scripts/postgres-upgrade-tests.js) e [operacoes](operations.md). Registro local de exemplo nao descreve os outros cinemas habilitados na VPS.

## Regra de manutenção

Ao modificar uma responsabilidade, confirme o endpoint e as permissões em [server.js](../../backend/server.js), o esquema em [migrations](../../backend/db/migrations/001_init.sql), os testes relevantes e os limites de commit. Atualize o domínio, o fluxo e o índice de módulos afetados. `npm run docs:check` verifica caminhos e símbolos curados; ele não valida a semântica das descrições ou detecta todos os consumidores. O [relatório da Fase 8](../FASE8_HOMOLOGACAO.md) registra lacunas e decisão de prontidão.
