# Documentação Técnica e Estratégica - Cine Cruzeiro

## Status De Produção

Legenda:

- ✅ Produção: implementado, testado e homologado.
- 🧪 Validação: implementado tecnicamente, ainda precisa homologação.
- 🚧 Parcial: integração ou recurso incompleto.
- 📋 Planejado: não implementado.
- ⛔ Bloqueado: não pode ser liberado.

| Área | Status | Observação |
| --- | --- | --- |
| Landing pública | 🧪 Implementado / validação | Usa API real, skeleton e erro amigável. |
| Admin | 🧪 Implementado / validação | Exige login por cookie HttpOnly, possui logout e protege acesso direto ao HTML do painel. |
| RBAC | 🧪 Implementado / validação | Roles `owner`, `manager`, `operator` controlam rotas administrativas por ação. |
| PostgreSQL | 🧪 Validação | Migrations, seed, store runtime e lock transacional existem; em produção PostgreSQL é obrigatório e `db.json` só vale para dev/test. |
| Pix | 🚧 Parcial | Provider Open Finance isolado em `PaymentService`; requer instituição/provedor real configurado. |
| Cartão | 🧪 Validação | Frontend gera `cardToken` com SDK oficial Mercado Pago e backend processa via provider Mercado Pago; requer credenciais e homologação. |
| Tickets | 🧪 Implementado / validação | Tickets só devem ser liberados após pagamento aprovado ou venda manual autenticada. |
| Reservas e estoque | 🧪 Implementado / validação | Checkout reserva capacidade/estoque temporariamente; aprovação move reserva para vendido; expiração/cancelamento libera reserva. |
| Sessão do cliente | 🧪 Implementado / validação | Login/cadastro/Google criam cookie `HttpOnly`; checkout convidado continua permitido. |
| Consulta de tickets | 🧪 Implementado / validação | Usa `/api/me/tickets` com identidade vinda da sessão; não aceita e-mail/CPF como autenticação. |
| Transferência de tickets | 🧪 Implementado / validação | Permitida somente para ticket pago, válido, não usado e não arquivado; troca dono, rotaciona QR Code e registra auditoria. |
| Google Wallet | 🚧 Parcial | Endpoint oficial de JWT `savetowallet` implementado; produção exige issuer/class/service account configurados. |
| Perfil do cliente | 🧪 Implementado / validação | Permite editar nome, WhatsApp, CPF e senha; troca de e-mail exige token de verificação. |
| Recuperação de senha | 🧪 Implementado / validação | Token temporário é armazenado com hash; em dev o token é retornado para teste, em produção deve ir por canal configurado. |
| Webhooks de pagamento | 🧪 Validação | Endpoints têm idempotência, validação obrigatória em produção e consulta server-to-server quando possível; requer homologação com providers reais. |
| CRM | 🧪 Implementado / validação | Frontend envia evento interno ao backend; URL privada fica no backend. |
| Erros e logs | 🧪 Implementado / validação | Respostas usam `{ error: { code, message } }`; logs são JSON sanitizados. |
| Testes locais | 🧪 Validação | `npm test` cobre smoke JSON e inclui testes PostgreSQL concorrentes quando `TEST_DATABASE_URL` está configurada. |
| Clube Cine Cruzeiro | 📋 Planejado | UI coleta interesse; assinatura recorrente real fica no roadmap. |
| Gerador manual de JWT | 🧪 Validação | Removido do admin. |
| Auditoria admin | 🧪 Implementado / validação | Mutações administrativas registram usuário, ação, entidade, IP e antes/depois sanitizados. |

## 1. Visão Geral

O Cine Cruzeiro é um sistema web para modernizar a venda de ingressos, a programação e a operação comercial de um cinema de rua tradicional. O projeto une uma landing page de alta conversão com um painel administrativo próprio, permitindo que o dono do cinema controle filmes, sessões, preços, bomboniere, promoções, anúncios, usuários, vendas manuais e validação de ingressos.

A proposta central do produto é reduzir a fricção da compra pelo celular:

1. O cliente escolhe o filme.
2. Seleciona a sessão.
3. Adiciona ingressos, bomboniere e promoções.
4. Informa dados mínimos.
5. Escolhe Pix ou cartão.
6. O backend aguarda confirmação confiável.
7. Recebe ingresso digital com código e QR Code quando o pagamento é aprovado.

O sistema foi pensado para competir com redes de shopping sem copiar a experiência delas. A identidade do Cine Cruzeiro valoriza preço justo, bairro, tradição, cultura local, sala única e atendimento direto.

## 2. Objetivos do Sistema

### Objetivos comerciais

- Aumentar a conversão mobile via checkout rápido.
- Padronizar o ingresso promocional permanente em R$ 10,00.
- Monetizar além do ingresso com bomboniere, combos, promoções e futura assinatura recorrente do clube.
- Reduzir fila e dependência de atendimento manual.
- Dar ao dono do cinema autonomia para alterar catálogo, sessões e campanhas.
- Preservar a alma de cinema de rua, evitando aparência genérica ou artificial.

### Objetivos técnicos

- Separar frontend e backend.
- Evitar mocks falsos quando o backend falhar.
- Usar API centralizada para conteúdo e vendas.
- Integrar TMDB para acelerar cadastro de filmes.
- Preparar Pix via Open Finance e cartão via Mercado Pago.
- Gerar ingressos digitais com QR Code.
- Permitir validação de QR Code no painel administrativo.
- Manter o código simples o suficiente para evolução rápida.

## 3. Stack Tecnológica

### Frontend

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- Lucide React
- next/image
- localStorage para carrinho e dados locais não sensíveis do cliente
- MercadoPago.js via `@mercadopago/sdk-js` para tokenização de cartão
- Cookie `HttpOnly` para sessão de conta

### Backend

- Node.js 18+
- Servidor HTTP nativo
- CommonJS
- PostgreSQL como persistência de produção
- JSON local como fallback de desenvolvimento/compatibilidade
- Integrações HTTP externas via `fetch`
- Criptografia nativa com `crypto`
- Geração de QR Code com `qrcode`
- Leitura de QR Code no admin com `jsQR`

### Por que essas escolhas

| Escolha | Motivo |
| --- | --- |
| Next.js | Entrega rápida, bom suporte a imagem, metadata, build otimizado e experiência moderna de React. |
| React | Interface altamente interativa: checkout, carrinho, conta, modais, filtros e catálogo. |
| TypeScript | Reduz erro em entidades importantes como `Movie`, `Session`, `TicketOrder` e `ConcessionItem`. |
| Tailwind CSS | Velocidade para criar UI responsiva e manter consistência visual sem CSS muito espalhado. |
| Lucide Icons | Ícones SVG limpos e profissionais no lugar de emojis. |
| Backend Node nativo | Mantém o backend leve, direto e fácil de rodar localmente sem framework adicional. |
| PostgreSQL + fallback JSON | PostgreSQL dá transações, integridade e migrations; JSON preserva execução local simples apenas em desenvolvimento/testes. Em produção, ausência de PostgreSQL impede inicialização. |

## 4. Como Rodar o Projeto

### Instalar dependências

```bash
npm install
```

### Rodar frontend e backend juntos

```bash
npm run dev
```

Esse comando inicia:

- Landing page: `http://localhost:3000`
- Admin: `http://localhost:4000/admin`

### Encerrar servidores locais

```bash
npm run dev:stop
```

Esse comando libera as portas `3000` e `4000`.

### Rodar separadamente

