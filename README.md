# Cine Cruzeiro

Documentação atualizada da plataforma pública, checkout, Clube Cine Cruzeiro e painel administrativo.

Última revisão: 26 de agosto de 2026.

## 1. Visão geral

O Cine Cruzeiro é uma plataforma full-stack para venda de ingressos, operação de bilheteria, programação de filmes, bomboniere, assinaturas recorrentes e relacionamento com clientes de um cinema de rua.

O produto possui duas experiências integradas:

- site público responsivo, voltado principalmente para compras pelo celular;
- painel administrativo para programação, vendas, validação, catálogo, usuários, marketing e integrações.

Produção:

- site: <https://lumixengine.com/projects/cinecruzeiro>
- painel: <https://lumixengine.com/projects/cinecruzeiro/admin>
- health check: <https://lumixengine.com/projects/cinecruzeiro/api/health>
- base path de produção: `/projects/cinecruzeiro`

## 2. Estado atual

| Área | Estado atual |
| --- | --- |
| Site público | Operacional e responsivo |
| Programação e sessões | Integradas ao backend |
| Tipos de ingresso por sessão | Catálogo central com seleção por sessão e pacotes múltiplos |
| Checkout | Ingressos, Extras, Pagamento e Confirmação |
| Mercado Pago | Orders API para Pix e cartão de ingressos |
| Clube | Assinatura recorrente por cartão de crédito Mercado Pago |
| PostgreSQL | Persistência obrigatória em produção |
| Ingressos digitais | Código, QR Code, PDF e histórico |
| Google Wallet | Implementação oficial, dependente de credenciais externas |
| E-mail | SMTP ou webhook de entrega configurável no Admin |
| Logs operacionais | Consulta, filtros e retenção administrável |
| Eventos privados | Formulário envia solicitação e confirmação automática |
| TMDB | Importação assistida de dados de filmes |
| Admin | RBAC, auditoria e módulos operacionais |

Não fazem parte da arquitetura ativa:

- EBANX;
- Pix Open Finance;
- mocks públicos quando a API falha;
- ativação de assinatura antes da aprovação do pagamento.

## 3. Arquitetura

```text
Navegador
  |
  | HTTPS /projects/cinecruzeiro
  v
Nginx da VPS
  |-- Next.js :3100
  |     |-- páginas públicas
  |     |-- checkout
  |     |-- conta do cliente
  |     `-- proxy /api para o backend
  |
  `-- Backend Node.js :4100
        |-- regras de negócio
        |-- autenticação e RBAC
        |-- Mercado Pago
        |-- SMTP, TMDB, Wallet e CRM
        `-- PostgreSQL
