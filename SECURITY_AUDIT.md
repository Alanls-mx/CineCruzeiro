# Auditoria de seguranca - Cine Cruzeiro

Data: 28/08/2026

## Escopo e arquitetura

O frontend acessa somente a API Node.js. O PostgreSQL nao e acessado diretamente pelo navegador e nao existe Supabase/service role no projeto. A API usa uma identidade unica de aplicacao para carregar e persistir o agregado do cinema; autenticacao, ownership e funcoes sao aplicados no backend.

## Classificacao das APIs

| Classe | Rotas principais | Controle |
| --- | --- | --- |
| Publicas | `health`, conteudo, filmes publicados, sessoes disponiveis, planos publicos, cadastro/login/recuperacao, contato/eventos | Validacao de entrada, limites de corpo e rate limit nos fluxos sensiveis |
| Cliente autenticado | `auth/me`, `me/*`, ingressos, transferencias, Google Wallet, assinatura e credito do Clube | Cookie assinado HttpOnly, ownership pelo usuario da sessao e protecao de origem nas mutacoes |
| Checkout publico com capacidade | criacao Pix/cartao e `checkout/orders/:id` | Reprecificacao no servidor, idempotencia e cookie de capacidade assinado; conta autenticada deve ser proprietaria |
| Administrativas | `admin/*`, dashboard, usuarios, pedidos, fiscal, relatorios, integracoes, uploads, catalogo e bilheteria | Sessao administrativa e RBAC `owner/manager/operator`; mutacoes verificam origem |
| Internas/webhooks | Mercado Pago e Focus NFe | Assinatura/secret do provedor, timestamp quando suportado e idempotencia |

## Correcoes aplicadas

- Eliminado o IDOR da consulta de checkout. IDs de pedido nao funcionam mais como credencial.
- Removido o endpoint legado que aceitava criacao arbitraria de pedidos e campos enviados pelo cliente.
- Removidas copias do token de cliente de `localStorage`, `sessionStorage` e cookie legivel por JavaScript.
- Sessoes de cliente e admin agora possuem versao revogavel; logout e alteracao de senha invalidam cookies anteriores.
- Cookies de sessao permanecem `HttpOnly`, `Secure` em producao e com `SameSite` adequado.
- Adicionada verificacao de origem contra CSRF nas mutacoes autenticadas por cookie.
- JWT usado no estado OAuth valida exatamente tres segmentos, `HS256`, tipo, assinatura, expiracao, `iat`, issuer e audience.
- `JWT_SECRET` e a chave de criptografia de integracoes falham fechados em producao se nao estiverem configurados.
- PBKDF2-HMAC-SHA256 passou de 120.000 para 600.000 iteracoes, com salt aleatorio e rehash progressivo no login.
- Senhas novas aceitam ate 128 caracteres, exigem pelo menos 10 e rejeitam uma lista curta de senhas muito comuns.
- Login possui limite por IP/rota e bloqueio temporario progressivo por IP + conta depois de cinco falhas.
- Recuperacao usa token aleatorio de 256 bits, hash SHA-256 armazenado, prazo de 30 minutos e uso unico.
- Criacao/edicao administrativa de usuarios usa allowlist e ignora `passwordHash`, segredos 2FA e demais campos internos.
- Respostas de checkout omitem PII, metadata interna e payload bruto do QR Code.
- Uploads validam assinatura binaria real de JPEG, PNG e WebP, limite, nome seguro e confinamento de caminho.
- Integracoes e segredos 2FA usam AES-256-GCM com IV aleatorio; senhas e codigos de recuperacao usam hash.
- Logs aplicam redacao recursiva para senha, hash, token, secret, Authorization, cookie, Pix, QR, cartao e CVV.

## Banco de dados e RLS

RLS nao esta habilitado. O banco nao e uma API multi-tenant nem e acessivel pelo frontend; todas as consultas de cliente passam pela API, e o repositorio PostgreSQL atual regrava o agregado completo em uma transacao com lock. Policies por usuario seriam incompativeis com esse modelo enquanto a conexao nao transportar uma identidade por requisicao.

Os comandos SQL que recebem valores usam parametros (`$1`, `$2`, etc.). Nao foi encontrada concatenacao de entrada do usuario em SQL. Para adicionar defesa em profundidade com RLS no futuro, primeiro sera necessario migrar para repositorios por entidade e uma role/transacao por contexto autenticado. Ate la, a role do banco deve permanecer privada, sem acesso de rede publico e com privilegios minimos.

Nao ha tenants/organizacoes no modelo atual; portanto isolamento entre tenants nao se aplica. Ownership entre clientes foi testado na API.

## Dados e criptografia

- Senhas nao sao recuperaveis nem armazenadas em texto puro.
- Access tokens, secrets de integracao e segredos 2FA nao sao enviados ao frontend.
- CPF e dados fiscais permanecem em colunas pesquisaveis, sem criptografia de campo; o acesso e restrito ao backend/admin. Criptografa-los exige redesenho de busca, fiscal e relatorios.
- Criptografia de disco, volume e backups depende da infraestrutura da VPS/provedor e nao pode ser comprovada pelo codigo-fonte. Deve ser confirmada operacionalmente.
- Producao publica usa HTTPS e HSTS; chamadas de provedores usam HTTPS.

## Testes ofensivos executados

- API administrativa sem sessao e funcao insuficiente: negadas.
- Cookie/token invalido e sessao antiga apos logout/senha alterada: negados.
- Cliente A consultando checkout do cliente B ou sem capacidade: `404`.
- `role=owner`, `active=false`, `passwordHash` e segredo 2FA por mass assignment: ignorados/negados.
- CSRF cross-site em mutacao de conta: `403`.
- Cinco falhas de login seguidas: bloqueio temporario com `429` e `Retry-After`.
- Token de recuperacao reutilizado: negado.
- Webhook ausente, falso e duplicado: `401`, `401` e resposta idempotente, respectivamente.
- Upload com MIME PNG e conteudo HTML/script: `415`.
- SQL injection: revisao de todas as chamadas do repositorio confirmou parametros.
- XSS: React escapa texto por padrao e os templates HTML dinamicos usam `htmlEscape`; nao foi encontrado HTML arbitrario de usuario renderizado sem sanitizacao.

## Riscos residuais e proximos passos

1. O rate limit e os bloqueios progressivos ficam em memoria. Em mais de uma instancia, mover para Redis/Valkey.
2. Confirmar criptografia, snapshots e politica de retencao dos volumes/backups da VPS.
3. Reduzir a role PostgreSQL ao minimo e bloquear acesso externo no firewall.
4. Planejar repositorios por entidade antes de adotar RLS como defesa adicional.
5. Definir retencao e anonimizacao de CPF, pedidos e documentos fiscais com responsavel juridico/contabil.