```bash
npm run dev:frontend
npm run dev:backend
```

### Build de produção do frontend

```bash
npm run build
```

## 4.1 APIs de Conta e Ingressos

- `GET /api/me/tickets`: retorna `tickets`, `upcoming` e `archived`. O backend arquiva visualmente ingressos usados ou 4 horas após a sessão.
- `GET /api/me/tickets/:id`: retorna detalhes enriquecidos do ingresso, incluindo filme, sala, pedido, extras e permissões.
- `GET /api/me/tickets/:id/download`: baixa um ingresso HTML imprimível com QR Code gerado no backend.
- `POST /api/me/tickets/:id/google-wallet`: gera link oficial `https://pay.google.com/gp/v/save/{jwt}` quando Google Wallet estiver configurado.
- `POST /api/me/tickets/:id/transfer`: transfere para outro usuário cadastrado por e-mail, rotaciona `code`/`qrPayload` e grava `ticketTransfers`.
- `PATCH /api/me`: atualiza dados de perfil sem permitir troca direta de e-mail.
- `POST /api/me/email-change/request`: cria token para verificar novo e-mail.
- `POST /api/me/email-change/confirm`: efetiva a troca de e-mail após token válido.

Variáveis externas relevantes:

- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_CLASS_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` com uma chave JSON nova da Service Account
- `GOOGLE_WALLET_ORIGINS`
- `EMAIL_VERIFICATION_WEBHOOK_URL`

O painel de integrações também aceita configurar o Google Wallet por JSON da Service Account. O backend extrai `client_email` e `private_key`, criptografa a credencial e nunca devolve a chave ao navegador. A geração de passes usa `EventTicketObject` com `aud=google`, `typ=savetowallet`, origem sem subpasta e `classId` completo do Issuer.

## 5. Estrutura de Pastas

```text
Cine Cruzeiro/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ AccountModal.tsx
│  │  ├─ CartDrawer.tsx
│  │  ├─ CheckoutModal.tsx
│  │  ├─ ClubLeadForm.tsx
│  │  ├─ DifferentiatorsSection.tsx
│  │  ├─ Footer.tsx
│  │  ├─ Header.tsx
│  │  ├─ Hero.tsx
│  │  ├─ MovieCard.tsx
│  │  ├─ MoviesSection.tsx
│  │  ├─ PrivateEventForm.tsx
│  │  ├─ Toast.tsx
│  │  ├─ TraditionSection.tsx
│  │  └─ TrailerModal.tsx
│  ├─ services/
│  │  ├─ cinemaApi.ts
│  │  └─ webhook.ts
│  └─ types/
│     └─ index.ts
├─ backend/
│  ├─ server.js
│  ├─ db/
│  │  ├─ migrations/
│  │  │  ├─ 001_init.sql
│  │  │  └─ 002_password_reset.sql
│  │  ├─ postgresStore.js
│  │  └─ seed.sql
│  ├─ services/
│  │  └─ paymentService.js
│  ├─ data/
│  │  └─ db.json
│  └─ public/
│     ├─ admin.html
│     ├─ admin.css
│     ├─ admin.js
│     ├─ jsQR.js
│     └─ trailers/
├─ public/
│  └─ images/
├─ scripts/
│  ├─ db-import-json.js
│  ├─ db-migrate.js
│  ├─ db-seed.js
│  ├─ dev-all.js
│  ├─ postgres-concurrency-tests.js
│  ├─ smoke-tests.js
│  └─ stop-dev.js
├─ next.config.mjs
├─ tailwind.config.ts
├─ package.json
└─ DOCUMENTACAO.md
```

## 6. Arquitetura Geral

O sistema possui duas aplicações:

1. Frontend público em Next.js.
2. Backend/admin em Node.js.

Fluxo principal:

```text
Cliente
  ↓
Frontend Next.js
  ↓ fetch
Backend Node.js
  ↓
PostgreSQL ou backend/data/db.json em desenvolvimento
  ↓
Integrações externas
TMDB / Open Finance Pix / Mercado Pago Cartão / Google OAuth / Webhook CRM
```

Arquitetura de produção:

```text
                         Browser
                            │
                         Next.js
                            │
                         Backend
                            │
        ┌───────────────────┼──────────────────┐
        │                   │                  │
    PostgreSQL        Open Finance       Mercado Pago
                           PIX               Cartão
        │
        ├── TMDB
        ├── Google
        └── CRM