```

O frontend nunca é fonte de verdade para preço, disponibilidade, pagamento, ticket ou status de assinatura. Esses dados são recalculados ou confirmados pelo backend.

## 4. Stack tecnológica

### Frontend

- Next.js 16 com App Router;
- React 18;
- TypeScript;
- Tailwind CSS;
- Lucide React;
- `next/image`;
- SDK web oficial do Mercado Pago;
- layout mobile-first.

### Backend

- Node.js 18 ou superior;
- servidor HTTP nativo em CommonJS;
- PostgreSQL com migrations SQL;
- `pg` para acesso ao banco;
- `nodemailer` para SMTP;
- `qrcode` para geração de QR Code;
- `jsQR` para leitura alternativa de QR Code;
- `crypto` para hashes, HMAC e proteção de dados sensíveis.

### Painel administrativo

O Admin utiliza HTML, CSS e JavaScript próprios servidos pelo backend. Essa decisão mantém o painel operacional independente do bundle público e permite interfaces densas para uso diário.

## 5. Estrutura principal

```text
.
|-- backend/
|   |-- db/
|   |   |-- migrations/
|   |   `-- postgresStore.js
|   |-- public/
|   |   |-- admin.html
|   |   |-- admin.css
|   |   `-- admin.js
|   |-- services/
|   |   |-- emailService.js
|   |   |-- integrationConfigService.js
|   |   `-- paymentService.js
|   `-- server.js
|-- public/
|   `-- images/
|-- scripts/
|   |-- db-migrate.js
|   |-- smoke-tests.js
|   |-- mercado-pago-webhook-tests.js
|   `-- postgres-concurrency-tests.js
|-- src/
|   |-- app/
|   |-- components/
|   |-- services/
|   `-- types/
|-- next.config.mjs
|-- package.json
`-- README.md
```

## 6. Páginas públicas

| Rota | Função |
| --- | --- |
| `/` | Página inicial, destaque, programação e argumentos comerciais |
| `/filmes` | Catálogo, navegação por data, filtros e sessões |
| `/filmes/[slug]` | Detalhes do filme e seletor único de sessões |
| `/checkout/[sessionId]` | Seleção de ingressos |
| `/checkout/[sessionId]/extras` | Bomboniere e extras |
| `/checkout/[sessionId]/pagamento` | Pagamento |
| `/checkout/[sessionId]/confirmacao` | Acompanhamento e confirmação |
| `/clube` | Apresentação e planos ativos do Clube |
| `/clube/assinar/[planId]` | Contratação do plano selecionado |
| `/conta` | Perfil, verificação de e-mail e Clube |
| `/conta/ingressos` | Próximos ingressos e histórico |
| `/eventos` | Solicitação de aluguel da sala |
| `/o-cinema` | História, tradição e cultura |
| `/privacidade` | Política de privacidade |
| `/termos` | Termos de uso |

## 7. Programação, filmes e sessões

A sessão é a fonte de verdade para os dados usados em:

- site e página do filme;
- checkout;
- painel administrativo;
- ingresso digital;
- PDF;
- e-mail;
- Google Wallet;
- validação de QR Code.

Uma sessão relaciona filme, sala, data, horário, formato, idioma, capacidade e disponibilidade. O backend impede venda de sessão indisponível ou encerrada.

Regra temporal importante:

- uma sessão deixa de ser vendida e exibida como disponível após 10 minutos do horário real de início.

O slug é usado para navegação amigável, mas a identificação do filme e da sessão depende de IDs estáveis.

### Criação e edição de sessões

O Admin aceita criação de sessão individual ou em lote. No modo em lote, o operador informa:

- data inicial e final;
- um ou mais horários;
- dias da semana desejados;
- sala, formato e status;
- tipos de ingresso disponíveis naquela programação.

Cada data é tratada como uma data civil do cinema no fuso `America/Sao_Paulo`. Alterar apenas o horário não deve deslocar a sessão para outro dia. Os testes de timezone cobrem horários noturnos e próximos da virada do dia.

O preço não é digitado diretamente na sessão: ele vem dos tipos de ingresso vinculados. Isso mantém catálogo, checkout, bilheteria e relatórios consistentes.

### Exibição e recomendação

- a programação destaca os primeiros seis dias que realmente possuem sessões disponíveis;
- dias vazios não ocupam espaço no seletor;
- o filtro `Todos` agrega todos os formatos e idiomas da data;
- filtros como Normal, Dublado e Legendado usam a mesma fonte de dados;
- se as sessões do dia terminaram, a interface recomenda a próxima sessão futura disponível.

## 8. Checkout

Fluxo obrigatório:

```text
Ingressos -> Extras -> Pagamento -> Confirmação
```

Regras:

- etapas futuras ficam bloqueadas até a conclusão das anteriores;
- Extras pode ser concluída sem produtos;
- produtos escolhidos permanecem no pedido ao avançar;
- a Confirmação exige pedido e pagamento válidos;
- `pending` e `processing` não são tratados como aprovação;
- tickets só são liberados com pagamento `approved`;
- preço, estoque e capacidade são recalculados pelo backend;
- o checkout autenticado reutiliza os dados reais da conta;
- o checkout convidado solicita apenas os dados necessários.

### Ingressos

O cliente escolhe apenas os tipos habilitados para a sessão. O backend valida capacidade, preço, disponibilidade e quantidade efetiva de tickets.

Um tipo pode definir `bundleQuantity` entre 1 e 20. Por exemplo, uma unidade de `Triple Ingresso` gera três tickets; duas unidades geram seis. O multiplicador é fixado no backend e não pode ser reduzido ou adulterado pelo frontend.

### Extras

Produtos da bomboniere possuem imagem local, descrição, preço, estoque, categoria e quantidade. Os itens pertencem ao pedido, não são duplicados em cada ticket.

### Pagamento

Ingressos aceitam os métodos habilitados no Mercado Pago para a Orders API, incluindo Pix real e cartão.

No Pix:

- o backend cria a order;
- o frontend recebe código copia e cola e QR Code;
- a confirmação consulta o estado periodicamente;
- o ingresso permanece bloqueado até aprovação real;
- o webhook atualiza o pedido de forma idempotente.

Clientes com assinatura ativa e créditos suficientes também podem escolher `Crédito do Clube`. A opção considera a quantidade efetiva de tickets, inclusive multiplicadores de pacote, e a baixa é atômica e idempotente. Se o pedido falhar ou for cancelado dentro das regras de estorno, o crédito é devolvido pelo backend.

## 9. Mercado Pago

A integração de ingressos utiliza a nova Orders API. A integração legada de pagamentos não deve ser reintroduzida.

Configurações principais:

- ambiente `sandbox` ou `production`;
- public key;
- access token;
- webhook secret;
- recorrência do Clube;
- configuração opcional de Point.

### Mercado Pago Point na bilheteria

A venda presencial usa a Orders API atual do Mercado Pago, com `type: point`. Em Integrações, habilite Point e informe o `Terminal ID` de uma maquininha pertencente à mesma conta do Access Token. O terminal deve estar no modo PDV.

Fluxo operacional:

1. o operador seleciona um ou vários filmes e escolhe `Maquininha`;
2. o backend envia uma única cobrança agregada ao terminal configurado;
3. pedidos e pagamento permanecem pendentes enquanto o cliente paga;
4. o painel consulta o estado automaticamente e também aceita a confirmação pelo webhook de Orders;
5. somente `processed` com `status_detail: accredited` libera e imprime os ingressos;
6. recusa, expiração ou cancelamento não emitem ingressos;
7. a mesma confirmação pode ser reenviada sem duplicar pedidos ou tickets.

O comprovante do vendedor pode ser impresso pela própria Point nas cobranças processadas pela maquininha. Nas vendas rápidas concluídas como `Dinheiro`, `Pix no balcão` ou `Cortesia`, o backend usa a API oficial de ações de impressão (`POST /terminals/v1/actions`) para enviar um ingresso personalizado à Point Smart configurada, com filme, sessão, sala, tipo, código e QR Code. A falha da impressora não desfaz a venda: o painel informa o problema e o ingresso continua disponível para impressão individual.

Endpoints administrativos:

```text
GET  /api/box-office/point-terminals
GET  /api/box-office/point-payments/:paymentId
POST /api/box-office/point-payments/:paymentId/cancel
GET  /api/admin/tickets/:ticketId/print
```

Webhook público:

```text
POST /api/webhooks/mercado-pago
```

Validação de segurança:

- lê `x-signature`;
- lê `x-request-id`;
- usa `data.id` da query string;
- valida HMAC com a webhook secret do ambiente;
- não exige JWT, sessão ou Authorization de usuário;
- rejeita assinatura inválida com `401`;
- aceita eventos válidos com `200`;
- registra eventos processados para evitar duplicidade.

Nunca usar `req.body.data.id` como substituto do `data.id` da query na montagem da assinatura.

## 10. Clube Cine Cruzeiro

Os planos são carregados do backend e podem ser administrados com nome, mensalidade, créditos, benefícios, imagem local, ordem, recomendação e status.

Benefícios configuráveis incluem:

- quantidade de ingressos incluídos por ciclo;
- desconto percentual em ingressos;
- desconto percentual na bomboniere;
- produtos específicos da bomboniere que podem ser resgatados gratuitamente;
- lista textual de benefícios exibida na página pública.

Descontos e itens gratuitos são recalculados no backend a partir do plano, assinatura, ciclo e produtos reais. O frontend não informa o valor final do benefício e não consegue transformar um item não elegível em gratuito.

Método ativo para contratação recorrente:

- cartão de crédito via Mercado Pago.

Pix recorrente e cartão de débito não são oferecidos nas assinaturas.

### Ativação

Uma assinatura nasce como `pending_payment`. O plano e os créditos só são atribuídos após aprovação confirmada pelo Mercado Pago.

Assinaturas pendentes sem pagamento identificado expiram após 15 minutos.

### Estados

| Status | Significado |
| --- | --- |
| `pending_payment` | Aguardando autorização ou pagamento |
| `active` | Ativa e com benefícios vigentes |
| `paused` | Pausada administrativamente |
| `ending` | Cobrança encerrada, benefícios válidos até o fim do ciclo |
| `cancelled` | Cancelada sem benefício corrente |
| `ended` | Ciclo finalizado |
| `payment_failed` | Pagamento falhou |

### Cancelamento

Ao solicitar cancelamento:

- o backend encerra a renovação no Mercado Pago;
- nenhuma cobrança futura deve ocorrer;
- a assinatura passa para `ending` quando ainda existe ciclo pago;
- créditos continuam utilizáveis até o fim do ciclo;
- após o prazo, a assinatura vai automaticamente para o histórico;
- reativação de uma assinatura cancelada externamente é bloqueada.

O Admin não pode reativar e cobrar novamente uma assinatura cancelada pelo cliente. Uma nova cobrança exige uma nova contratação e autorização do titular.

### Admin de assinaturas

O painel permite:

- buscar por nome, e-mail ou plano;
- visualizar titular e e-mail;
- consultar créditos e status;
- ajustar créditos com permissão;
- cancelar renovação;
- excluir registros terminais quando a regra de auditoria permitir;
- atribuir assinatura manual para venda presencial, cortesia ou migração.

## 11. Conta do cliente

Funcionalidades:

- cadastro e login;
- login opcional com Google;
- recuperação de senha;
- verificação de e-mail;
- edição de nome, WhatsApp, CPF e senha;
- alteração de e-mail com confirmação;
- consulta do Clube e histórico;
- consulta de ingressos;
- transferência segura de ticket.

A sessão usa cookie HttpOnly. Dados sensíveis não são usados como substitutos de autenticação.

## 12. Verificação de e-mail e recuperação de senha

O backend gera tokens temporários, armazena somente o hash e envia um link pelo provedor de e-mail configurado.

Confirmação canônica:

```text
GET /api/auth/email/verify?token=...
```

O sistema:

- aguarda o resultado de envio ao cadastrar;
- informa sucesso ou falha sem expor o token no frontend;
- permite novo envio quando uma tentativa de entrega falha;
- aplica limite de requisições para reduzir abuso e spam;
- não marca um novo e-mail como verificado antes da confirmação.

## 13. E-mails

O provedor pode ser SMTP ou webhook privado de entrega.

E-mails transacionais incluem, conforme o evento:

- verificação de conta;
- recuperação de senha;
- pagamento aprovado;
- entrega e reenvio de ingresso;
- transferência de ticket;
- recebimento de solicitação de evento.

Os layouts transacionais utilizam a identidade do cinema, logo compatível com fundo de e-mail, pôster, dados sincronizados da sessão, resumo do pedido e ações disponíveis. O PDF real do ingresso pode seguir anexado à mensagem.

O módulo de Marketing permite campanhas por template estruturado ou HTML5 personalizado. No modo HTML, o conteúdo é sanitizado e envolvido pelo layout base do Cine Cruzeiro; o placeholder `{{nome}}` personaliza o destinatário. A prévia, assunto, audiência e resultado do envio permanecem no fluxo administrativo.

Regras:

- e-mails transacionais não exibem unsubscribe;
- campanhas de marketing exibem link individual de descadastro;
- layouts usam HTML responsivo compatível com clientes comuns;
- anexos de ingresso usam o PDF real gerado pelo sistema;
- secrets SMTP ficam criptografados e mascarados no Admin.
- a logo usada nos e-mails é um ativo local estável, evitando dependência de imagem privada ou URL temporária.

## 14. Formulário de eventos

A página `/eventos` envia uma solicitação real ao backend com:

- nome;
- WhatsApp;
- e-mail;
- tipo de evento;
- quantidade estimada;
- data e horário desejados;
- mensagem.

O backend:

- valida e sanitiza os campos;
- usa honeypot contra bots;
- exige integração de e-mail ativa;
- entrega a solicitação ao e-mail de atendimento configurado;
- define o cliente como Reply-To;
- envia resposta automática confirmando o recebimento;
- encaminha o evento ao CRM quando configurado.

## 15. Ingressos digitais

Cada ingresso possui:

- filme;
- sessão;
- sala;
- data e horário;
- formato e idioma;
- tipo;
- código;
- QR Code;
- pedido;
- cliente;
- status;
- extras vinculados ao pedido.

Ingressos são separados entre próximos e arquivados. O arquivamento automático acontece quatro horas após a sessão, preservando ingressos usados no histórico.

### Transferência

Somente ticket pago, válido, não utilizado, não expirado, não cancelado e não reembolsado pode ser transferido.

A transferência:

- exige destinatário cadastrado;
- troca o proprietário em transação;
- registra remetente, destinatário, ticket e horário;
- rotaciona a validade do QR Code do antigo proprietário;
- envia e-mails transacionais aos envolvidos.

### PDF e Google Wallet

O PDF usa dados sincronizados da sessão, possui até duas páginas, inclui a marca do Cine Cruzeiro sem fundo preto e pode incluir pôster armazenado localmente. Datas visíveis seguem o padrão brasileiro `dd/mm/aaaa às HH:mm`.

O Google Wallet usa integração oficial. A opção só funciona em produção quando issuer, class e service account válidos estiverem configurados.

## 16. QR Code e validação

O painel permite validação por câmera ou código manual.

Regras:

- a câmera depende de HTTPS e permissão do navegador;
- o leitor possui tempo limitado de operação;
- a validação consulta o status real no servidor;
- QR Code não torna ticket pendente ou cancelado em válido;
- ticket usado não pode ser reutilizado;
- datas vazias são normalizadas antes de consultas PostgreSQL.

## 17. Painel administrativo

URL:

```text
/admin
```

Módulos principais:

- Dashboard;
- Filmes;
- Salas e sessões;
- Ingressos;
- Bilheteria;
- Bomboniere;
- Marketing;
- Clube;
- Usuários;
- Integrações.
- Logs.

O Dashboard separa receitas de ingresso, bomboniere, assinaturas e outros meios, permitindo rastrear a origem do faturamento.

Perfis:

| Role | Uso esperado |
| --- | --- |
| `owner` | Configurações, integrações e controle total |
| `manager` | Operação e gestão diária |
| `operator` | Bilheteria, consulta e validação permitidas |

Mutações administrativas relevantes registram ator, ação, entidade, IP, data e estado anterior/posterior sanitizado.

### Logs operacionais

O módulo de Logs centraliza eventos de aplicação e requisições relevantes com:

- nível `debug`, `info`, `warn` ou `error`;
- categoria e nome do evento;
- request ID para correlação;
- ator, rota, método e status HTTP quando aplicável;
- duração, IP, user agent e metadados sanitizados;
- filtros, paginação e limpeza por política de retenção.

Secrets, tokens, assinaturas completas e senhas não são persistidos. Em PostgreSQL, a retenção automática usa `SYSTEM_LOG_RETENTION_DAYS`, com padrão de 90 dias.

## 18. Bomboniere

O Admin controla:

- produtos;
- imagens por upload;
- categorias;
- preços;
- estoque;
- disponibilidade;
- descrições;
- combos;
- ordem de exibição.

As imagens persistem em diretório compartilhado da VPS e usam `object-fit: contain` no checkout. Produtos transparentes são integrados ao fundo navy sem container claro.

URLs externas de imagem não são usadas na Bomboniere ou nos planos. Filmes continuam podendo importar mídia externa pelo fluxo TMDB.

Uploads salvos em produtos e planos são persistidos antes da atualização visual do formulário. A interface sempre reconcilia a prévia com a URL local retornada pelo backend, evitando que a imagem desapareça ao salvar ou recarregar.

## 19. Filmes e TMDB

O Admin pesquisa um título e pode importar:

- título e título original;
- pôster;
- banner;
- sinopse;
- classificação;
- duração;
- gêneros;
- identificadores de mídia.

O operador revisa os dados antes de publicar. A ordenação do catálogo é persistida no backend e os status possuem identificação visual.

Status de publicação incluem filmes em cartaz, estreia e em breve. Filmes agendados podem mudar de categoria conforme a data configurada.

## 20. Uploads e imagens

Uploads administrativos usam:

```text
POST /api/uploads/images
```

Em produção, os arquivos ficam fora da release:

```text
/home/ubuntu/projects/cinecruzeiro/shared/uploads
```

Cada release aponta para esse diretório por symlink, evitando perda de mídia durante deploy.

Ativos de identidade mantidos no projeto:

```text
public/images/favicon.svg
public/images/favicon-64.png
public/images/favicon-email.png
public/images/logo-header-compact.webp
public/images/logo-pdf.jpg
backend/public/admin/favicon-admin.svg
```

O frontend usa uma versão compacta para header e metadados; e-mail e PDF usam variantes próprias para preservar legibilidade e evitar fundos indevidos. O painel possui favicon administrativo separado.

## 21. Integrações administráveis

| Integração | Finalidade |
| --- | --- |
| Mercado Pago | Orders, Pix, cartão, webhooks e Clube |
| Google Login | Autenticação social |
| Google Wallet | Passe oficial de ingresso |
| TMDB | Catálogo e mídia de filmes |
| E-mail | SMTP ou webhook de entrega |
| Nota fiscal | Emissão de NFS-e Nacional, consulta, PDF/XML e webhook via Focus NFe |
| CRM | Leads, eventos e automações |

Campos sensíveis são criptografados no backend e retornam mascarados ao painel.

## 22. PostgreSQL

Produção usa PostgreSQL. O JSON local existe apenas como fallback de desenvolvimento e testes específicos.

Migrations atuais:

```text
001_init.sql
002_password_reset.sql
003_box_office_payments.sql
004_club_subscriptions.sql
005_admin_dashboard_movies.sql
006_finance_dashboard_payments.sql
007_movie_sort_order.sql
008_remove_ebanx_pix_payments.sql
009_email_unsubscribe.sql
010_subscription_plan_media.sql
011_subscription_payment_state.sql
012_subscription_cancellation_lifecycle.sql
013_club_benefits.sql
014_session_ticket_types.sql
015_system_logs.sql
016_ticket_type_bundle_quantity.sql
017_fiscal_documents.sql
018_admin_two_factor.sql
```

A migration 017 adiciona o controle fiscal persistente por pedido, com status, tentativas, dados do tomador, links PDF/XML, entrega por e-mail e histórico do provedor.

A migration 018 adiciona autenticação em duas etapas às contas administrativas, com segredo TOTP criptografado, estado de configuração e códigos de recuperação armazenados somente como hash.

## 23. APIs principais

### Públicas e cliente

```text
GET  /api/health
GET  /api/content
GET  /api/subscription-plans
POST /api/events
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/password/request
POST /api/auth/password/reset
GET  /api/auth/email/verify
PATCH /api/me
POST /api/me/email-verification/request
GET  /api/me/tickets
GET  /api/me/subscriptions
POST /api/subscriptions/subscribe
POST /api/payments/pix
POST /api/payments/card
POST /api/webhooks/mercado-pago
POST /api/webhooks/focus-nfe
```

### Administrativas

```text
POST /api/admin/login
POST /api/admin/login/2fa
POST /api/admin/logout
GET  /api/admin/me
GET  /api/admin/2fa/status
POST /api/admin/2fa/setup
POST /api/admin/2fa/enable
POST /api/admin/2fa/disable
POST /api/admin/2fa/recovery-codes
GET  /api/admin/dashboard
GET  /api/admin/content
GET  /api/admin/integrations
POST /api/admin/email/promotions
GET  /api/admin/fiscal-documents
POST /api/admin/fiscal-documents
POST /api/admin/fiscal-documents/:id/issue
POST /api/admin/fiscal-documents/:id/sync
POST /api/admin/fiscal-documents/:id/send-email
GET  /api/admin/fiscal-documents/:id/download
GET  /api/admin/fiscal-reports.csv
GET  /api/admin/reports/dashboard.csv
GET  /api/admin/subscription-plans
POST /api/admin/subscription-plans
GET  /api/admin/subscriptions
POST /api/admin/subscriptions/assign
POST /api/uploads/images
POST /api/tickets/manual
POST /api/tickets/validate
```

Existem rotas parametrizadas adicionais para edição, cancelamento, exclusão, transferência, pedidos, sessões e recursos administrativos.

## 24. Segurança

Controles implementados:

- cookies HttpOnly para sessões;
- 2FA TOTP opcional para contas administrativas, com desafio curto e códigos de recuperação de uso único;
- RBAC no backend;
- hash de senha e tokens temporários;
- rate limit em autenticação e envio de e-mails;
- validação de origem e CORS;
- headers de segurança;
- secrets criptografados;
- mascaramento no Admin;
- HMAC de webhook Mercado Pago;
- idempotência de webhooks;
- auditoria de mutações;
- validação server-side de preço, estoque e status;
- logs estruturados sem secrets completos;
- uploads validados por formato e tamanho;
- PostgreSQL obrigatório em produção.

Nunca registrar ou versionar:

- access token do Mercado Pago;
- webhook secret;
- senha SMTP;
- private key da Google service account;
- JWT secret;
- string de conexão PostgreSQL;
- chave privada da VPS.

## 25. Variáveis de ambiente

Variáveis centrais:

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | Ambiente da aplicação |
| `PORT` | Porta do processo |
| `BIND_HOST` | Interface de rede do backend |
| `DATABASE_URL` | PostgreSQL |
| `DATA_STORE` | Store ativo |
| `JWT_SECRET` | Sessões e tokens |
| `INTEGRATION_SECRET_KEY` | Criptografia das integrações |
| `TWO_FACTOR_SECRET_KEY` | Chave dedicada para criptografar segredos TOTP (usa `INTEGRATION_SECRET_KEY`/`JWT_SECRET` como fallback) |
| `TWO_FACTOR_RECOVERY_PEPPER` | Pepper dedicado para hash dos códigos de recuperação (usa `JWT_SECRET` como fallback) |
| `FRONTEND_URL` | URL pública usada em links |
| `NEXT_PUBLIC_SITE_URL` | URL base do frontend |
| `NEXT_PUBLIC_BASE_PATH` | Base path público |
| `CINE_BACKEND_URL` | Backend usado pelo Next.js |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Validação HMAC |
| `FOCUS_NFE_API_TOKEN` | Token da API fiscal |
| `FOCUS_NFE_WEBHOOK_AUTHORIZATION` | Autorização privada do webhook fiscal |
| `FISCAL_NATIONAL_TAX_CODE` | Código nacional do ISS com 6 dígitos |
| `FISCAL_CNPJ` | CNPJ do prestador usado na NFS-e |
| `FISCAL_MUNICIPAL_REGISTRATION` | Inscrição municipal do prestador |
| `FISCAL_MUNICIPALITY_CODE` | Código IBGE do município de prestação |
| `ADMIN_EMAIL` | Conta administrativa inicial |
| `ADMIN_PASSWORD` | Senha administrativa inicial |
| `WEBHOOK_TESTER_ENABLED` | Simulador interno de webhooks |
| `TEST_DATABASE_URL` | Testes concorrentes PostgreSQL |

Integrações também podem ser configuradas pelo painel. Variáveis de ambiente funcionam como origem segura ou fallback conforme o provider.

## 26. Desenvolvimento local

Instalação:

```bash
npm ci
```

Frontend e backend:

```bash
npm run dev
```

URLs locais:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:4000
Admin:    http://localhost:4000/admin
```

