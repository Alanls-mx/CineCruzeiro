# n8n para o Cine Cruzeiro

Esta pasta contém a camada opcional de automação do Social Studio e das campanhas de e-mail. Os módulos continuam funcionando manualmente quando o n8n estiver indisponível.

## Instalação segura

1. Copie `.env.example` para `.env` fora do Git e preencha os segredos.
2. Configure o mesmo `STUDIO_AUTOMATION_TOKEN` no backend do cinema.
3. Configure `EMAIL_AUTOMATION_TOKEN` no n8n e no backend. Use um segredo diferente do Studio.
4. Inicie com `bash deploy-private.sh`. O script valida a configuração, preserva um backup dos workflows, atualiza o container e importa os workflows inativos.
5. Publique o n8n atrás do proxy HTTPS existente somente depois de validar portas e domínios.
6. Importe os JSONs de `workflows/` e configure os webhooks de origem.
7. Mantenha os workflows inativos até o teste manual e a aprovação administrativa.

O serviço escuta apenas em `127.0.0.1:5678`. Credenciais ficam no volume do n8n e em variáveis de ambiente; nenhum token deve ser enviado ao navegador ou salvo nos workflows.

A imagem está fixada em `2.40.6`, versão estável validada para este provisionamento. O JavaScript dos workflows roda em um task runner externo com a mesma versão, isolado do processo principal. Atualizações futuras devem passar pelo mesmo backup e teste dos workflows antes da troca da tag.

Sem um domínio administrativo aprovado, acesse o editor somente por túnel SSH:

```bash
ssh -L 5678:127.0.0.1:5678 usuario@servidor
```

Depois abra `http://127.0.0.1:5678`. Esse modo não exige alteração de Nginx, DNS, SSL ou firewall.

## Workflows

- `studio-campaign-create.json`: recebe uma solicitação, consulta o contexto real e cria um job idempotente no Studio.
- `schedule-changed.json`: transforma uma alteração de programação em campanha, sem ativar publicação automática.
- `email-weekly-programming.json`: toda segunda-feira prepara a programação semanal com filmes e sessões reais.
- `email-relationship-daily.json`: diariamente avalia aniversariantes e clientes em reativação.
- `email-movie-event.json`: avalia estreias diariamente e também aceita evento de publicação de um filme.

As automações de e-mail são idempotentes e respeitam descadastro e elegibilidade. `EMAIL_AUTOMATION_MODE=draft` é o padrão do backend e cria rascunhos para revisão. O envio automático só ocorre quando o backend usa `EMAIL_AUTOMATION_MODE=send` e o canal de e-mail está configurado e ativo.

Os endpoints retornam `queued`, `processing`, `qa`, `ready` ou `failed`. A revisão e a exportação continuam no Studio.