```

O frontend nunca deve inventar uma programação falsa quando o backend falha. Se `/api/content` falhar, a landing exibe uma mensagem amigável e um botão de tentar novamente. Durante carregamento, a página exibe skeleton loaders.

## 7. Frontend Público

### Arquivo central

`src/app/page.tsx`

Esse arquivo orquestra a landing:

- Carrega conteúdo com `fetchCinemaContent`.
- Exibe skeleton durante carregamento.
- Exibe erro amigável se o backend falhar.
- Renderiza as seções principais.
- Controla checkout, trailer, carrinho, minha conta e toast.

### Seções principais

| Componente | Função |
| --- | --- |
| `Header` | Navegação, chamada para compra, carrinho e minha conta. |
| `Hero` | Filme em destaque, trailer de fundo opcional, sessões e CTA principal. |
| `MoviesSection` | Filmes em cartaz e em breve, calendário real vindo do backend. |
| `DifferentiatorsSection` | Argumento comercial contra redes de shopping. |
| `TraditionSection` | Tradição, cultura e fotografia/placeholder da fachada ou sala. |
| `ClubLeadForm` | Vitrine do Clube Cine Cruzeiro com planos mensais e CTA de interesse. |
| `PrivateEventForm` | Fechamento de sala para festas, games e corporativo. |
| `CheckoutModal` | Fluxo de compra por etapas. |
| `CartDrawer` | Resumo do carrinho separado. |
| `AccountModal` | Login, cadastro, conta e ingressos comprados. |
| `TrailerModal` | Player de trailer sob demanda. |
| `Toast` | Feedback de sucesso ou aviso. |

### Fluxo da página inicial

1. O frontend chama `/api/content`.
2. O backend retorna filme em destaque, filmes em cartaz, próximos filmes, calendário, salas, ingressos, bomboniere, promoções, anúncios e settings.
3. O frontend monta a experiência.
4. O cliente inicia compra pelo filme em destaque ou por um card do catálogo.
5. O checkout abre com ingresso, bomboniere, promoção e pagamento.

## 8. Checkout

### Arquivo principal

`src/components/CheckoutModal.tsx`

O checkout é dividido em etapas:

1. Ingressos
2. Bomboniere
3. Ofertas, somente quando existirem campanhas ativas
4. Checkout
5. Pix pronto ou confirmação do cartão

### Por que dividir em etapas

O público principal compra pelo celular. Um formulário grande em tela pequena causa abandono. A divisão em etapas reduz carga cognitiva e permite upsell sem travar a compra.

### Ingressos

O usuário escolhe:

- Inteira
- Meia

Os preços vêm da sessão selecionada. O padrão do projeto é R$ 10,00 para inteira e meia, conforme estratégia promocional permanente.

### Bomboniere

A bomboniere é carregada do backend. Cada produto pode ter:

- SKU
- Nome
- Descrição
- Imagem
- Selo comercial
- Preço
- Preço comparativo
- Categoria
- Estoque
- Limite por pedido
- Destaque
- Ordem
- Tags
- Itens que compõem o combo

Se nenhum produto ativo estiver disponível, o checkout mostra uma mensagem limpa e permite continuar sem inventar produtos falsos.

### Promoção especial

Existe uma etapa para campanhas avulsas cadastradas no admin como categoria `promocao` ou com tags `promocao`/`promo`. Exemplos: foto temática em estreia infantil, combo de evento, brinde limitado ou ação de lançamento.

Essa etapa não é hardcoded. Se nenhuma oferta ativa estiver cadastrada no backend, ela desaparece do fluxo e o cliente vai da bomboniere direto para o checkout.

### Dados do cliente

Campos:

- Nome
- WhatsApp
- E-mail
- CPF opcional para nota fiscal

Também existe login opcional para clientes recorrentes. O checkout de visitante continua sendo o caminho padrão.

### Pagamento

O cliente escolhe:

- Pix
- Cartão de crédito

O frontend envia o pedido para `/api/payments/pix` ou `/api/payments/card`. O backend recalcula o valor e cria um pagamento pendente:

- Código Pix copia e cola
- QR Code base64, quando disponível
- URL de pagamento, quando disponível
- Pedido salvo como `pending_payment`
- Ingressos somente depois de confirmação `approved`

## 9. Carrinho

O carrinho usa `localStorage` para persistir o estado local da compra antes do pagamento.

Chave usada:

```text
cine-cruzeiro-cart
```

O carrinho armazena:

- Filme
- Sessão
- Quantidade de ingressos
- Produtos da bomboniere
- Cupom
- Provedor de pagamento
- Promoção especial

Essa escolha reduz fricção: se o cliente fecha o modal ou navega pela página, o carrinho continua disponível no mesmo dispositivo.

## 10. Minha Conta

O sistema possui conta de cliente com:

- Cadastro por e-mail e senha
- CPF para nota fiscal
- Login por e-mail e senha
- Login com Google
- Lista de ingressos comprados
- Código do ingresso
- QR Code
- Orientação por gesto para apresentar o QR ao operador

Dados locais temporários:

```text
cine-cruzeiro-customer
```

O backend lista ingressos em `/api/me/tickets` usando a sessão do cliente. E-mail e CPF não autenticam consulta de ingresso.

## 11. Painel Administrativo

### URL

```text
http://localhost:4000/admin
```

### Arquivos

- `backend/public/admin.html`
- `backend/public/admin.css`
- `backend/public/admin.js`

### Módulos do admin

| Módulo | Função |
| --- | --- |
| Filmes | Criar, editar, destacar, ocultar e programar filmes. |
| Salas | Gerenciar sala, capacidade, tecnologia e status. |
| Ingressos | Gerenciar o catálogo de tipos e preços; cada sessão escolhe quais tipos aceita. |
| Pedidos | Visualizar pedidos Pix e itens vendidos. |
| Venda manual | Atribuir/vender ingresso manualmente. |
| QR Code | Ler ou digitar código para validar ingresso. |
| Bomboniere | Customizar produtos, combos, imagens, preços e estoque. |
| Promoções | Criar campanhas e cupons. |
| Anúncios | Configurar destaques e comunicação comercial. |
| Usuários | Gerenciar contas, papéis e acesso. |
| Settings | Ajustar anúncio superior e trailer de fundo. |
| Logs | Filtrar, inspecionar e exportar eventos, falhas, requisições e auditoria. |

### Autenticação e RBAC

O admin exige login em `/admin`. A sessão administrativa fica em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.

Papéis:

- `owner`: acesso total, usuários, configurações e conteúdo amplo.
- `manager`: filmes, salas, preços, bomboniere, marketing, pedidos e operação.
- `operator`: pedidos, venda manual e validação de QR Code.

Rotas administrativas são bloqueadas no backend por papel. A interface escondida não é considerada segurança; a autorização real fica no servidor.

### Auditoria

Mutações administrativas registram entrada em `auditLogs`/`audit_logs` com:

- usuário;
- e-mail;
- ação;
- entidade;
- IP;
- antes/depois sanitizados.

Campos sensíveis, como hash de senha, token, segredo, payload bruto de provider e Pix copia-e-cola, são mascarados como `[redacted]`.

O módulo **Logs** complementa a auditoria com eventos operacionais persistidos em `system_logs`. Proprietários e gerentes podem filtrar por nível, categoria, período, rota, usuário ou `requestId`; somente o proprietário pode aplicar a limpeza por retenção. A retenção automática usa `SYSTEM_LOG_RETENTION_DAYS`, com padrão de 90 dias.

### Por que o admin é HTML/CSS/JS puro

O painel fica servido pelo próprio backend e não depende do build do Next.js. Isso torna a operação local simples: se o backend está rodando, o admin também está. Para o porte atual, essa arquitetura reduz acoplamento.

Em uma versão futura, o admin pode ser migrado para uma área Next.js protegida ou para uma SPA própria.

## 12. Filmes e Catálogo

### Modelo de filme

Definido em `src/types/index.ts`:

- `id`
- `status`
- `title`
- `originalTitle`
- `synopsis`
- `duration`
- `genre`
- `rating`
- `posterUrl`
- `backdropUrl`
- `trailerYoutubeId`
- `trailerVideoUrl`
- `localTrailerUrl`
- `trailerSourceUrl`
- `trailerCacheStatus`
- `isHighlight`
- `highlightTrailerBackground`
- `releaseDate`
- `autoPublish`
- `publishedAt`
- `tag`
- `sessions`

### Status

| Status | Uso |
| --- | --- |
| `now_playing` | Filme em cartaz com ingressos disponíveis. |
| `upcoming` | Filme em breve. |
| `hidden` | Filme oculto da landing. |

### Estreia automática

O backend aplica `applyScheduledPremieres(db)` ao atender chamadas de API. Filmes em `upcoming` com `autoPublish` e data de estreia atingida podem migrar automaticamente para `now_playing`.

Isso permite que o dono programe filmes antes da estreia e deixe o sistema publicar no dia correto.

## 13. Integração TMDB

### Objetivo

Reduzir trabalho manual ao cadastrar filmes. O admin pesquisa o título e o backend busca dados no TMDB:

- Título
- Título original
- Sinopse
- Pôster
- Backdrop
- Classificação
- Duração
- Gêneros
- Trailer do YouTube, quando disponível

### Variáveis aceitas

```env
TMDB_BEARER_TOKEN=
TMDB_ACCESS_TOKEN=
THEMOVIEDB_BEARER_TOKEN=
TMDB_API_KEY=
THEMOVIEDB_API_KEY=
```

`NEXT_PUBLIC_TMDB_API_KEY` é aceito apenas como compatibilidade local antiga. Para produção, use chave TMDB somente no backend.

### Endpoints

- `GET /api/tmdb/search?query=...`
- `GET /api/tmdb/movie/:id`

### Por que usar TMDB

O TMDB centraliza dados públicos de catálogo e reduz o risco de pôster errado, sinopse vazia e cadastro lento. Para cinema pequeno, isso economiza operação.

## 14. Trailer de Fundo

O filme em destaque pode exibir trailer de fundo sem áudio no hero.

### Campos relacionados

- `movie.isHighlight`
- `movie.highlightTrailerBackground`
- `movie.trailerYoutubeId`
- `movie.trailerVideoUrl`
- `movie.localTrailerUrl`
- `settings.heroTrailerBackgroundEnabled`

### Cache local

O backend possui suporte para armazenar trailer em:

```text
backend/public/trailers/
```

Quando um filme entra em destaque, o backend pode sincronizar o trailer local. Ao remover o destaque, o trailer pode ser limpo. Essa abordagem evita depender totalmente do carregamento externo na home e reduz elementos indesejados de players externos.

### Decisão de UX

O trailer de fundo deve:

- Rodar sem áudio.
- Não exibir controles.
- Não esconder texto principal.
- Manter legibilidade com overlay.
- Não cortar informação essencial quando possível.

## 15. Bomboniere

### Objetivo

Transformar a bomboniere em fonte real de receita, não apenas um item fixo de pipoca.

### Modelo

`ConcessionItem`:

- `id`
- `sku`
- `name`
- `description`
- `imageUrl`
- `badge`
- `price`
- `compareAt`
- `category`
- `stock`
- `maxPerOrder`
- `featured`
- `sortOrder`
- `tags`
- `comboItems`
- `active`

### Categorias

- `combo`
- `pipoca`
- `bebida`
- `doce`
- `outro`

### Funcionalidades

- Cadastro completo no admin.
- Preview de imagem.
- Controle de ativo/inativo.
- Ordenação comercial.
- Destaque de produtos.
- Limite por pedido.
- Estoque numérico ou ilimitado.
- Baixa automática de estoque ao gerar pedido Pix.
- Exibição no checkout em carrossel mobile.
- Exibição de itens vendidos em pedidos.
- Indicadores de itens vendidos, receita e produto mais vendido.

### Por que a bomboniere fica no checkout

O melhor momento de oferecer combo é depois da escolha do ingresso, quando a intenção de compra já existe. O carrossel horizontal respeita o uso no celular e permite upsell sem bloquear o fluxo.

## 16. Promoções e Anúncios

O admin possui módulos para promoções e anúncios.

Promoções podem ser usadas para:

- Cupons
- Campanhas sazonais
- Preços especiais
- Ações com personagens
- Foto temática
- Combos promocionais

Anúncios podem ser usados para:

- Chamada no topo
- Destaque de lançamento
- Comunicação institucional
- Campanhas de bairro

## 17. Clube Cine Cruzeiro

### Estado atual

O frontend possui uma seção comercial para o Clube Cine Cruzeiro com dois planos:

- Plano Individual: R$ 24,90/mês
- Plano Duplo: R$ 44,90/mês

A UI apresenta benefícios e preços planejados, mas os botões são de lista de interesse. Não há cobrança nessa etapa e o texto informa que a assinatura recorrente será ativada apenas quando a cobrança oficial estiver pronta.

### Próximo passo técnico

Para transformar o Clube em recorrência real, o backend deve ganhar:

- Endpoint de criação de plano.
- Endpoint de assinatura.
- Integração com API de assinaturas do Mercado Pago.
- Webhook de pagamento recorrente.
- Associação entre assinatura e usuário.
- Controle de benefícios mensais usados.
- Tela administrativa de assinantes.

### Por que separar do checkout comum

Ingresso avulso é transação pontual. Clube é relacionamento mensal. Separar os fluxos evita misturar lógica de pedido único com lógica de cobrança recorrente, renovação, inadimplência e benefícios acumulados.

## 18. Ingressos Digitais e QR Code

### Geração

Ao criar um pedido pago ou venda manual, o backend gera tickets com:

- Código único
- Payload de QR Code
- Filme
- Sessão
- Tipo do ingresso
- Cliente
- Status
- Origem

Formato do payload:

```text
CINECRUZEIRO:TICKET:CC-XXXXXXXX
```

### Validação

Endpoint:

```http
POST /api/tickets/validate
```

Corpo:

```json
{
  "code": "CC-XXXXXXXX"
}
```

Se válido, o ingresso passa para `used`. O operador responsável vem da sessão administrativa autenticada e é gravado em `usedBy`. Se já tiver sido usado, o backend retorna erro com status de conflito.

### Leitura de câmera

O admin usa `jsQR` para leitura no navegador quando suportado. Quando a leitura nativa/câmera não estiver disponível, o sistema permite digitar o código manualmente.

## 19. Pagamentos

### Camada de pagamentos

O backend usa `backend/services/paymentService.js` como porta única para pagamentos.

Responsabilidades:

- Criar Pix via provider Open Finance.
- Criar cartão via Mercado Pago usando token oficial.
- Normalizar status externos para o domínio interno.
- Criar registros `payments` separados de `orders`.
- Validar webhooks; em produção, ausência de secret/configuração de validação bloqueia processamento.
- Consultar status server-to-server quando o provider permitir.

### Mercado Pago

Uso no Cine Cruzeiro:

```text
Cartão de crédito
```

Mercado Pago é o provedor ativo para Pix e cartão no Checkout Transparente.

Variáveis:

```env
MERCADO_PAGO_ACCESS_TOKEN=
MP_ACCESS_TOKEN=
MERCADOPAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_WEBHOOK_SECRET_SANDBOX=
MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION=
MP_WEBHOOK_SECRET=
MERCADOPAGO_WEBHOOK_SECRET=
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=
WEBHOOK_TESTER_ENABLED=true
```

Endpoint de pagamentos usado pelo backend:

```text
https://api.mercadopago.com/v1/orders
```

O backend cria Pix e pagamentos de cartão pela API de Orders com:

- Valor
- Descrição
- Referência externa
- Dados do pagador
- Metadata da sessão
- Token de cartão gerado no frontend pelo mecanismo oficial do Mercado Pago

O navegador nunca envia ao backend número completo, CVV ou validade bruta. Esses dados são usados somente pelo SDK oficial do Mercado Pago para gerar `cardToken`.

### Webhook Mercado Pago

URL pública, sem autenticação de usuário ou JWT:

```text
POST /api/webhooks/mercado-pago?data.id=<RESOURCE_ID>&type=order
```

A origem é validada com `x-signature`, `x-request-id`, o valor exato de `data.id` da query string e o Segredo do webhook configurado no painel do Mercado Pago. O manifesto HMAC-SHA256 é:

```text
id:<data.id>;request-id:<x-request-id>;ts:<ts>;
```

O Segredo do webhook não é o Access Token. Notificações com assinatura inválida ou campos obrigatórios ausentes retornam `401`; eventos assinados ainda não suportados retornam `200` sem alterar pedidos. A chave idempotente combina ação, resource ID e revisão/status para impedir geração duplicada de pagamentos, créditos, e-mails ou ingressos em reenvios.

O proxy do Next.js preserva `x-signature`, `x-request-id` e a query string ao encaminhar a rota pública ao backend.

### Simulador interno

Disponível somente para administradores proprietários em `Integrações → Mercado Pago → Testar Webhook`. O simulador assina e envia uma requisição HTTP ao próprio endpoint público, passando pelo mesmo validador e handler das notificações reais.

Ele cobre notificação válida, assinatura/header/query ausentes ou inválidos, evento desconhecido, recurso inexistente, `order.action_required`, `order.processed` e reenvio idempotente. Defina `WEBHOOK_TESTER_ENABLED=false` para desativá-lo completamente; o endpoint público do Mercado Pago permanece ativo.

### Pix via Open Finance

Variáveis:

```env
OPEN_FINANCE_PIX_ENDPOINT=
PIX_OPEN_FINANCE_ENDPOINT=
OPEN_FINANCE_PIX_STATUS_ENDPOINT=
PIX_OPEN_FINANCE_STATUS_ENDPOINT=
OPEN_FINANCE_PIX_TOKEN=
PIX_OPEN_FINANCE_TOKEN=
OPEN_FINANCE_WEBHOOK_SECRET=
PIX_OPEN_FINANCE_WEBHOOK_SECRET=
```

Essa integração é genérica porque provedores Open Finance variam. O backend envia:

- Valor
- Moeda BRL
- Referência externa
- Descrição
- Dados do pagador
- Metadata do pedido

Em produção, Pix fica indisponível enquanto nenhum endpoint/provider Open Finance real estiver configurado. O modo de teste só existe para desenvolvimento e testes automatizados.

### Fluxo Pix

```text
Checkout
↓
Order pending_payment
↓
Open Finance Pix
↓
Confirmação da instituição
↓
Payment approved
↓
Order paid
↓
Tickets
```

### Fluxo Cartão

```text
Checkout
↓
Tokenização
↓
Mercado Pago
↓
Pagamento aprovado
↓
Order paid
↓
Tickets
```

### Ciclo do pedido

```text
CART
↓
pending_payment
↓
provider
↓
approved
↓
paid
↓
ticket valid
↓
ticket used
```

Estados alternativos:

```text
expired
rejected
cancelled
refunded
```

### Endpoints internos

```http
POST /api/payments/pix
POST /api/payments/card
POST /api/webhooks/open-finance
POST /api/webhooks/mercado-pago
```

Corpo Pix:

```json
{
  "idempotencyKey": "checkout-uuid",
  "order": {
    "movieId": "duna-parte-2",
    "sessionId": "duna-1",
    "fullTicketsCount": 1,
    "halfTicketsCount": 0,
    "concessionItems": [
      { "id": "combo-classico", "quantity": 1 }
    ],
    "couponCode": "CINE10",
    "customerName": "Cliente",
    "customerEmail": "cliente@email.com",
    "customerPhone": "(00) 00000-0000"
  }
}
```

Corpo cartão:

```json
{
  "cardToken": "token_gerado_pelo_mercado_pago_js",
  "installments": 1,
  "paymentMethodId": "visa",
  "issuerId": "issuer_opcional",
  "idempotencyKey": "checkout-uuid",
  "order": {
    "movieId": "duna-parte-2",
    "sessionId": "duna-1",
    "fullTicketsCount": 1,
    "customerName": "Cliente",
    "customerEmail": "cliente@email.com",
    "customerCpf": "00000000000"
  }
}
```

O backend ignora preço, título do filme e horário enviados pelo navegador. IDs e quantidades são usados para buscar catálogo, validar sessão/capacidade/estoque e calcular o total.

Regra importante:

```text
payment.status = approved
```

é a única condição que permite:

```text
order.status = paid
geração/liberação de tickets
```

Status `pending` ou `processing` não libera ingresso.

## 20. Autenticação

### Cadastro e login

Endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`