Encerrar os processos:

```bash
npm run dev:stop
```

## 27. Banco de dados

Aplicar migrations:

```bash
npm run db:migrate
```

Criar dados iniciais:

```bash
npm run db:seed
```

As variáveis de conexão devem estar disponíveis no ambiente do processo que executa a migration.

## 28. Validação e testes

TypeScript:

```bash
npm run lint
```

Build de produção:

```bash
npm run build
```

Testes disponíveis:

```bash
npm test
```

O comando executa:

- smoke tests de API e fluxos essenciais;
- testes de assinatura do webhook Mercado Pago;
- testes concorrentes PostgreSQL quando `TEST_DATABASE_URL` existe.

Coberturas relevantes incluem autenticação, e-mail, evento privado, pagamento, cancelamento do Clube, crédito, webhook e criação de tickets.

## 29. Deploy na VPS

O procedimento operacional completo, com comandos, dados persistentes, rollback, health checks e politica de exclusao de releases, esta em [`DEPLOY_VPS.md`](DEPLOY_VPS.md). Esse runbook e a referencia para publicacoes em producao.

Estrutura atual:

```text
/home/ubuntu/projects/cinecruzeiro/
|-- current -> releases/<release-id>
|-- releases/
|-- shared/
|   |-- backend.runtime.env
|   |-- backend.env.local
|   |-- uploads/
|   `-- data/
`-- ecosystem.config.cjs
```

