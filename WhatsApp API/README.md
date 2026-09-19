# 🚀 LumixEngine WhatsApp Automation System

Sistema completo e profissional de automação de atendimento via WhatsApp multiempresa integrado à plataforma SaaS **LumixEngine**, focado inicialmente no segmento de cinemas (filmes, sessões, ingressos, bomboniere e atendimento humano com takeover no painel).

A **Evolution API** funciona exclusivamente como gateway de mensageria WhatsApp (Baileys), enquanto todas as regras de negócio, dados de cinema, persistência e estados residem na **LumixEngine**.

---

## 🏗️ Arquitetura do Sistema

```
WhatsApp (Usuário)
       │
       ▼
Evolution API (Baileys)
       │
       ▼ Webhook HTTP POST (instantâneo < 50ms)
LumixEngine API (Fastify) ──► Validação Zod, Tenant Guard, Deduplicação (processed_events)
       │
       ▼ Job com BullMQ
Redis ──────────────────────► Distributed Locking por conversa (lock:conversation:{companyId}:{phone})
       │                      Debounce / Agrupamento de mensagens
       ▼
Worker Process
       │
       ▼
Flow Engine (LumixEngine) ──► MovieService / SessionService / SnackBarService / OrderService
       │
       ▼
PostgreSQL LumixEngine & WhatsAppService
       │
       ▼ WhatsAppProvider (Evolution / Mock / Twilio / Meta Cloud)
Evolution API
       │
       ▼
WhatsApp (Usuário)
```

---

## 📦 Stack Tecnológica

- **Backend**: Node.js (v24), TypeScript, Fastify, Prisma ORM, PostgreSQL, Redis, BullMQ, Zod, Pino.
- **WhatsApp Gateway**: Evolution API v2 (Baileys) isolado em rede interna Docker.
- **Frontend Administrativo**: React, TypeScript, Vite, Design System moderno com Dark Mode e Glassmorphism.
- **Infraestrutura**: Docker Compose, PostgreSQL isolado para a Evolution API, Redis e Nginx Reverse Proxy.

---

## 📋 Pré-requisitos

- **Node.js**: v20+ ou v24+
- **Docker & Docker Compose**: instalados e em execução
- **NPM**: v10+ ou v12+

---

## ⚙️ Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Principais variáveis:
- `DATABASE_URL`: String de conexão do PostgreSQL da LumixEngine (`postgresql://lumix:lumix_secure_password@localhost:5432/lumix_whatsapp?schema=public`)
- `EVOLUTION_DATABASE_URL`: String de conexão do PostgreSQL isolado da Evolution API
- `REDIS_HOST` e `REDIS_PORT`: Conexão Redis para BullMQ e distributed locks
- `EVOLUTION_API_URL`: URL da Evolution API (`http://localhost:8080`)
- `EVOLUTION_API_KEY`: Chave global de autenticação da Evolution API
- `CHECKOUT_BASE_URL`: URL base para finalização segura de pedidos (`https://cine.lumixengine.com/checkout`)

---

## 🐳 Inicialização da Infraestrutura Docker

Suba os containers da infraestrutura (PostgreSQL Lumix, PostgreSQL Evolution isolado, Redis e Evolution API):

```bash
docker compose up -d
```

Verifique se todos os containers estão saudáveis:

```bash
docker compose ps
```

---

## 💾 Banco de Dados, Migrações e Seed

Entre na pasta do backend e execute as migrações do Prisma e o seed de dados do cinema:

```bash
cd backend

# Gerar Prisma Client
npm run prisma:generate

# Executar migrações no PostgreSQL
npm run prisma:migrate

# Executar o seed apenas em desenvolvimento (cria dados de demonstração)
npm run prisma:seed
```

---

## 🚀 Execução da Aplicação

### 1. Backend API (Fastify)
```bash
cd backend
npm run dev
# Servidor disponível em http://localhost:3333
```

### 2. Workers BullMQ (Processamento Assíncrono de Mensagens)
```bash
cd backend
npm run worker
```

### 3. Frontend Administrativo (Painel LumixEngine)
```bash
cd frontend
npm run dev
# Painel local disponível em http://localhost:5173
```

---

## 🧪 Testes Automatizados

O sistema conta com suíte completa de testes unitários e de integração (21 testes) cobrindo:
- Abstração de provedores (`WhatsAppProvider`, `MockWhatsAppProvider`)
- Isolamento multi-tenant (`tenantMiddleware`, `company_id`)
- Idempotência de webhooks (descarte de duplicados via constraint única)
- Flow Engine e fluxos reais de cinema (Menu, Programação, Ingressos, Bomboniere, Atendente)
- Silenciamento absoluto do bot quando em modo `HUMAN`
- Inbox com envio manual do atendente, takeover, release e close

Para rodar os testes:
```bash
cd backend
npm test
```

---

## 🎬 Fluxos de Atendimento do Cinema

1. **Recepção (MAIN_MENU)**:
   - Cliente manda *"Oi"*, *"Olá"* ou inicia conversa.
   - Bot responde com saudação personalizada com o nome da empresa e opções interativas:
     - 🎬 Programação
     - 🎟️ Ingressos
     - 🍿 Bomboniere
     - 👨‍💼 Falar com atendente
2. **Programação (PROGRAMMING)**:
   - Pergunta se deseja consultar *Hoje* ou *Amanhã*.
   - Consulta sessões reais cadastradas no `SessionService` da LumixEngine e exibe horários, formato (2D/3D), áudio (Dub/Leg), sala e preço.
3. **Compra de Ingressos (BUY_TICKET)**:
   - Seleção de filme em cartaz -> data e sessão -> quantidade de ingressos.
   - Gera token criptográfico temporário não previsível e entrega link seguro para escolha de assentos e pagamento web.
4. **Bomboniere (SNACK_BAR)**:
   - Categorias: Super Combos, Pipocas, Bebidas, Doces e Balas.
   - Consulta produtos reais cadastrados no `SnackBarService` com descrições e valores.
5. **Atendimento Humano & Takeover (SUPPORT)**:
   - Transfere a conversa para `mode: HUMAN`.
   - O bot para de responder imediatamente.
   - Notifica a equipe de atendentes no painel Inbox em tempo real via Server-Sent Events (SSE).
   - O atendente pode assumir a conversa, responder manualmente pelo painel e, ao finalizar, devolver para o bot ou encerrar o chamado.

---

## 🔒 Segurança e Boas Práticas

- **Evolution API Isolada**: A Evolution API não fica exposta publicamente na internet; ela opera em rede Docker interna e somente a LumixEngine API se comunica com ela.
- **Multi-tenant Estrito**: Todas as consultas e operações filtram rigidamente por `companyId`, prevenindo vulnerabilidades de IDOR e vazamento entre cinemas concorrentes.
- **Redaction de Logs**: O logger estruturado Pino censura automaticamente senhas, tokens JWT, headers de autenticação e credenciais Baileys.
- **Locking Distribuído**: Chaves no Redis (`lock:conversation:{companyId}:{phone}`) garantem que mensagens enviadas em rajada sejam processadas de forma sequencial sem inconsistências de estado.
- **Idempotência de Webhook**: Tabela `processed_events` com índice único `[companyId, provider, eventId]` impede que mensagens de webhook retransmitidas gerem respostas duplicadas ao cliente.