O cadastro aceita:

- Nome
- E-mail
- Senha
- WhatsApp
- CPF

### Senhas

As senhas são armazenadas com hash:

```text
pbkdf2_sha256
120000 iterações
salt aleatório
```

### Sessão do cliente

O backend cria sessão de cliente em cookie:

```text
cine_customer
HttpOnly
SameSite=Lax
Secure em produção
```

O JWT HMAC SHA-256 ainda existe como mecanismo interno/compatibilidade, mas o frontend novo não depende de token salvo em `localStorage`.

Variáveis:

```env
JWT_SECRET=
ADMIN_JWT_SECRET=
```

### Google OAuth

Variáveis:

```env
GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
FRONTEND_URL=
NEXT_PUBLIC_SITE_URL=
```

Fluxo:

1. Frontend abre `/api/auth/google/start`.
2. Backend redireciona para Google.
3. Google retorna para `/api/auth/google/callback`.
4. Backend cria/atualiza usuário.
5. Backend cria cookie `HttpOnly`.
6. Backend redireciona para o frontend com URL limpa.
7. Frontend consulta `/api/auth/me` quando precisa carregar a conta.

## 21. API do Backend

Base local:

```text
http://localhost:4000
```

### Conteúdo

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/health` | Health público mínimo: `{ "status": "ok" }`. |
| GET | `/api/content` | Conteúdo completo da landing. |
| PUT | `/api/content` | Atualização ampla restrita ao owner e payload com chaves permitidas. |
| PUT | `/api/settings` | Atualiza configurações globais. |

### Autorização Resumida

| Rota | Auth | Role |
| --- | --- | --- |
| `GET /api/health` | Pública | - |
| `GET /api/content` | Pública | - |
| `PUT /api/content` | Admin | owner |
| `POST /api/movies` | Admin | manager/owner |
| `PUT /api/movies/:id` | Admin | manager/owner |
| `DELETE /api/users/:id` | Admin | owner |
| `POST /api/payments/pix` | Pública/cliente opcional | - |
| `POST /api/payments/card` | Pública/cliente opcional | - |
| `GET /api/me/tickets` | Cliente | authenticated |
| `POST /api/tickets/manual` | Admin | operator+ |
| `POST /api/tickets/validate` | Admin | operator+ |
| `POST /api/webhooks/mercado-pago` | Provider | assinatura obrigatória em produção |
| `POST /api/webhooks/open-finance` | Provider | validação do provider obrigatória em produção |

### Auth

| Método | Rota | Função |
| --- | --- | --- |
| POST | `/api/auth/register` | Cria conta. |
| POST | `/api/auth/login` | Login por e-mail/senha. |
| GET | `/api/auth/me` | Retorna usuário autenticado pelo cookie. |
| POST | `/api/auth/logout` | Encerra sessão do cliente. |
| POST | `/api/auth/password/request` | Solicita recuperação de senha. |
| POST | `/api/auth/password/reset` | Redefine senha com token temporário. |
| PATCH | `/api/me` | Atualiza dados básicos da conta. |
| GET | `/api/auth/google/start` | Inicia OAuth Google. |
| GET | `/api/auth/google/callback` | Callback OAuth Google. |

### Filmes

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/tmdb/search` | Busca filmes no TMDB. |
| GET | `/api/tmdb/movie/:id` | Importa detalhes do TMDB. |
| POST | `/api/movies` | Cria filme. |
| PUT | `/api/movies/:id` | Atualiza filme. |
| DELETE | `/api/movies/:id` | Remove filme. |