Processos PM2:

```text
cinecruzeiro-backend  -> 127.0.0.1:4100
cinecruzeiro-frontend -> 127.0.0.1:3100
```

Fluxo recomendado:

1. testar e gerar commit;
2. publicar no GitHub;
3. criar release isolada na VPS;
4. instalar dependências;
5. carregar env e uploads persistentes de `shared/`;
6. executar build;
7. aplicar migrations;
8. trocar o symlink `current` atomicamente;
9. recarregar PM2;
10. verificar health check e páginas públicas;
11. remover releases antigas somente após sucesso.

O deploy não deve alterar a aplicação principal da LumixEngine fora do caminho `/projects/cinecruzeiro`.

## 30. Operação diária

### Programação

1. cadastrar ou importar filme pelo TMDB;
2. revisar mídia e conteúdo;
3. definir status e estreia;
4. criar sessões ligadas à sala;
5. conferir capacidade e preços;
6. publicar e ordenar o catálogo.

### Bilheteria

1. selecionar venda rápida, cliente avulso ou cadastrado;
2. escolher filme e sessão;
3. informar quantidades;
4. registrar o meio de pagamento;
5. emitir ticket;
6. validar entrada por QR Code ou código manual.

### Clube

1. acompanhar pagamentos pendentes;
2. consultar titular pelo nome ou e-mail;
3. verificar créditos e ciclo;
4. cancelar renovação quando solicitado;
5. evitar reativação sem nova autorização;
6. consultar assinaturas finalizadas no histórico.

