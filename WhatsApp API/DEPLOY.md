# Central WhatsApp do Cine Cruzeiro

Este serviço é o complemento privado de atendimento do Cine Cruzeiro. Ele usa
Evolution API somente como gateway de mensagens; regras de negócio, conversas,
fila e atendimento humano permanecem na LumixEngine.

## Arquitetura de produção

- Painel: `https://lumixengine.com/projects/cinecruzeiro/admin/whatsapp/`
- Autenticação: sessão e permissões do painel administrativo do Cine Cruzeiro.
- API auxiliar: `127.0.0.1:3335`, nunca exposta diretamente à internet.
- Webhook Evolution: `https://lumixengine.com/projects/cinecruzeiro/whatsapp/webhook`
- Fonte de filmes, sessões e bomboniere: catálogo comercial protegido do Cine Cruzeiro.
- Checkout: o bot encaminha para a sessão no checkout principal; ele não cria
  reservas, pedidos ou pagamentos paralelos.

## Serviços

```bash
systemctl status lumixengine-whatsapp-api.service lumixengine-whatsapp-worker.service --no-pager
journalctl -u lumixengine-whatsapp-api.service -f
journalctl -u lumixengine-whatsapp-worker.service -f
```

## Variáveis de produção

O arquivo `/opt/lumixengine-whatsapp/backend/.env` é local da VPS e não entra
no Git. Configure valores únicos para `INTERNAL_API_TOKEN`,
`EVOLUTION_WEBHOOK_SECRET`, `JWT_SECRET`, `EVOLUTION_API_KEY` e
`COMMERCIAL_CATALOG_TOKEN`. O token do catálogo é obtido em **Admin >
Integrações** e deve ser rotacionado se for compartilhado indevidamente.

## Publicação

1. Compile o backend com `npm run build` e o frontend com `npm run build`.
2. Copie o build do frontend para `backend/public/whatsapp` no projeto principal.
3. Publique o Cine Cruzeiro pelo deploy coordenado normal.
4. Atualize o serviço auxiliar, gere o Prisma Client e reinicie API e worker.
5. Valide `/health`, o acesso autenticado do painel e o webhook assinado.

Não execute `prisma:seed` em produção. O seed foi mantido apenas para ambiente
de desenvolvimento e não representa a operação real do Cine Cruzeiro.