### Salas e ingressos

| Método | Rota | Função |
| --- | --- | --- |
| POST | `/api/rooms` | Cria sala. |
| PUT | `/api/rooms/:id` | Atualiza sala. |
| DELETE | `/api/rooms/:id` | Remove sala. |
| POST | `/api/ticket-types` | Cria tipo de ingresso. |
| PUT | `/api/ticket-types/:id` | Atualiza tipo de ingresso. |
| DELETE | `/api/ticket-types/:id` | Remove tipo de ingresso. |
| GET | `/api/admin/logs` | Lista logs operacionais paginados e filtrados. |
| DELETE | `/api/admin/logs` | Aplica a retenção informada; exclusivo do proprietário. |

### Bomboniere

| Método | Rota | Função |
| --- | --- | --- |
| POST | `/api/concessions` | Cria produto/combos. |
| PUT | `/api/concessions/:id` | Atualiza produto/combos. |
| DELETE | `/api/concessions/:id` | Remove produto/combos. |

### Promoções, anúncios e usuários

| Método | Rota | Função |
| --- | --- | --- |
| POST | `/api/promotions` | Cria promoção. |
| PUT | `/api/promotions/:id` | Atualiza promoção. |
| DELETE | `/api/promotions/:id` | Remove promoção. |
| POST | `/api/ads` | Cria anúncio. |
| PUT | `/api/ads/:id` | Atualiza anúncio. |
| DELETE | `/api/ads/:id` | Remove anúncio. |
| POST | `/api/users` | Cria usuário. |
| PUT | `/api/users/:id` | Atualiza usuário. |
| DELETE | `/api/users/:id` | Remove usuário. |