### Integrações

1. cadastrar credenciais no painel;
2. salvar;
3. testar conexão;
4. ativar somente após teste válido;
5. acompanhar logs e webhooks sem expor secrets.

### Notas fiscais

1. configurar a integração **Nota fiscal** em sandbox no painel;
2. cadastrar CNPJ, inscrição municipal, município, item da lista, código tributário e alíquota conforme orientação contábil;
3. testar a conexão e ativar emissão automática somente após a homologação;
4. acompanhar documentos em **Notas fiscais**, corrigindo CPF/CNPJ ausente antes da emissão;
5. emitir ou sincronizar manualmente quando necessário;
6. baixar PDF/XML, reenviar por e-mail e exportar o relatório fiscal em CSV;
7. usar o relatório consolidado do Dashboard para conciliar ingressos, bomboniere, Clube e documentos fiscais.

O controle nasce apenas para pedidos pagos. A referência fiscal é idempotente por pedido, evitando duplicidade em reprocessamentos. Por padrão, itens de bomboniere ficam fora da base de serviço da NFS-e; essa regra pode ser alterada na integração somente após validação contábil.

Para Cruzeiro/SP, emissão e consulta usam o padrão nacional da Focus NFe (`/v2/nfsen`). No cadastro da empresa na Focus NFe, é obrigatório habilitar **Ambiente da NFS-e Nacional** no ambiente utilizado e desabilitar a NFS-e municipal; essa habilitação pertence à conta externa da Focus e não é alterada silenciosamente pelo Cine Cruzeiro.

