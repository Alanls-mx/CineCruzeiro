const { Client } = require("pg");

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Configure DATABASE_URL ou POSTGRES_URL para executar a auditoria.");
  process.exit(1);
}

const checks = [
  {
    entity: "tickets",
    rule: "Nenhuma poltrona pode possuir duas ocupacoes definitivas na mesma sessao.",
    severity: "CRITICO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM (
      SELECT session_id, metadata->>'seatId' AS seat_id
      FROM tickets
      WHERE session_id IS NOT NULL
        AND COALESCE(metadata->>'seatId', '') <> ''
        AND status NOT IN ('cancelled', 'refunded', 'expired')
      GROUP BY session_id, metadata->>'seatId' HAVING COUNT(*) > 1
    ) duplicates`
  },
  {
    entity: "tickets",
    rule: "Codigo e payload QR nao podem representar ingressos distintos.",
    severity: "CRITICO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM (
      SELECT qr_payload FROM tickets
      WHERE qr_payload IS NOT NULL AND btrim(qr_payload) <> ''
      GROUP BY qr_payload HAVING COUNT(*) > 1
    ) duplicates`
  },
  {
    entity: "payments",
    rule: "Pagamento do provedor deve ser unico dentro do provider.",
    severity: "CRITICO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM (
      SELECT provider, provider_payment_id FROM payments
      WHERE provider_payment_id IS NOT NULL AND btrim(provider_payment_id) <> ''
      GROUP BY provider, provider_payment_id HAVING COUNT(*) > 1
    ) duplicates`
  },
  {
    entity: "webhook_events",
    rule: "Evento do provedor deve ser processado de forma idempotente.",
    severity: "CRITICO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM (
      SELECT provider, event_id FROM webhook_events
      GROUP BY provider, event_id HAVING COUNT(*) > 1
    ) duplicates`
  },
  {
    entity: "subscription_credit_redemptions",
    rule: "Uma unidade de credito pode ter no maximo um resgate efetivo.",
    severity: "CRITICO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM (
      SELECT subscription_credit_id FROM subscription_credit_redemptions
      WHERE status IN ('reserved', 'redeemed')
      GROUP BY subscription_credit_id HAVING COUNT(*) > 1
    ) duplicates`
  },
  {
    entity: "goods_fiscal_documents",
    rule: "Um pedido pode ter no maximo um documento fiscal efetivo de mercadorias.",
    severity: "CRITICO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM (
      SELECT order_id FROM goods_fiscal_documents
      WHERE status <> 'cancelled'
      GROUP BY order_id HAVING COUNT(*) > 1
    ) duplicates`
  },
  {
    entity: "payments",
    rule: "Pagamento aprovado deve apontar para pedido pago, salvo assinatura sem pedido.",
    severity: "ALTO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count
      FROM payments payment
      LEFT JOIN orders order_record ON order_record.id = payment.order_id
      WHERE payment.status = 'approved'
        AND COALESCE(payment.metadata->>'kind', '') <> 'club_subscription'
        AND (order_record.id IS NULL OR order_record.status <> 'paid')`
  },
  {
    entity: "tickets",
    rule: "Ingresso deve apontar para um pedido existente.",
    severity: "ALTO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM tickets ticket
      LEFT JOIN orders order_record ON order_record.id = ticket.order_id
      WHERE order_record.id IS NULL`
  },
  {
    entity: "orders",
    rule: "Pedido historico sem sessao ativa deve preservar snapshot suficiente.",
    severity: "ALTO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM orders
      WHERE session_id IS NULL
        AND COALESCE(metadata->>'archivedSessionId', '') = ''
        AND NOT (
          COALESCE(metadata->>'sessionDate', '') <> ''
          AND COALESCE(metadata->>'sessionTime', '') <> ''
          AND COALESCE(metadata->>'movieTitle', '') <> ''
        )`
  },
  {
    entity: "tickets",
    rule: "Estado used e seus timestamps devem ser coerentes.",
    severity: "ALTO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM tickets
      WHERE (status = 'used' AND used_at IS NULL)
         OR (status <> 'used' AND used_at IS NOT NULL)`
  },
  {
    entity: "orders/tickets",
    rule: "Pedido pago deve possuir a quantidade de ingressos materializada nos itens.",
    severity: "ALTO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM orders order_record
      WHERE order_record.status='paid'
        AND (SELECT COALESCE(SUM(
          CASE
            WHEN item.metadata->>'ticketQuantity' ~ '^[0-9]+$'
              THEN (item.metadata->>'ticketQuantity')::int
            WHEN item.metadata->>'bundleQuantity' ~ '^[0-9]+$'
              THEN item.quantity * (item.metadata->>'bundleQuantity')::int
            ELSE item.quantity
          END
        ), 0) FROM order_items item
          WHERE item.order_id=order_record.id AND item.item_type='ticket')
          <> (SELECT COUNT(*) FROM tickets ticket WHERE ticket.order_id=order_record.id)`
  },
  {
    entity: "subscription_credit_units",
    rule: "Contadores da assinatura devem refletir unidades detalhadas.",
    severity: "MEDIO",
    classification: "LEGADO COMPATIVEL",
    sql: `SELECT COUNT(*)::int AS count FROM (
      SELECT subscription.id
      FROM subscriptions subscription
      LEFT JOIN subscription_credit_units unit ON unit.subscription_id=subscription.id
      GROUP BY subscription.id, subscription.credits_available, subscription.credits_used
      HAVING subscription.credits_available <> COUNT(*) FILTER (WHERE unit.status='available')
          OR subscription.credits_used <> COUNT(*) FILTER (WHERE unit.status='redeemed')
    ) mismatches`
  },
  {
    entity: "subscription_cycles",
    rule: "Ciclos ativos da mesma assinatura nao devem se sobrepor.",
    severity: "ALTO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM subscription_cycles first_cycle
      JOIN subscription_cycles second_cycle
        ON first_cycle.subscription_id=second_cycle.subscription_id
       AND first_cycle.id < second_cycle.id
       AND first_cycle.status='active' AND second_cycle.status='active'
       AND tstzrange(first_cycle.cycle_start, first_cycle.cycle_end, '[)')
           && tstzrange(second_cycle.cycle_start, second_cycle.cycle_end, '[)')`
  },
  {
    entity: "seat_holds",
    rule: "Holds vencidos podem ser removidos pelo ciclo normal de manutencao.",
    severity: "BAIXO",
    classification: "HISTORICO / ARQUIVADO",
    sql: "SELECT COUNT(*)::int AS count FROM seat_holds WHERE expires_at <= now()"
  },
  {
    entity: "goods_fiscal_documents",
    rule: "Documento nao emitido nao deve aguardar gatilho de pedido terminal.",
    severity: "MEDIO",
    classification: "INCONSISTENCIA REAL",
    sql: `SELECT COUNT(*)::int AS count FROM goods_fiscal_documents document
      JOIN orders order_record ON order_record.id=document.order_id
      WHERE document.status='waiting_trigger'
        AND order_record.status IN ('cancelled', 'expired', 'refunded')`
  },
  {
    entity: "webhook_events",
    rule: "Eventos preservados podem referenciar recursos ausentes sem gerar efeitos.",
    severity: "INFORMATIVO",
    classification: "AMBIGUO - NAO ALTERAR",
    sql: `SELECT COUNT(*)::int AS count FROM webhook_events event
      LEFT JOIN orders order_record ON order_record.id=event.order_id
      WHERE NULLIF(event.order_id, '') IS NOT NULL AND order_record.id IS NULL`
  }
];