### Pedidos, pagamentos e tickets

| Método | Rota | Função |
| --- | --- | --- |
| POST | `/api/payments/pix` | Cria pagamento Pix e pedido. |
| POST | `/api/payments/card` | Cria pagamento de cartão com token Mercado Pago. |
| GET | `/api/me/tickets` | Lista tickets da conta autenticada pela sessão. |
| GET | `/api/account/tickets` | Removido; retorna `410`. Use `/api/me/tickets`. |
| POST | `/api/tickets/manual` | Cria venda manual. |
| POST | `/api/tickets/validate` | Valida ingresso. |
| GET | `/api/orders` | Lista pedidos. |
| POST | `/api/orders` | Cria pedido sem provedor de pagamento. |

## 22. Persistência e Banco de Dados

### PostgreSQL

Em produção, o backend exige PostgreSQL via `DATABASE_URL` ou `POSTGRES_URL`. Se `NODE_ENV=production` e nenhuma dessas variáveis existir, a inicialização falha. O fallback `backend/data/db.json` é permitido somente em desenvolvimento e testes.

Arquivos:

```text
backend/db/migrations/001_init.sql
backend/db/seed.sql
backend/db/postgresStore.js
```

Comandos:

```bash
npm run db:migrate
npm run db:seed
npm run db:import-json
```

`db:import-json` importa o conteúdo atual de `backend/data/db.json` para PostgreSQL. O `writeDb` grava em transação quando o store PostgreSQL está ativo, e rotas críticas de pagamento/ticket usam advisory lock transacional para evitar reservas simultâneas inconsistentes.

Tabelas principais:

- `settings`
- `users`
- `rooms`
- `movies`
- `sessions`
- `ticket_types`
- `orders`
- `order_items`
- `payments`
- `tickets`
- `concessions`
- `concession_inventory`
- `promotions`
- `ads`
- `audit_logs`
- `webhook_events`

### Fallback JSON

Quando `DATABASE_URL` não está configurado, o projeto usa o arquivo:

```text
backend/data/db.json
```

Esse fallback preserva desenvolvimento local simples e compatibilidade durante a migração.

Coleções equivalentes:

- `settings`
- `ticketTypes`
- `rooms`
- `movies`
- `orders`
- `tickets`
- `concessions`
- `promotions`
- `ads`
- `users`
- `payments`
- `webhookEvents`
- `auditLogs`

### Próximos reforços

- Storage/CDN para imagens e trailers.
- Redis ou fila para jobs de trailer/webhooks.
- Logs persistentes e observabilidade.
- Repositórios especializados por domínio para reduzir o sync de objeto inteiro.

## 23. Variáveis de Ambiente

O backend lê arquivos:

```text
backend/.env
backend/.env.local
.env
.env.local
```

### Frontend

