# Auditoria tecnica, hardening e correcoes

Revisao realizada em 30 de agosto de 2026 sobre frontend Next.js, backend Node.js, Admin, PostgreSQL, pagamentos, Clube, poltronas, e-mail, deploy e operacao.

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

# Segunda rodada de hardening

Execução de fechamento em 31 de agosto de 2026. Esta seção registra somente evidências novas; não substitui a auditoria anterior.

## Pendências anteriores encerradas

| Problema | Ação | Teste executado | Resultado |
| --- | --- | --- | --- |
| PostgreSQL não havia sido executado | PostgreSQL 16 isolado em container, migrations 001-025 e suíte concorrente real | `TEST_DATABASE_URL=... npm run test:postgres` | PASS |
| Checkout sem E2E de negócio | Fixture isolado, Pix pending/approved/rejected, extras, ticket e QR | Playwright pelo frontend e backend reais | PASS |
| Bilheteria e conflito de poltrona sem E2E | Venda rápida com bomboniere e dois clientes WebSocket concorrentes | Playwright + WebSocket real | PASS |
| Clube sem prova de saldo concorrente/bundle | Três compras disputando dois créditos e pacote 2 x 3 | PostgreSQL + Playwright | PASS; duas aprovadas, uma 409; seis tickets e estorno de seis créditos |
| Alteração de sessão podia divergir de tickets | Confirmação/motivo para sessão com histórico e sincronização de snapshots | Alteração de data/hora/formato e cancelamento com venda | PASS |
| Webhook podia regredir aprovado | Transição financeira monotônica | aprovado, rejeitado atrasado e replays | PASS; pagamento permaneceu aprovado e efeitos ficaram únicos |
| Test mode ainda alcançava Mercado Pago com credencial sintética | Modo de teste passou a bloquear consulta/criação externa inclusive com configuração presente | E2E com SDK bloqueada e webhook assinado local | PASS; nenhuma cobrança externa |
| Backup existia sem restore comprovado | Backup GPG real, checksum, restore PostgreSQL/uploads e migrations em destino isolado | `backup-restore-integration-test.sh` | PASS; checksum `b2dd448f...fbe3082`, 1 pedido, 6 tickets, 3 usuários e 1 upload |
| Retenção e monitor eram ambíguos | Retenção 48h + 14 diários + 8 semanais + 12 mensais; monitor 8h/12h | 400 backups sintéticos e health com falhas simuladas | PASS |
| Reconexão móvel sem automação | Endpoint WS configurável para teste local e cenário offline/reconnect/refresh | Playwright 390x844 + heartbeat atrasado | PASS |

## Sessões com vendas existentes

| Campo | Regra adotada | Evidência |
| --- | --- | --- |
| Data e horário | Permitidos somente após confirmação explícita e motivo; pedidos e tickets recebem o novo snapshot | E2E alterou a sessão vendida e conferiu API/Admin/ticket |
| Formato e idioma | Mesma restrição de confirmação/motivo; materiais derivados leem o snapshot sincronizado | E2E `2D Dublado` para `3D Legendado` |
| Sala | Bloqueada quando há poltrona ativa, mesmo com confirmação | regra `SESSION_ROOM_LOCKED_BY_SEATS` preservada |
| Mapa e capacidade | Alterados na entidade Sala; não devem invalidar lugares já vendidos. Mudança incompatível permanece bloqueada pelas atribuições | testes de capacidade/poltrona e restrição de sala |
| Status/cancelamento | Cancelamento com histórico exige confirmação/motivo; QR passa a ser recusado | E2E recebeu 409 na validação após cancelamento |

O cancelamento **não** executa reembolso financeiro automático. Pedido e pagamento recebem `refundStatus=required`; ticket recebe status da sessão cancelada e a validação recusa o QR. Comunicação ao cliente, devolução automática de crédito do Clube e decisão sobre extras ainda exigem fluxo operacional/produto explícito. Excluir sessão com histórico continua bloqueado.

## Backup, restore e RPO/RTO

- Backup: **PASS em ambiente isolado**. O pacote contém dump custom PostgreSQL, uploads, configuração runtime e manifesto, e somente o `.gpg` fica no destino.
- Restore: **PASS em ambiente isolado**. Checksum, contagens, upload, migrations e `test:postgres` após restore passaram.
- VPS: **RPO PROJETADO, NÃO HOMOLOGADO**. Em 31/08/2026 não havia cron/timer, backup cifrado nem `BACKUP_GPG_RECIPIENT` configurado.
- RTO: restore técnico medido em 2 segundos no fixture pequeno; **não homologado em volume de produção** e não comprova o objetivo de 4 horas sozinho.
- Offsite: **EXTERNAL**. Requer destino em outra conta/região e chave privada sob controle do cinema.

## Análise de efeitos pós-commit e outbox