Status operacionais principais:

```text
Pronta -> Em fila -> Processando -> Autorizada
                  -> Rejeitada
Pendente de configuração
Pendente de dados do cliente
Não aplicável
Cancelada
```

O e-mail fiscal é transacional, usa o layout do Cine Cruzeiro e anexa os arquivos disponíveis. Secrets, tokens e autorizações nunca são retornados sem máscara no painel nem gravados completos nos logs.

## 31. Dependências externas e pendências reais

Recursos que dependem de configuração externa:

- Mercado Pago requer credenciais e webhook secret do ambiente correto;
- Google Wallet requer issuer, class e service account aprovados;
- Google Login requer OAuth e redirect URI válidos;
- TMDB requer API key ou bearer token;
- SMTP requer host, porta, usuário, senha e remetente válidos;
- NFS-e requer credenciais Focus NFe, cadastro municipal habilitado e parâmetros tributários homologados pelo contador;
- câmera requer HTTPS, permissão do navegador e dispositivo compatível.

Antes de uma nova liberação, homologar pelo menos:

- Pix real e webhook;
- pagamento recorrente do Clube;
- cancelamento sem nova cobrança;
- verificação e recuperação por e-mail;
- solicitação de eventos;
- upload de imagens;
- emissão, PDF, Wallet e validação de ingresso;
- responsividade mobile do checkout e Admin.

## 32. Identidade visual

Diretrizes atuais:

- fundo navy escuro;
- amarelo/dourado apenas como destaque e ação principal;
- tipografia de alto contraste;
- ícones Lucide no lugar de emojis;
- cards com raio contido;
- poucas bordas sólidas;
- sombras suaves e separação por espaçamento;
- controles compactos no Admin;
- imagens reais ou mídia oficial;
- prioridade para telas mobile sem rolagem horizontal.

## 33. Referências complementares

- `DESIGN.md`: sistema visual e decisões de interface;
- `PRODUCT.md`: posicionamento, usuários e princípios de produto;
- `DOCUMENTACAO.md`: documentação histórica extensa, podendo conter decisões anteriores já substituídas por este README.

Este `README.md` é a referência resumida e canônica para o estado atual do código em 27 de agosto de 2026.
