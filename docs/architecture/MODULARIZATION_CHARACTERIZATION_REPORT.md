# Relatório reproduzível de caracterização

- `backend/server.js`: 17324 linhas (859670 bytes); `backend/public/admin.js`: 11980 linhas (627415 bytes).
- Critérios estáticos de rota: 229; literais `/api/`: 298 ocorrências, 130 valores distintos. São candidatos, não endpoints verificados.
- Entradas método/caminho verificadas manualmente em `endpoints.md`: 32; o catálogo declara cobertura parcial.
- Módulos de rotas já extraídos: 4; módulos Admin: 14.
- Outros arquivos próprios acima do limite de atenção de 600 linhas: 17 (excluídos os dois alvos principais e a biblioteca vendorizada jsQR).
- Domínios com testes identificados: 22/22; a presença de teste não prova cobertura completa.
- Comandos: 12 aprovados, 0 falhos, 1 não executados; contagens TAP somadas por execução (podem repetir testes entre comandos): 329 aprovados, 0 falhos, 10 ignorados.
- Diferença estática ante o snapshot: predicados +0/-0; caminhos +0/-0. Mudança de dono também aparece como diferença e exige revisão manual de contrato.

## Arquivos acima do limite de atenção

- `backend/public/admin.css`: 10226 linhas
- `scripts/smoke-tests.js`: 3476 linhas
- `backend/public/admin.html`: 3299 linhas
- `backend/public/admin-premium.css`: 2879 linhas
- `backend/public/social-studio.js`: 2172 linhas
- `src/components/CheckoutPage.tsx`: 1963 linhas
- `backend/db/postgresStore.js`: 1727 linhas
- `backend/public/social-studio.css`: 1691 linhas
- `src/app/globals.css`: 1237 linhas
- `backend/services/socialStudioService.js`: 1133 linhas
- `src/services/cinemaApi.ts`: 1023 linhas
- `backend/services/paymentService.js`: 920 linhas
- `src/app/conta/page.tsx`: 785 linhas
- `backend/services/emailService.js`: 760 linhas
- `backend/services/emailCampaignRepository.js`: 680 linhas
- `src/components/AccountModal.tsx`: 637 linhas
- `src/app/conta/ingressos/page.tsx`: 631 linhas

## Execuções registradas

- `npm run test:unit`: passed — 17 resumos TAP; 10 casos PostgreSQL condicionais foram ignorados sem TEST_DATABASE_URL. Suites PG independentes foram executadas em bancos descartáveis.
- `npm run test:characterization`: passed — Também contida em test:unit; cobre política de acesso/origem, paginação efetiva, estáticos locais e proteção do bootstrap Docker.
- `npm run test:security:local`: passed — Assinatura webhook, imagem e WebSocket locais também passaram.
- `npm run test:finance`: passed — Também contida em test:unit; contagem não é única.
- `npm run lint`: passed
- `npm run build`: passed
- `npm run test:e2e`: passed — Playwright local em JSON temporário; avisos de eval/CSP do modo dev, sem falha de caso.
- `node scripts/with-local-disposable-postgres.js smoke concurrency repositories`: passed — Smoke e concorrência informam sucesso sem total TAP; 11/11 é somente a suite de repositórios. PostgreSQL 16 local com contêiner e banco descartáveis removidos.
- `node scripts/with-local-disposable-postgres.js guard`: passed — PG_GUARDED_MIGRATION_OK: alvo alternativo intacto, rollback de lock e um vencedor concorrente.
- `node scripts/with-local-disposable-postgres.js --pg18 upgrade`: passed — PG18_UPGRADE_OK: 50 migrations, 48 anteriores, 3 pedidos sintéticos.
- `npm run test:postgres:backup-restore`: skipped — pg_dump e pg_restore não disponíveis no host Windows; o job PostgreSQL de CI executa este teste dentro do serviço descartável.
- `npm run docs:check`: passed — 23 documentos e links locais válidos.
- `npm run docs:modularization:report`: passed — Snapshot estático sem drift de rotas; medição reproduzível.

## Pré-requisitos e CI

- Primeiro contêiner PG16: Falhou ao conectar durante reinício temporário do PostgreSQL na inicialização; contêiner removido e espera pelo postmaster final adicionada. Repetição passou.
- Upgrade em PG16: Recusado pelo próprio ensaio, que exige PG18. O contêiner foi removido; repetição em PG18 passou.
- CI do commit anterior `16189b4469f7b3d767abe701bdb6a3e7e5f66127`: Security regression success (run 42125375781). PostgreSQL integration e Browser E2E antes filtravam somente codex/modularize-server-admin; esta mudança inclui a branch de trabalho. Resultado do commit atual depende de push e execução de CI.

## Mudanças estáticas

Nenhuma diferença estática.