async function main() {
  const client = new Client({ connectionString, application_name: "cinecruzeiro-integrity-audit" });
  await client.connect();
  let critical = 0;
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const database = await client.query("SELECT current_database() AS name, current_setting('server_version') AS version");
    const rows = [];
    for (const check of checks) {
      const result = await client.query(check.sql);
      const count = Number(result.rows[0]?.count || 0);
      if (check.severity === "CRITICO") critical += count;
      rows.push({
        entidade: check.entity,
        severidade: check.severity,
        classificacao: count ? check.classification : "VALIDO",
        quantidade: count,
        regra: check.rule
      });
    }
    const constraints = await client.query(`SELECT COUNT(*)::int AS count
      FROM pg_constraint constraint_record
      JOIN pg_class table_record ON table_record.oid=constraint_record.conrelid
      WHERE table_record.relnamespace='public'::regnamespace
        AND NOT constraint_record.convalidated`);
    rows.push({
      entidade: "constraints",
      severidade: "ALTO",
      classificacao: Number(constraints.rows[0].count) ? "INCONSISTENCIA REAL" : "VALIDO",
      quantidade: Number(constraints.rows[0].count),
      regra: "Todas as constraints do schema public devem estar validadas."
    });

    console.log(JSON.stringify({
      audit: "AUDITORIA POS-FASE 3",
      mode: "READ ONLY",
      database: database.rows[0].name,
      postgres: database.rows[0].version,
      generatedAt: new Date().toISOString(),
      critical,
      checks: rows
    }, null, 2));
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  } finally {
    await client.end();
  }
  if (critical > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`Falha na auditoria: ${error.message}`);
  process.exit(1);
});
