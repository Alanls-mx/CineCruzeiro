# Operacao e observabilidade - Cine Cruzeiro

## Health

- `/api/health/live`: confirma que o processo Node responde.
- `/api/health/ready`: confirma PostgreSQL acessivel e migration mais recente aplicada.
- `/api/health`: alias publico de readiness, sem secrets.

TMDB, SMTP, Google Wallet, Mercado Pago e Focus NFe nao derrubam readiness, pois sao dependencias externas recuperaveis.

## Monitoramento simples

Execute `scripts/production-health-check.sh` a cada cinco minutos. Configure `ALERT_WEBHOOK_URL` apenas no ambiente da VPS quando desejar entrega de alertas. O script verifica health publico, pagina de filmes, PM2, reinicios instaveis e disco acima de 85%.

Alertas recomendados no agregador de logs:

| Evento | Alerta |
| --- | --- |
| HTTP 5xx | 5 em 5 minutos |
| `webhook.mercado_pago.rejected` | qualquer ocorrencia repetida |
| `email.*failed` | 3 em 15 minutos |
| `fiscal.maintenance_failed` | 2 consecutivos |
| `subscription.pending_payment_maintenance_failed` | qualquer ocorrencia |
| PM2 reiniciando | mais de 3 reinicios instaveis |
| Disco | 85% aviso, 92% critico |

## Incidente

1. Coloque vendas em manutencao apenas se houver risco de inconsistência financeira.
2. Registre horario, request ID, pedido, pagamento e provedor sem copiar tokens/secrets.
3. Verifique readiness, PM2, PostgreSQL e espaco em disco.
4. Para pagamento aprovado sem ticket, reconcilie pelo identificador do provedor; nao crie pedido manual duplicado.
5. Para indisponibilidade externa, preserve o estado local e aguarde retry/reconciliacao.
6. Depois da correcao, valide um fluxo isolado e documente causa e impacto.

## PM2 e WebSocket

O backend opera em uma unica instancia PM2. A reserva atomica mora no PostgreSQL, mas o broadcast WebSocket atual mora na memoria do processo. Nao ative cluster ou multiplas instancias sem broadcast compartilhado via PostgreSQL `LISTEN/NOTIFY`, Redis Pub/Sub ou broker equivalente.

## Jobs externos

E-mail e fiscal nao podem desfazer pagamento ou ticket. Falhas ficam registradas para reenvio/reconciliacao. A evolucao recomendada, antes de escalar horizontalmente, e uma outbox PostgreSQL incremental com `status`, `attempt_count`, `next_attempt_at` e erro sanitizado.

Consulte [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) para backup e restauracao e [DEPLOY_VPS.md](./DEPLOY_VPS.md) para release e rollback.
