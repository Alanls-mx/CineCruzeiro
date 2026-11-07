// Owns periodic triggers only. The work they start may outlive stop(); workers
// and external calls retain their existing leases and recovery policies.
function createBackendRuntimeSchedule({
  runSubscriptionMaintenance, runMovieImageMaintenance, runEmailAttachmentMaintenance,
  runSystemLogMaintenance, resumeSocialStudio, startPostgresWorkers,
  stopPostgresWorkers, postgresEnabled, pruneCrmOutbox, sendDiscordHealth,
  subscriptionIntervalMs, setIntervalFn = setInterval, clearIntervalFn = clearInterval
}) {
  const timers = [];
  let started = false;

  function every(callback, intervalMs) {
    const timer = setIntervalFn(callback, intervalMs);
    timer.unref?.();
    timers.push(timer);
  }

  function start() {
    if (started) return;
    started = true;
    void runSubscriptionMaintenance();
    void runMovieImageMaintenance();
    void runEmailAttachmentMaintenance();
    void resumeSocialStudio();
    every(() => { void resumeSocialStudio(); }, 60 * 1000);
    if (postgresEnabled()) {
      startPostgresWorkers();
      void runSystemLogMaintenance();
    }
    every(() => { void runSystemLogMaintenance(); }, 6 * 60 * 60 * 1000);
    every(() => { void runSubscriptionMaintenance(); }, subscriptionIntervalMs);
    every(() => { void runMovieImageMaintenance(); }, 6 * 60 * 60 * 1000);
    every(() => { void runEmailAttachmentMaintenance(); }, 24 * 60 * 60 * 1000);
    void pruneCrmOutbox();
    every(() => { void pruneCrmOutbox(); }, 24 * 60 * 60 * 1000);
    every(sendDiscordHealth, 15000);
  }

  function stop() {
    if (!started) return;
    started = false;
    for (const timer of timers.splice(0)) clearIntervalFn(timer);
    stopPostgresWorkers();
  }

  return { start, stop };
}

module.exports = { createBackendRuntimeSchedule };
