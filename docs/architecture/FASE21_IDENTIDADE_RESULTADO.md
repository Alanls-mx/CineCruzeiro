# Fase 21 — resultado da extração de identidade

Branch: `codex/cine-backend-finalizacao`. Base desta etapa: `7184865` (11.991 linhas em `backend/server.js`, 4.313 em `handleApi`). Este relatório descreve a branch, não produção nem prontidão de implantação. [Contratos caracterizados](FASE21_IDENTIDADE_CONTRATOS.md).

## Medida reproduzível

`node scripts/measure-modularization.mjs --summary`, sem excluir comentários nem compactar código:

| Arquivo/função | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| `backend/server.js` | 11.991 | 11.139 | 852 (7,1%) |
| `handleApi` | 4.313 | 3.452 | 861 (20,0%) |
| `backend/public/admin.js` | 3.421 | 3.421 | 0 |

A meta indicativa de cerca de 10.000 linhas **não foi atingida**. Restam 1.139 linhas para esse valor. Não houve compressão do código. Os cinco novos módulos somam 1.145 linhas (contagem inclui comentários e linhas vazias):

| Módulo | Linhas | Responsabilidade e posição |
| --- | ---: | --- |
| [adminSessionRoutes](../../backend/services/adminSessionRoutes.js) | 186 | Login, challenge 2FA, logout e GET me antes do guard central. |
| [adminAccountRoutes](../../backend/services/adminAccountRoutes.js) | 294 | Perfil, senha, 2FA e política depois do guard. |
| [customerAuthRoutes](../../backend/services/customerAuthRoutes.js) | 275 | Registro, login, sessão e recuperação. |
| [customerAccountRoutes](../../backend/services/customerAccountRoutes.js) | 260 | Perfil e verificação/troca de e-mail. |
| [userAccountModelService](../../backend/services/userAccountModelService.js) | 130 | Normalização, validação e projeção sem I/O. |

Factories recebem dependências explicitamente; não importam `server.js`, não criam sessão, conexão, worker ou timer no import. Cada handler ocupa a posição da família original; `ensureAdmin`, origem/CSRF, rate limits e seleção transacional permanecem no dispatcher. Não foram alterados métodos, caminhos, payloads financeiros, cookies, provedores, webhooks ou migrations. O tamanho dos novos módulos está abaixo do teto de atenção arquitetural de 800–1.200 linhas.

## Commits independentes

| Commit | Extração |
| --- | --- |
| `bdf6178` | Sessão Admin e caracterização inicial. |
| `86a8f07` | Conta e 2FA Admin. |
| `da234b2` | Credenciais e recuperação de cliente. |
| `61c0908` | Perfil e e-mail de cliente. |
| `8e86636` | Modelo de conta e ampliação do HTTP dirigido. |

## Evidência de equivalência

O teste [phase21-identity-http](../../tests/phase21-identity-http.test.mjs) inicia um backend JSON em diretório temporário e verifica login Admin/cliente, cookie HttpOnly/SameSite, 2FA TOTP, challenge replay, rotação/revogação, 401/403/429, CSRF/origem, perfil, reset, troca de e-mail, usuário desativado e autorização da equipe. [customer-registration-http](../../tests/customer-registration-http.test.mjs) conserva validações de cadastro e dados numéricos. [user-account-model-service](../../tests/user-account-model-service.test.mjs) protege normalização e remoção de segredos. O teste sintético de cinco instalações passou. O código não foi comparado contra um provedor real.

| Comando executado nesta branch | Resultado |
| --- | --- |
| `npm run test:permissions` | 4/4. |
| `npm run test:characterization` | 16/16. |
| `npm run test:unit` | Passou; suites condicionais PostgreSQL foram ignoradas sem `TEST_DATABASE_URL`, conforme o próprio runner. |
| `npm run test:security:local` | Passou; TAP principal 25/25 e scripts complementares. |
| `npm run test:multi-cinema:synthetic` | 5/5. |
| `npm run lint` | Passou (`tsc --noEmit`). |
| `npm run build` | Passou (Next.js). |
| `npm run test:e2e` | 19/19; avisos de CSP/eval em modo dev sem falha de caso. |
| `npm run docs:check` | Passou, 37 documentos com links locais existentes. |
| `node scripts/with-local-disposable-postgres.js smoke` | **Não executado:** Docker Desktop Linux Engine indisponível (`npipe` ausente). Nenhum banco operacional foi acessado. |

`npm run docs:modularization:report` foi executado, mas seu bloco de “execuções registradas” contém histórico da base e não deve ser interpretado como execução PostgreSQL desta etapa. Os testes acima são os efetivamente realizados. O workflow [Security regression do SHA `458a51f`](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/42393161060) concluiu com sucesso, incluindo segurança local, permissões, finanças, manutenção, documentação, lint e build. Esse workflow não executa smoke PostgreSQL nem E2E; essas evidências estão separadas na tabela.

## Pendências e próximo lote

- O callback Google OAuth e o handoff mobile continuam no dispatcher: exigem caracterização HTTP com Google simulado, estado/cookie, conflito de identidade, replay e falha do provedor antes da extração.
- `DELETE /api/users/:id` continua no dispatcher porque desvincula assinaturas, créditos e pedidos; faltam testes de vínculos, concorrência e rollback em PostgreSQL descartável.
- Os guards de sessão/CSRF, rate limits, permissões e cookies continuam centrais intencionalmente. Movê-los só para reduzir linhas alteraria a autoridade e a ordem 401/428/403.
- Falta repetir smoke e cenários de conta/2FA em PostgreSQL descartável quando Docker estiver disponível. As verificações JSON e E2E não substituem esse portão.
- Faltam testes HTTP de envio de e-mail falho em produção simulada, expiração por relógio controlado e troca da política 2FA em papéis distintos. As rotas relacionadas preservaram código/slot, mas essa cobertura é necessária antes de novas mudanças nelas.

Classificação deste lote: **aprovado com ressalvas para continuidade local**; a meta de linhas e o portão PostgreSQL permanecem abertos. Não houve merge, deploy, migration, pagamento ou acesso à VPS.
