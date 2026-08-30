# Auditoria tecnica, hardening e correcoes

Revisao realizada em 30 de agosto de 2026 sobre frontend Next.js, backend Node.js, Admin, PostgreSQL, pagamentos, Clube, poltronas, fiscal, e-mail, deploy e operacao.

## Problemas encontrados

| Severidade | Arquivo/area | Causa | Consequencia |
| --- | --- | --- | --- |
| Alta | `package.json` | Next 16.3.2 anterior ao patch de seguranca 16.3.3 e Node minimo nao declarado | Deploy vulneravel ou em runtime incompatível |
| Alta | `backend/server.js` | Mutacoes administrativas podiam ler snapshot antes do lock PostgreSQL | Atualizacoes concorrentes poderiam sobrescrever estado recente |
| Alta | `backend/db/postgresStore.js` | `subscription_usage.credits_used` nao era persistido | Cancelar pacote de 3 ingressos devolvia apenas 1 credito |
| Alta | `backend/server.js` | Troca de sala aceita mesmo com poltronas vendidas | Ticket e mapa poderiam divergir |
| Media | `backend/server.js` | Origin/Referer ausentes eram aceitos em producao | Protecao CSRF incompleta para mutacoes autenticadas por cookie |
| Media | `backend/server.js` | Health verificava apenas o processo | Deploy podia promover backend sem banco/migration pronta |
| Media | `backend/server.js` | Manutencao gravava estado durante requests e o fallback JSON nao tinha mutex | Escrita redundante e corrida no desenvolvimento/teste |
| Media | Operacao | Nao havia backup/restore testavel nem alerta simples documentado | Recuperacao e deteccao de falha dependiam de operacao manual |
| Baixa | `next.config.mjs` | `127.0.0.1` nao estava permitido no dev server | E2E local carregava HTML, mas tinha chunks bloqueados |
| Baixa | Documentacao | README ainda informava Node 18 e nao descrevia readiness/DR | Operacao poderia usar premissas antigas |

## Problemas corrigidos

- Next atualizado para 16.3.3; `engines.node` definido como `>=20.9.0 <25`; auditoria npm sem vulnerabilidades conhecidas.
- Todas as mutacoes administrativas PostgreSQL passam pelo lock transacional global; lock reentrante evita deadlock. O fallback JSON recebeu mutex reentrante.
- Migration 025 adiciona `subscription_usage.credits_used`; leitura, escrita e estorno usam a quantidade efetiva do bundle.
- Mudanca de sala e bloqueada quando existem pedidos/tickets com poltronas ativas; alteracoes permitidas disparam `session_refresh_required`.
- Em producao, mutacoes de cliente sem Origin/Referer verificavel recebem 403 antes de acessar o banco.
- `/api/health/live` e `/api/health/ready` foram separados. Readiness verifica PostgreSQL e migration 025 sem expor configuracao.
- Manutencao periodica expira reservas de pedidos e deixou de regravar snapshots em toda request.
- Backup criptografado, restore isolado, health operacional, RPO/RTO e runbook de incidente foram adicionados.
- Playwright passou a cobrir navegacao publica, conta, 404 e login Admin.

## Problemas analisados mas inexistentes

- **Sessoes/cookies:** HttpOnly, Secure em producao, SameSite, expiracao, `sessionVersion`, logout e revogacao estao corretos. Sessao Admin definitiva so nasce apos 2FA quando ativo.
- **2FA:** segredo AES-256-GCM, recovery codes em hash e de uso unico, desafio expira e possui limite de tentativas. Politica obrigatoria ja e configuravel, sem bloquear automaticamente instalacoes existentes.
- **RBAC:** uploads, validacao, emissao manual, Bilheteria e rotas sem prefixo `/admin` validam permissao no backend.
- **Uploads:** limite, magic bytes JPG/PNG/WebP, nome aleatorio, confinamento de caminho e rejeicao de SVG/executaveis ja estavam corretos.
- **Poltronas:** chave unica PostgreSQL e `ON CONFLICT` atomico impedem dois donos; heartbeat, expiracao, reconexao e rejeicao de token alheio ja existem.
- **Checkout:** backend recalcula preco, quantidade efetiva de bundle, estoque, capacidade, descontos, credito e poltronas. Frontend nao aprova pagamento.
- **Estoque:** reserva/debito ocorre sob transacao, nao fica negativo e e liberado em expiracao/cancelamento; aprovacao converte reserva de forma idempotente.
- **Mercado Pago:** Orders API, external reference, idempotencia e estados pendentes nao liberam ticket. Webhook usa `x-signature`, `x-request-id` e `data.id` da query string; assinatura invalida retorna 401 e replay nao duplica efeito.
- **Point:** polling e webhook convergem pela mesma finalizacao idempotente; recarga nao depende do estado visual do operador.
- **Clube:** `pending_payment` nao concede beneficio; aprovacao, fim de ciclo, cancelamento e nova autorizacao estao separados.
- **Transferencia/QR:** validacao consulta estado server-side; transferencia rotaciona o codigo e registra historico.
- **NFS-e:** referencia deterministica por pedido, consulta por referencia, webhook e separacao entre servico e bomboniere ja existem. Timeout nao autoriza emissao duplicada automaticamente.
- **Logs:** request ID e redaction central de password, token, secret, authorization, cookie, QR/Pix e dados de cartao ja existem.
- **PM2/WebSocket:** producao usa uma instancia de backend; portanto o broadcast em memoria e coerente com a topologia atual.

