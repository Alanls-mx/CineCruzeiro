const { queryPostgres } = require('../db/postgresStore');

function createTicketEmailJobRepository() {
  return {
    async claimNext() {
      const result = await queryPostgres(`
        WITH candidate AS (
          SELECT order_id FROM ticket_email_jobs
          WHERE (status = 'queued' AND next_attempt_at <= now())
             OR (status = 'processing' AND locked_at < now() - interval '10 minutes')
          ORDER BY created_at, order_id FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE ticket_email_jobs AS job
        SET status = 'processing', attempts = job.attempts + 1,
            locked_at = now(), lease_token = gen_random_uuid()::text, updated_at = now()
        FROM candidate WHERE job.order_id = candidate.order_id
        RETURNING job.order_id, job.attempts, job.max_attempts, job.lease_token
      `);
      const row = result.rows[0];
      return row ? { orderId: row.order_id, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts), leaseToken: row.lease_token } : null;
    },
    async heartbeat(job) {
      const result = await queryPostgres(`UPDATE ticket_email_jobs SET locked_at = now(), updated_at = now()
        WHERE order_id = $1 AND lease_token = $2 AND status = 'processing'`, [job.orderId, job.leaseToken]);
      return result.rowCount > 0;
    },
    async complete(job, { status, nextAttemptAt = '', error = '' }) {
      const result = await queryPostgres(`UPDATE ticket_email_jobs
        SET status = $3, next_attempt_at = COALESCE(NULLIF($4, '')::timestamptz, now()),
            last_error = NULLIF($5, ''), locked_at = NULL, lease_token = NULL,
            delivered_at = CASE WHEN $3 = 'delivered' THEN now() ELSE delivered_at END,
            updated_at = now()
        WHERE order_id = $1 AND lease_token = $2 AND status = 'processing'`,
      [job.orderId, job.leaseToken, status, nextAttemptAt, String(error).slice(0, 500)]);
      return result.rowCount > 0;
    }
  };
}

module.exports = { createTicketEmailJobRepository };
