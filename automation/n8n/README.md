# n8n para o Social Studio

Esta pasta contém a camada opcional de automação. O Social Studio continua gerando, editando e exportando campanhas sem o n8n.

## Instalação segura

1. Copie `.env.example` para `.env` fora do Git e preencha os segredos.
2. Configure o mesmo `STUDIO_AUTOMATION_TOKEN` no backend do cinema.
3. Inicie com `bash deploy-private.sh`. O script valida a configuração, preserva um backup dos workflows, atualiza o container e importa os workflows inativos.
4. Publique o n8n atrás do proxy HTTPS existente somente depois de validar portas e domínios.
5. Importe os JSONs de `workflows/` e configure os webhooks de origem.
6. Mantenha os workflows inativos até o teste manual e a aprovação administrativa.

O serviço escuta apenas em `127.0.0.1:5678`. Credenciais ficam no volume do n8n e em variáveis de ambiente; nenhum token deve ser enviado ao navegador ou salvo nos workflows.

A imagem está fixada em `2.40.6`, versão estável validada para este provisionamento. Atualizações futuras devem passar pelo mesmo backup e teste dos workflows antes da troca da tag.

Sem um domínio administrativo aprovado, acesse o editor somente por túnel SSH:

```bash
ssh -L 5678:127.0.0.1:5678 usuario@servidor
```

Depois abra `http://127.0.0.1:5678`. Esse modo não exige alteração de Nginx, DNS, SSL ou firewall.

## Workflows

- `studio-campaign-create.json`: recebe uma solicitação, consulta o contexto real e cria um job idempotente no Studio.
- `schedule-changed.json`: transforma uma alteração de programação em campanha, sem ativar publicação automática.

Os endpoints retornam `queued`, `processing`, `qa`, `ready` ou `failed`. A revisão e a exportação continuam no Studio.