## Testes adicionados ou ampliados

- 20 clientes WebSocket concorrentes na mesma poltrona: um vencedor; reconexao recupera `heldByMe`.
- 20 tentativas PostgreSQL diretas na mesma poltrona: um vencedor.
- 10 compras concorrentes pelo ultimo item: uma aceita, nove rejeitadas.
- 10 replays do mesmo evento: um pedido, um ticket e uma baixa de estoque.
- Duas validacoes simultaneas: uma aceita e uma rejeitada.
- Bundle de 3 ingressos: consome e estorna 3 creditos; round-trip PostgreSQL preserva `creditsUsed`.
- Troca de sala com poltrona vendida: 409 `SESSION_ROOM_LOCKED_BY_SEATS`.
- CSRF sem Origin/Referer em producao: 403 antes do banco.
- Liveness/readiness e migration atual.
- E2E Playwright: filmes, conta, Google login visivel, 404 e login Admin.

## Testes executados

- `npm audit`: 0 vulnerabilidades.
- `node scripts/smoke-tests.js`: aprovado.
- `node scripts/seat-realtime-tests.js`: aprovado.
- `npm ci`: aprovado; 161 pacotes auditados, 0 vulnerabilidades.
- `npm run lint`: aprovado.
- `npm test`: aprovado; a etapa PostgreSQL foi corretamente ignorada por ausencia de `TEST_DATABASE_URL` local.
- `npm run test:e2e`: 3 testes aprovados.
- `npm run build`: aprovado com Next.js 16.3.3.
- `bash -n` nos scripts operacionais: aprovado via Git Bash.

## Pendencias externas

- Pagamento real Mercado Pago/Point exige homologacao com credenciais e terminal de producao.
- Focus NFe exige certificado, cadastro municipal e ambiente nacional configurados pelo emissor.
- SMTP, Google OAuth, Google Wallet, TMDB e webhooks de terceiros exigem credenciais reais e teste controlado.
- O teste PostgreSQL concorrente requer `TEST_DATABASE_URL`; nunca usa o banco de producao.

## Riscos restantes

- E-mails e parte do pos-pagamento ainda nao usam uma outbox PostgreSQL duravel completa. Falhas nao desfazem pagamento/ticket e ha reenvio/reconciliacao, mas uma queda entre commit e envio pode exigir reprocessamento operacional. A migracao para outbox deve ser incremental, nao uma reescrita durante este hardening.
- Broadcast WebSocket e local ao processo. Escala horizontal exige `LISTEN/NOTIFY`, Redis Pub/Sub ou broker antes de ativar PM2 cluster.
- Migrations antigas, especialmente a 008, possuem operacoes destrutivas historicas. Ja aplicadas, nao foram reescritas; novas migrations devem seguir expand-migrate-contract.
- Backup so e considerado validado depois do teste mensal de restauracao isolada documentado.
- Compatibilidade iOS/Android em suspensao profunda depende do navegador; a reserva expira de forma segura e a reconexao ressincroniza, mas homologacao em dispositivos reais permanece recomendada.

## Arquivos alterados

A lista exata e obtida com `git diff --name-only` no commit desta auditoria. As areas incluem backend, store/migration PostgreSQL, testes, Playwright, stack, health, operacao, disaster recovery, README e deploy.