```env
NEXT_PUBLIC_CINE_API_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

### Backend

```env
PORT=4000
CINE_PUBLIC_BACKEND_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=
POSTGRES_URL=
DATA_STORE=postgres
JWT_SECRET=
ADMIN_JWT_SECRET=
TMDB_BEARER_TOKEN=
TMDB_API_KEY=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
OPEN_FINANCE_PIX_ENDPOINT=
OPEN_FINANCE_PIX_STATUS_ENDPOINT=
OPEN_FINANCE_PIX_TOKEN=
OPEN_FINANCE_WEBHOOK_SECRET=
CRM_WEBHOOK_URL=
LUMIX_WEBHOOK_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
MAX_TRAILER_BYTES=125829120
```

## 24. Imagens e CORS

### CORS

O backend usa allowlist por ambiente:

```env
CORS_ORIGIN=http://localhost:3000,https://seudominio.com.br
```

Quando a origem da requisição está na lista, o backend ecoa essa origem em `Access-Control-Allow-Origin` e permite cookies com `Access-Control-Allow-Credentials: true`. Origem fora da lista não é refletida.

### Headers de segurança

O backend envia:

- `Content-Security-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Strict-Transport-Security` em produção

Configuração:

`next.config.mjs`

Domínios permitidos:

- `images.unsplash.com`
- `image.tmdb.org`
- `br.web.img3.acsta.net`

Essa configuração permite que `next/image` carregue pôsteres e imagens externas sem erro de host não configurado.

## 25. Design e UI

### Identidade visual

Paleta:

- Azul escuro/navy para base.
- Azul royal para interação e tecnologia.
- Amarelo/dourado para CTA, preço e destaque.

### Por que azul escuro

O azul escuro cria atmosfera de cinema, reduz brilho excessivo e valoriza pôsteres. Também passa mais confiança que preto puro.

### Por que amarelo premium

O amarelo funciona como cor de ação:

- Comprar ingresso
- Preço
- Destaque
- Promoção
- Benefícios

Como o fundo é escuro, o amarelo tem alto contraste e ajuda a conversão.

### Tipografia

Fontes:

- Inter para texto e interface.
- Outfit para títulos e chamadas.

Por quê:

- Inter é legível em telas pequenas.
- Outfit dá personalidade visual sem prejudicar leitura.

### Componentização visual

O sistema evita excesso de bordas sólidas e usa:

- Whitespace
- Sombras suaves
- Blocos escuros com contraste sutil
- Ícones SVG
- Botões com estados de hover
- Skeleton loaders
- Modais com fade/scale

### Mobile-first

O projeto foi desenhado para celular porque a compra via WhatsApp/Pix tende a acontecer majoritariamente no mobile.

Decisões mobile:

- Checkout por etapas.
- Cards horizontais na bomboniere.
- Botões grandes e fáceis de tocar.
- Header compacto.
- Cart drawer.
- Modal central com área rolável.
- Texto curto e hierarquia clara.

## 26. Linguagem e Tom

### Linguagem do produto

O texto usa português brasileiro direto, comercial e local.

Exemplos:

- "Comprar Ingresso"
- "Taxa Zero"
- "O cinema do seu bairro"
- "Pipoca artesanal"
- "Feche a sala"
- "Promoção permanente"

### Por que essa linguagem

O Cine Cruzeiro não deve soar como uma startup genérica. A linguagem precisa vender tecnologia sem perder proximidade.

O tom combina:

- Tradição
- Preço justo
- Comodidade
- Cultura local
- Modernização

### Estrutura de linguagem

Cada bloco segue uma lógica:

1. Valor principal claro.
2. Prova ou benefício.
3. Ação objetiva.

Exemplo:

```text
Filme em destaque → sessões → preço → Comprar Ingresso
```

Isso reduz dúvida e acelera decisão.

## 27. Código e Padrões

### TypeScript

Tipos centrais ficam em:

```text
src/types/index.ts
```

Principais tipos:

- `Movie`
- `Session`
- `ConcessionItem`
- `TicketOrder`
- `ClubLead`
- `PrivateEventRequest`

### Serviços de API

Arquivo:

```text
src/services/cinemaApi.ts
```

Responsável por:

- Buscar conteúdo.
- Criar pedido.
- Criar pagamento Pix.
- Registrar conta.
- Fazer login.
- Iniciar login Google.
- Buscar ingressos da conta.
- Validar ingresso.

### Webhooks

Arquivo:

```text
src/services/webhook.ts
```

Responsável por enviar eventos para CRM/webhook externo:

- Pedido criado.
- Clube Cine Cruzeiro.
- Solicitação de evento privado.

Atualmente possui fallback local para desenvolvimento, evitando quebrar a experiência se o webhook externo não responder.

### Backend

Arquivo:

```text
backend/server.js
```

Responsabilidades:

- Servir API.
- Servir painel admin.
- Ler variáveis de ambiente.
- Ler e gravar PostgreSQL ou fallback `db.json` apenas em dev/test.
- Normalizar dados.
- Integrar TMDB.
- Integrar Mercado Pago.
- Integrar Open Finance Pix.
- Integrar Google OAuth.
- Gerar sessão de cliente em cookie `HttpOnly`.
- Gerar tickets.
- Validar tickets.
- Reservar e confirmar estoque/capacidade no fluxo de pedido.
- Controlar cache de trailers.

## 28. Logs, Erros e Health Check

### Erros da API

As rotas devem responder erros no formato:

```json
{
  "error": {
    "code": "SESSION_SOLD_OUT",
    "message": "Esta sessão está esgotada."
  }
}
```

Quando alguma rota antiga envia `error` como texto, o backend normaliza para esse formato antes de responder.

### Logs estruturados

O backend registra eventos operacionais em JSON:

- `payment.created`
- `webhook.processed`
- `webhook.duplicate`
- `ticket.used`
- `manual_sale.created`
- `request.failed`
- `http.request.completed`
- `admin.action`

Com PostgreSQL, esses eventos também são persistidos em `system_logs` com nível, categoria, duração, status HTTP, ator, rota, IP, user agent e metadados sanitizados. Cada resposta da API envia `X-Request-Id`, permitindo correlacionar um erro relatado pelo usuário com o evento correspondente no painel.

Campos sensíveis são redigidos antes do log:

- senha;
- hash;
- token;
- secret;
- cookie;
- authorization;
- dados de cartão;
- Pix copia e cola;
- QR Code.

### Health check

`GET /api/health` informa somente estado operacional público:

```json
{
  "status": "ok"
}
```

O health check não expõe paths internos, tokens ou credenciais.

## 29. Segurança

### Já implementado

- Hash de senha com PBKDF2 SHA-256.
- Salt aleatório por senha.
- Comparação segura com `timingSafeEqual`.
- JWT assinado com HMAC SHA-256.
- Expiração de token.
- Remoção de `passwordHash` em respostas públicas.
- Validação de duplicidade de e-mail.
- Validação de ticket usado com operador vindo da sessão admin, não do navegador.
- Limite de tamanho para trailer via `MAX_TRAILER_BYTES`.
- Proteção básica de path traversal ao servir arquivos estáticos.
- Uso de variáveis de ambiente para tokens sensíveis.
- Login administrativo com cookie `HttpOnly`.
- Login de cliente com cookie `HttpOnly`.
- Google OAuth sem token na URL, com `state` assinado e cookie temporário de validação.
- Recuperação de senha com token aleatório de alta entropia, hash SHA-256 armazenado e expiração de 30 minutos.
- Logout administrativo.
- RBAC server-side para rotas administrativas.
- Auditoria automática de mutações administrativas.
- Proteção contra acesso direto ao `admin.html` sem sessão.
- Proteção CSRF básica por validação de `Origin`, `Referer` e `Sec-Fetch-Site` em mutações administrativas.
- Validação de webhook Mercado Pago por `x-signature`, `x-request-id` e `data.id`; em produção, secret ausente bloqueia processamento.
- Validação genérica de webhook Open Finance por secret compartilhado enquanto o provedor real não define assinatura própria; em produção, validação é obrigatória.
- CORS por allowlist configurável.
- Headers de segurança, incluindo CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.
- Rate limit básico em rotas sensíveis.

### Checklist de segurança coberto

- Autenticação: admin e cliente por sessão assinada.
- RBAC: roles `owner`, `manager` e `operator` validados no backend.
- Cookies: `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Rate limits: rotas sensíveis têm limitação básica.
- CORS: allowlist por `CORS_ORIGIN`.
- HTTPS: aplicação preparada com cookies seguros e HSTS em produção.
- Secrets: chaves ficam no backend e não devem ser expostas no frontend.
- Open Finance: Pix isolado em provider próprio.
- Mercado Pago: cartão isolado em provider próprio.
- Webhooks: validação, idempotência e consulta server-to-server quando configurada.
- Idempotência: pedidos e eventos duplicados não devem duplicar tickets.
- Logs: saída estruturada com campos sensíveis redigidos.
- Auditoria: mutações admin registram usuário, ação e antes/depois sanitizados.
- LGPD: CPF é opcional no checkout e usado apenas para conta/nota fiscal quando necessário.
- Dados de cartão: o backend recebe somente token; número, CVV e validade não são armazenados.
- Recuperação de senha: em produção usa webhook de e-mail configurável e não retorna token público.

### Pontos que precisam ser reforçados antes de produção

1. Homologar webhooks de pagamento com eventos reais de Mercado Pago e do provedor Open Finance escolhido.
2. Usar HTTPS obrigatório.
3. Configurar canal real de entrega para recuperação de senha.
4. Remover logs sensíveis em produção.
5. Adicionar backup automático.
6. Armazenar imagens e trailers em storage próprio.
7. Expandir testes automatizados de permissão, CSRF e auditoria.

### Observação importante

O sistema já está funcional para desenvolvimento e demonstração, mas o painel admin não deve ser exposto publicamente sem autenticação de rota e autorização nos endpoints.

## 30. Regras de Negócio

### Preço

- Os valores pertencem ao catálogo de tipos de ingresso.
- A sessão define quais tipos de ingresso ficam disponíveis, sem copiar ou permitir editar um valor avulso.
- Checkout e bilheteria enviam apenas ID e quantidade; o backend resolve o preço vigente no catálogo e rejeita tipos não atribuídos à sessão.

### Sessões

Cada sessão possui:

- Horário
- Formato
- Sala
- Tipos de ingresso permitidos (`ticketTypeIds`)
- Status

A relação PostgreSQL fica em `session_ticket_types`. A migration inicial vincula os tipos ativos às sessões existentes para preservar a programação anterior.

### Status de sessão

- `available`
- `filling_fast`
- `sold_out`

### Bomboniere

- Produto inativo não aparece no checkout.
- Produto com estoque `0` não aparece.
- Estoque vazio significa ilimitado.
- Produto pode ter limite máximo por pedido.
- `stock` representa disponível para venda.
- `reserved` representa itens presos por pedido pendente.
- `sold` representa itens confirmados em pedido pago ou venda manual.
- Ao iniciar pagamento, o backend reserva estoque.
- Ao pagamento aprovado, a reserva vira vendido.
- Ao pagamento expirado, cancelado ou recusado, a reserva volta para disponível.

### Reservas temporárias

- Pedidos pendentes recebem `reservationExpiresAt`.
- Reservas vencidas são limpas automaticamente no início das chamadas de API.
- Ao expirar, o pedido fica `expired`, o pagamento pendente fica `expired` e o estoque reservado é liberado.
- Tentativas repetidas de checkout usam `idempotencyKey` para evitar pedido duplicado.

### Tickets

- Cada ingresso comprado gera um ticket individual.
- Ticket usado não pode ser validado novamente.
- Venda manual também gera ticket.
- Tickets só são criados quando `payment.status = approved` ou venda manual autenticada é confirmada.

## 31. Integração CRM/Webhook

Arquivo:

```text
src/services/webhook.ts
```

Variável:

```env
CRM_WEBHOOK_URL=
LUMIX_WEBHOOK_URL=
```

Eventos:

- `order.created`
- `club_lead.created`
- `private_rental.inquiry`

O webhook serve para integrar pedidos e leads com CRM, automações de WhatsApp ou operação comercial.

## 32. Layout Administrativo

O painel usa:

- Sidebar lateral.
- Topbar com status de salvamento.
- Cards de métricas.
- Listas selecionáveis.
- Formulários densos.
- Modais de sucesso.
- Feedback via toast.

### Por que não parecer landing page

Admin é ferramenta operacional. Deve ser mais denso, direto e previsível. O objetivo é reduzir tempo de tarefa, não encantar visualmente com hero ou cards decorativos.

### Princípios do admin

- Poucos cliques para editar.
- Informação comercial visível.
- Salvamento com feedback.
- Listas à esquerda, edição à direita.
- Campos claros e agrupados por contexto.

## 33. Layout da Landing

### Estrutura

1. Barra promocional.
2. Header com logo, menu, carrinho, conta e CTA.
3. Hero com filme em destaque.
4. Filmes em cartaz/em breve.
5. Diferenciais.
6. Tradição e cultura.
7. Clube Cine Cruzeiro.
8. Feche a sala.
9. Footer.

### Hierarquia de conversão

O CTA principal é comprar ingresso. Elementos secundários, como clube e aluguel de sala, aparecem depois que o usuário entende a oferta principal.

## 34. Acessibilidade e Usabilidade

Boas práticas presentes:

- Botões com estados visuais.
- `aria-label` em ações importantes.
- Contraste alto entre texto e fundo.
- Skeleton loaders.
- Mensagens de erro amigáveis.
- Fluxo em etapas.
- Inputs com placeholders claros.
- QR Code com alternativa manual.
- Área rolável em modais para mobile.

Melhorias futuras:

- Foco visível mais consistente em todos os botões.
- Navegação completa por teclado no admin.
- Testes com leitor de tela.
- Labels explícitos em todos os inputs do frontend.

## 35. Operação Diária Sugerida

### Programação de filme

1. Entrar no admin.
2. Ir em Filmes.
3. Buscar pelo TMDB.
4. Importar dados.
5. Revisar pôster, sinopse e classificação.
6. Definir status:
   - `Em cartaz`
   - `Em breve`
   - `Oculto`
7. Definir data de estreia se for em breve.
8. Criar sessões.
9. Salvar.

### Vender manualmente

1. Ir em Pedidos/Ingressos.
2. Selecionar filme e sessão.
3. Informar dados do cliente.
4. Criar venda manual.
5. Entregar código/QR Code ao cliente.

### Validar entrada

1. Ir no leitor de QR Code.
2. Abrir câmera.
3. Ler QR Code.
4. Se câmera falhar, digitar código manualmente.
5. Sistema marca como usado.

### Gerenciar bomboniere

1. Ir em Bomboniere.
2. Criar produto ou combo.
3. Adicionar imagem.
4. Definir preço e preço comparativo.
5. Definir estoque e limite por pedido.
6. Marcar destaque se necessário.
7. Salvar.

## 36. Checklist de Produção

Antes de publicar:

- Configurar `.env` real.
- Configurar domínio e HTTPS.
- Configurar `DATABASE_URL`/`POSTGRES_URL`; produção não inicia com `db.json`.
- Configurar Mercado Pago produção, incluindo `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, access token e webhook secret.
- Homologar cartão Mercado Pago com aprovado, recusado e pendente.
- Escolher, integrar e homologar provider real de Pix/Open Finance.
- Configurar webhook de confirmação de pagamento com assinatura/validação obrigatória.
- Validar Google OAuth com domínio final.
- Criar backup de dados.
- Configurar storage para imagens/trailers.
- Configurar canal real de recuperação de senha por e-mail.
- Testar checkout em Android e iPhone.
- Testar Pix real de ponta a ponta.
- Rodar `TEST_DATABASE_URL=... npm test` para validar concorrência PostgreSQL.
- Testar QR Code em câmera de celular.
- Testar falha de backend no frontend.
- Testar filme sem trailer.
- Testar produto sem imagem.
- Testar estoque zerado.

## 37. Comandos Úteis

### Verificar sintaxe do backend

```bash
node --check backend/server.js
```

### Verificar sintaxe do admin

```bash
node --check backend/public/admin.js
```

### Build do frontend

```bash
npm run build
```

### Smoke tests locais

```bash
npm test
```

Esse comando roda primeiro o smoke local com JSON. Ele sobe o backend em porta isolada, força `DATA_STORE=json` e `PAYMENTS_MODE=test`, faz backup/restauração do `backend/data/db.json` e cobre:

- cadastro e sessão;
- login com senha incorreta;
- recuperação de senha;
- Pix pendente;
- idempotência de checkout;
- reserva de estoque;
- webhook aprovado;
- geração de ticket;
- validação e dupla validação de QR Code.

Depois ele chama `scripts/postgres-concurrency-tests.js`. Se `TEST_DATABASE_URL` estiver configurada, o script roda migrations e testa concorrência real em PostgreSQL:

- último ingresso simultâneo;
- último produto simultâneo;
- webhook duplicado;
- finalização concorrente sem duplicar ticket ou baixa de estoque.

Sem `TEST_DATABASE_URL`, essa parte é pulada com aviso explícito.

```bash
TEST_DATABASE_URL=postgres://... npm test
```

### Parar portas locais

```bash
npm run dev:stop
```

## 38. Melhorias Futuras Recomendadas

### Curto prazo

- Homologação Mercado Pago em produção.
- Escolha e homologação do provider Open Finance Pix.
- Testes PostgreSQL concorrentes em banco de teste real.
- HTTPS e domínio final.
- Backups de PostgreSQL.
- Canal de e-mail para recuperação de senha.
- Tela detalhada de pedido.
- Upload de imagens no admin.
- Página dedicada de carrinho.
- Página dedicada de bomboniere.
- Página dedicada de promoções.
- Relatório de vendas por período.

### Médio prazo

- Dashboard financeiro.
- Controle de assentos, se necessário.
- Cupom com regras reais.
- Clube Cine Cruzeiro com cobrança recorrente real.
- Envio automático por WhatsApp.
- E-mail de comprovante.
- Storage definitivo para imagens/trailers.

### Longo prazo

- Aplicativo PWA.
- Totem de autoatendimento.
- Integração fiscal.
- Integração com catraca/leitor físico.
- Segmentação de clientes.
- Programa de fidelidade.

## 39. Resumo Executivo

O Cine Cruzeiro agora é mais que uma landing page. Ele funciona como uma base de sistema comercial para cinema de bairro:

- Landing de alta conversão.
- Catálogo dinâmico.
- Checkout mobile-first.
- Infraestrutura Pix/Open Finance preparada; integração real depende da escolha e homologação do provider.
- Cartão Mercado Pago com tokenização frontend e provider backend implementados; requer credenciais reais e homologação antes de produção.
- Bomboniere customizável.
- Painel administrativo.
- Login e conta do cliente.
- Ingresso digital com QR Code.
- Venda manual.
- Validação de entrada.
- Integrações com TMDB, Mercado Pago, Open Finance, Google OAuth e webhooks.

A arquitetura atual favorece velocidade e clareza. Para produção pública, os próximos passos são concluir pagamentos reais, homologar webhooks, validar concorrência PostgreSQL com banco de teste real e configurar infraestrutura de produção com HTTPS, backups e secrets.