| Evento | Persistência e falha após commit | Retry/reconciliação atual | Idempotência/reprocessamento |
| --- | --- | --- | --- |
| E-mail de ingresso | Pedido/ticket são duráveis; não há evento pendente durável para o envio | botão/rota `resend-ticket-email` | reenvio não cobra nem recria ticket; entrega SMTP não foi homologada nesta rodada |
| CRM de eventos | chamada HTTP direta após registro da solicitação | sem fila durável específica | pode perder entrega se o processo cair; reenvio operacional não está modelado |
| Google Wallet | JWT é gerado sob demanda; criação/consulta externa ocorre quando solicitada | cliente pode solicitar novamente | objeto usa identificador determinístico; produção não homologada |

Plano incremental futuro, sem refatoração nesta rodada: tabela `outbox_events(id, event_type, aggregate_id, payload, status, attempt_count, next_attempt_at, created_at, processed_at, last_error)`, gravação na mesma transação do agregado, worker de uma instância com `FOR UPDATE SKIP LOCKED`, chaves idempotentes por efeito, backoff e tela de reprocessamento. Prioridade: e-mail de ingresso, CRM e Wallet.

## Evidência de testes

| Teste | Executado | Resultado | Ambiente |
| --- | --- | --- | --- |
| PostgreSQL concorrência | SIM | PASS | PostgreSQL 16 isolado, nunca produção |
| Checkout E2E | SIM | PASS | Playwright/Chromium, pagamento simulado |
| Bilheteria E2E | SIM | PASS | Playwright/Admin real, sem Point físico |
| Clube E2E e concorrência | SIM | PASS | Playwright + PostgreSQL |
| Sessão com vendas | SIM | PASS | Playwright/API isolada |
| Webhook fora de ordem/replay | SIM | PASS | webhook Orders assinado localmente |
| Crash após estado financeiro e reenvio | SIM | PASS parcial | estado e idempotência aprovados; SMTP externo não entregue |
| Backup/restore | SIM | PASS | container Debian + PostgreSQL isolado |
| Monitor operacional | SIM | PASS | HTTP, PM2, disco, restarts e atraso simulados |
| Mobile WebSocket automatizado | SIM | PASS | Chromium 390x844, offline/reconnect/refresh |
| Safari iPhone físico | NÃO | MANUAL HOMOLOGATION REQUIRED | dispositivo real |
| Chrome Android físico | NÃO | MANUAL HOMOLOGATION REQUIRED | dispositivo real |
| Mercado Pago Point real | NÃO | EXTERNAL | requer terminal/credenciais |
| SMTP e Wallet reais | NÃO | EXTERNAL | requer credenciais/ambientes externos |

Checklist físico restante: no Safari iPhone e Chrome Android, selecionar poltrona, bloquear tela por mais de 35 segundos, alternar Wi-Fi/4G, retornar ao app, confirmar ressincronização, tentar a mesma poltrona em outro aparelho e concluir/abandonar a compra.

## Pendências anteriores ainda abertas

- Instalar timer de backup na VPS depois de configurar destinatário GPG recuperável e destino offsite. Sem isso não há RPO de 6 horas real.
- Homologar SMTP, Point, Wallet, Google OAuth e Mercado Pago com contas/terminais próprios.
- Implementar outbox incremental para eliminar a janela entre commit e efeitos externos.
- Homologar suspensão profunda em Safari iOS e Chrome Android físicos.
- Broadcast WebSocket continua em memória; PM2 deve permanecer em uma instância até existir broadcast compartilhado.

## Comandos executados nesta rodada

| Comando | Exit code | Resultado |
| --- | --- | --- |
| `npm run lint` | 0 | TypeScript sem erros |
| `TEST_DATABASE_URL=<isolado> npm run test:postgres` | 0 | migrations 001-025 e concorrências aprovadas; 0 skips de cenário |
| `TEST_DATABASE_URL=<isolado> npm test` | 0 | 11 scripts de teste aprovados, incluindo PostgreSQL |
| `npm run test:e2e` | 0 | 10 testes Playwright aprovados, 0 falhas, 0 skips |
| `npm run test:operations` | 0 | retenção aprovada; 370/400 backups sintéticos podados |
| `production-operations-tests.sh` | 0 | health OK/offline/PM2/disco/restarts/backup 10h/13h aprovados |
| `backup-restore-integration-test.sh` | 0 | backup e restore reais isolados aprovados em 2s |
| `TEST_DATABASE_URL=<restaurado> npm run test:postgres` | 0 | banco restaurado passou pela suíte concorrente |
| `npm audit --audit-level=high` | 0 | 0 vulnerabilidades |
| `npm run build` | 0 | Next.js 16.3.3 compilou 12 páginas estáticas e rotas dinâmicas |

As URLs, senhas, chaves privadas e tokens usados nos ambientes isolados não foram registrados nem versionados.
