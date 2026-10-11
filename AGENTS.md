# Guia para agentes: CineCruzeiro

1. Comece pelo [Mapa Inteligente](docs/architecture/README.md). Procure a intenção em `domains.md`, localize entrada e dono em `endpoints.md`/`modules.md`, e siga `flows.md`.
2. Antes de editar, confira no código a implementação, o impacto em `dependencies.md`, a permissão, os escritores em `persistence.md` e o limite em `transactions.md`. O código-fonte é a fonte definitiva; corrija qualquer divergência do mapa.
3. Preserve arquivos locais não relacionados. Não use bancos operacionais para testes; os testes PostgreSQL destrutivos exigem `TEST_DATABASE_URL` e a proteção de banco descartável.
4. Não altere autenticação, CSRF, permissões, contratos HTTP, pagamentos ou webhooks por refatoração cosmética. Verifique os limites de transação antes de responder sucesso ou iniciar tarefas externas.
5. Para um módulo novo ou uma responsabilidade extraída, registre arquivo, endpoint, permissão, persistência, testes e riscos no mapa. Não use números de linha como referência permanente. Execute testes dirigidos antes da suíte ampla e atualize o relatório.
6. Valide com testes direcionados, `npm run test:unit`, `npm run test:security:local`, `npm run lint`, `npm run build`, `npm run docs:check` e, quando aplicável, E2E e PostgreSQL descartável.
7. As cinco instalações compartilham código, mas têm configurações, credenciais e bancos independentes. Não fixe marca, domínio ou segredo em módulo compartilhado.
8. Nesta fase, não faça deploy nem integre à `main` automaticamente.
