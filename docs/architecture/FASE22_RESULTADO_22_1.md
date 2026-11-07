# Fase 22.1 — resultado das primeiras extrações estruturais

Branch `codex/cine-backend-desacoplamento`, originada de `fee9b6d0c124add36666eced7358093ed2261c2e` após conferir que o HEAD da branch de origem coincidia com esse SHA. Os workflows de segurança, E2E e PostgreSQL da **origem** estavam verdes; isso não é evidência de CI deste novo SHA. Nenhuma mudança foi feita em `main`, `backend/public/admin.js`, VPS, provedores, migrações ou bancos operacionais.

## Medição

`node scripts/measure-modularization.mjs --summary`, contando linhas físicas, comentários e espaços:

| Arquivo/bloco | Base | Atual | Redução |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 10.755 | 10.461 | 294 (2,73%) |
| `handleApi` | 3.261 | 3.261 | 0 |
| Fora de `handleApi` | 7.494 | 7.200 | 294 |
| `backend/public/admin.js` | 3.421 | 3.421 | 0 |

A meta final de 5.000 linhas ainda requer 5.461 linhas de redução; a meta indicativa desta etapa, 1.000–1.500 linhas, **não foi atingida**. Faltam 706 linhas para o limite inferior de 1.000. A [auditoria estrutural](FASE22_MAPA_ESTRUTURAL.md) identifica as funções, acoplamentos e testes necessários antes dos próximos lotes. Os módulos criados são específicos e pequenos, sem novo arquivo monolítico.

## Lotes concluídos

| Lote e commit | Responsabilidade transferida | Módulo | Redução líquida no servidor | Proteção e risco residual |
| --- | --- | --- | ---: | --- |
| Base `ea8df7e`; extração `0d53cc1` | Prefixo de instalação, URL pública de upload, allowlist de imagem editorial e URL do frontend. | [publicAssetPathService](../../backend/services/publicAssetPathService.js), 66 L | 53 | Teste antes/depois, import inerte, HTTP estático/PDF, segurança e smoke JSON. Risco: prefixo em instalações com path próprio. |
| `deda7e6` | Datas de São Paulo, janela de venda, status legível de sessão e dias do calendário. | [sessionScheduleReadService](../../backend/services/sessionScheduleReadService.js), 123 L | 118 | Janela e fallback caracterizados, catálogo HTTP, smoke JSON e PostgreSQL descartável. Risco: calendário de madrugada e diferença intencional da política de publicação. |
| Base `f7c06a6`; extração `5da96ac` | Resolução de sala para leitura, rótulo, assentos e tipos visíveis. | [roomReadProjectionService](../../backend/services/roomReadProjectionService.js), 43 L | 40 | Mapa de assentos HTTP e smoke JSON/PG. Validação de sala, holds e disponibilidade mutável ficaram no dono original. |
| `6bfd1ce` | Rótulos administrativos de pagamento, pedido, origem, método, provedor e campanha. | [commercialStatusLabelService](../../backend/services/commercialStatusLabelService.js), 86 L | 83 | Caracterização de rótulos e HTTP comercial. Estado persistido e reconhecimento financeiro não mudaram. Risco de regressão textual. |

O primeiro teste HTTP após a extração de rótulos detectou que uma `const` nova era avaliada depois da criação do PDF, onde uma função antiga era hoisted. O import foi antecipado e o teste voltou a passar antes do commit. Na suíte unitária, uma asserção estática antiga esperava a expressão de URL dentro de `server.js`; o teste foi atualizado para exigir a delegação no servidor e a expressão no módulo, enquanto os testes de comportamento de URL permaneceram. A falha inicial e a correção não foram omitidas.

Funções transferidas, endpoint, permissão, persistência e testes estão registrados também em [módulos](modules.md), [endpoints](endpoints.md), [fluxos](flows.md), [dependências](dependencies.md) e [persistência](persistence.md). As quatro extrações não são handlers de rota: os endpoints e guards permaneceram nos módulos/dispatcher originais. Nenhuma nova dependência circular com `server.js` foi introduzida. Os factories novos não fazem I/O ou iniciam timer no import.

## Validação local

| Comando | Resultado |
| --- | --- |
| `npm run test:characterization` | 28/28 aprovados, 0 ignorados; inclui os testes da Fase 22. |
| Testes dirigidos por lote | Aprovados após cada extração; contratos HTTP de estáticos, catálogo, salas e rótulos. |
| `npm run test:unit` | Código 0 após corrigir a asserção estrutural; suites internas incluem testes ignorados por condição de ambiente. |
| `npm run test:security:local` | 25/25 aprovados mais scripts locais. |
| `npm run test:finance` | 54/54 aprovados com provedores simulados. |
| `npm run test:maintenance` | 9/9 aprovados. |
| `npm run test:legacy:json` | Código 0 com fixture isolada. |
| `npm run lint`, `npm run build` | Código 0. |
| `npm run test:e2e` | 19/19 aprovados em ambiente local. |
| `npm run docs:check` | Código 0 antes da documentação final; reexecutar após concluir o relatório. |
| `node scripts/with-local-disposable-postgres.js smoke concurrency repositories guard` | Código 0 no harness protegido. Smoke, concorrência, repositórios 11/11 e `PG_GUARDED_MIGRATION_OK`; contêiner descartável criado e removido pelo script. |

Os testes não representam homologação com Mercado Pago, PagBank, Wallet ou SMTP reais. A Fase 22.1 não modificou a ordem intenção→commit→provedor→commit, idempotência, direitos/estoque ou o reconhecimento do webhook Order após commit (`9f7cefb`). `backend/start.js` quiescent e os bloqueios da Fase 13 continuam intactos.

## Decisão e próximos lotes

Os 294 L removidos são uma redução real de funções usadas. As demais funções volumosas não são candidatas equivalentes apenas por tamanho: `normalizeDb` ainda expira reservas e semeia owner; `requestContext` coordena autenticação, auditoria e resposta; CRM e testes de integração lidam com outbox/provedor; `reconcileOnlineCheckoutOrder`, Point, Clube, ingresso e a parte financeira do dispatcher dependem de commits, leases e autorização. [Matriz financeira](FASE21_COBERTURA_FINANCEIRA.md) e [mapa de transações](FINANCIAL_TRANSACTION_MAP.md) registram lacunas de failpoints. Não transferi esses blocos sob cobertura insuficiente.

Próximas ações dirigidas: (1) caracterizar projetores sem I/O de Social Studio e ingresso, inclusive redaction/PII; (2) proteger os efeitos temporais remanescentes de `normalizeDb` em JSON e PG; (3) testar shutdown HTTP/WS com trabalho em curso; (4) completar failpoints de PagBank/Point/reembolso antes de mover coordenação financeira; (5) repetir medição e contratos a cada lote. A meta de 3.000–5.000 linhas continua aberta. Não há autorização operacional implícita nesta etapa.
