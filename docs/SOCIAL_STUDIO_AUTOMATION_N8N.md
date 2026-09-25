# Social Studio e n8n

## Arquitetura encontrada

O Social Studio V2 já era um motor criativo independente, com normalização de conteúdo, copy determinística, composições por domínio, análise de assets, score visual, editor de cena, prévia, animação Remotion e exportação. O backend Node concentra as APIs administrativas e persiste o histórico do Studio. Em produção, a fonte de verdade é PostgreSQL.

O n8n não existia na arquitetura ativa. As gerações completas ainda eram executadas dentro da requisição administrativa e o histórico registrava artes concluídas, mas não o ciclo de uma automação, seus estágios, eventos, retries ou chave idempotente.

## Arquitetura final desta fase

```text
Sistema do cinema ou webhook
  -> n8n (gatilho e preparação)
  -> API protegida do Studio
  -> fila assíncrona do backend
  -> contexto e assets reais
  -> repertório com memória
  -> 3 direções de composição
  -> QA e retry orientado pelo motivo
  -> campanha pronta no Studio
  -> revisão humana
  -> editor e exportação existentes
```

O Studio continua funcionando sem o n8n. Prévia, geração manual, editor, animação, histórico e exportação não chamam o n8n.

## Responsabilidades

### Social Studio

- normalização dos dados reais;
- copy e coerência semântica;
- seleção de composição;
- coordenadas, tipografia, cor, recortes e safe areas;
- renderização e exportação;
- score visual e QA de cena;
- edição e aprovação humana.

### n8n

- recebe eventos e solicitações externas;
- consulta contexto autorizado;
- normaliza o gatilho e cria a chave idempotente;
- solicita a geração assíncrona;
- poderá coordenar publicação futura somente após aprovação.

## Endpoints

### Integração n8n

Todos exigem `Authorization: Bearer <STUDIO_AUTOMATION_TOKEN>`.

- `GET /api/studio/context`: contexto operacional necessário para preparar a campanha.
- `POST /api/studio/campaigns/generate`: cria ou recupera uma campanha idempotente e retorna `202` para uma nova execução.
- `GET /api/studio/campaigns/:id`: consulta estágio, progresso, eventos, avisos, QA e composições.

### Painel administrativo

- `GET /api/admin/social-studio/automation/campaigns`
- `POST /api/admin/social-studio/automation/campaigns`
- `GET /api/admin/social-studio/automation/campaigns/:id`
- `POST /api/admin/social-studio/automation/campaigns/:id/reprocess`

As rotas administrativas preservam RBAC, 2FA, proteção de origem e auditoria existentes.

## Persistência

A migration `038_social_studio_automation.sql` cria:

- `social_studio_automation_campaigns`: contrato, origem, estado, progresso, formatos, resultado, QA, avisos, tentativas e erro;
- `social_studio_automation_events`: trilha cronológica por etapa, sem tokens ou segredos.

Estados válidos: `queued`, `processing`, `qa`, `ready` e `failed`.

Uma chave única de idempotência considera cinema, tipo, objetivo, formatos, assunto, versão e data do evento. Eventos repetidos retornam a campanha existente.

## QA e retry

O QA reutiliza o score e as validações do motor visual. Findings são convertidos em:

- `ERROR`: bloqueia a composição;
- `WARNING`: permite revisão humana;
- `SUGGESTION`: registra oportunidade de refinamento.

O retry é limitado a três tentativas internas. A tentativa seguinte recebe uma nova semente e outra direção de hierarquia; o histórico registra o motivo e a ação corretiva. Não há loop infinito.

## Workflows

Arquivos importáveis em `automation/n8n/workflows`:

- `studio-campaign-create.json`: webhook genérico, consulta de contexto, preparação e geração;
- `schedule-changed.json`: evento idempotente de programação alterada.

Os workflows chegam inativos. Nenhuma publicação automática é habilitada por padrão.

## Variáveis

Backend:

```env
STUDIO_AUTOMATION_TOKEN=<segredo longo e exclusivo>
```

n8n:

```env
STUDIO_BASE_URL=https://dominio/base-path
STUDIO_AUTOMATION_TOKEN=<mesmo segredo do backend>
N8N_HOST=automation.dominio
N8N_PROTOCOL=https
N8N_ENCRYPTION_KEY=<segredo>
N8N_USER_MANAGEMENT_JWT_SECRET=<outro segredo>
N8N_BASIC_AUTH_USER=<usuario>
N8N_BASIC_AUTH_PASSWORD=<senha forte>
```

## Segurança e operação

- tokens nunca são enviados ao frontend;
- o endpoint externo usa comparação constante do bearer token;
- o n8n escuta somente em `127.0.0.1:5678` no compose fornecido;
- workflows não armazenam credenciais em texto;
- os logs não registram payloads de autenticação;
- campanhas continuam exigindo revisão humana.

## Funcionalidades preservadas

- geração manual e prévia imediata;
- editor em tempo real;
- variações e famílias específicas por campanha;
- Feed, quadrado e Story;
- animações e exportação;
- histórico de artes;
- assets, identidade e dados vindos da instalação atual.

## Limitações desta fase

- publicação em Instagram, Facebook ou WhatsApp não foi ativada porque não há credenciais e aprovação de canal neste escopo;
- a fila usa o processo do backend, com retomada de jobs pendentes após reinício; um worker distribuído pode ser adicionado quando o volume justificar;
- não foi adicionada uma chamada externa de IA: o repertório atual permanece determinístico e evita inventar fatos. Um provider futuro deve ser opcional, auditável e ter fallback local.
- os workflows são instalados inativos e a ativação permanece uma ação administrativa explícita;
- enquanto não houver um domínio administrativo aprovado, o editor do n8n fica privado em `127.0.0.1:5678` e pode ser acessado por túnel SSH.
