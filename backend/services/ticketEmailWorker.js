function createTicketEmailWorker({ repository, deliver, logger = () => {}, pollMs = 5000 } = {}) {
  let timer = null;
  let stopped = true;
  let draining = false;

  async function drain() {
    if (stopped || draining) return;
    draining = true;
    try {
      for (let index = 0; index < 10 && !stopped; index += 1) {
        const job = await repository.claimNext();
        if (!job) break;
        const heartbeat = setInterval(() => {
          void repository.heartbeat(job).catch((error) => logger('warn', 'ticket_email.heartbeat_failed', { orderId: job.orderId, message: error.message }));
        }, 60 * 1000);
        heartbeat.unref?.();
        let outcome;
        try {
          outcome = await deliver(job.orderId);
        } catch (error) {
          outcome = { status: 'retry', reason: error.code || error.message || 'DELIVERY_ERROR' };
        } finally {
          clearInterval(heartbeat);
        }
        const retry = outcome?.status === 'retry' && job.attempts < job.maxAttempts;
        const status = retry ? 'queued' : outcome?.status === 'retry' ? 'dead' : outcome?.status || 'cancelled';
        const delay = Math.min(15 * 60 * 1000, 5000 * (2 ** Math.max(0, job.attempts - 1)));
        const saved = await repository.complete(job, {
          status,
          nextAttemptAt: retry ? new Date(Date.now() + delay).toISOString() : '',
          error: outcome?.reason || ''
        });
        logger(status === 'delivered' ? 'info' : 'warn', 'ticket_email.job_completed', {
          orderId: job.orderId, status, attempts: job.attempts, accepted: saved, reason: outcome?.reason || ''
        });
      }
    } catch (error) {
      logger('error', 'ticket_email.worker_failed', { code: error.code || 'WORKER_ERROR', message: error.message });
    } finally {
      draining = false;
    }
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    timer = setInterval(() => { void drain(); }, pollMs);
    timer.unref?.();
    void drain();
  }

  function wake() { if (!stopped) void drain(); }
  function stop() { stopped = true; if (timer) clearInterval(timer); timer = null; }

  return { start, wake, drain, stop };
}

module.exports = { createTicketEmailWorker };
