// Owns periodic triggers only. The work they start may outlive stop(); workers
// and external calls retain their existing leases and recovery policies.
function createBackendRuntimeSchedule({
  runSubscriptionMaintenance, runMovieImageMaintenance, runEmailAttachmentMaintenance,
  runSystemLogMaintenance, resumeSocialStudio, startPostgresWorkers,
  stopPostgresWorkers, postgresEnabled, pruneCrmOutbox, sendDiscordHealth,
  subscriptionIntervalMs, onTaskError = () => {},
  setIntervalFn = setInterval, clearIntervalFn = clearInterval
}) {
  const timers = [];
  let started = false;

  function every(callback, intervalMs) {
    const timer = setIntervalFn(callback, intervalMs);
    timer.unref?.();
    timers.push(timer);
  }

  function runObserved(name, task) {
    try {
      const result = task();
      if (result && typeof result.then === "function") {
        void Promise.resolve(result).catch((error) => onTaskError(name, error));
      }
    } catch (error) {
      onTaskError(name, error);
    }
  }

  function start() {
    if (started) return;
    started = true;
    runObserved("subscription", runSubscriptionMaintenance);
    runObserved("movie-image", runMovieImageMaintenance);
    runObserved("email-attachment", runEmailAttachmentMaintenance);
    runObserved("social-studio", resumeSocialStudio);
    every(() => runObserved("social-studio", resumeSocialStudio), 60 * 1000);
    if (postgresEnabled()) {
      startPostgresWorkers();
      runObserved("system-log", runSystemLogMaintenance);
    }
    every(() => runObserved("system-log", runSystemLogMaintenance), 6 * 60 * 60 * 1000);
    every(() => runObserved("subscription", runSubscriptionMaintenance), subscriptionIntervalMs);
    every(() => runObserved("movie-image", runMovieImageMaintenance), 6 * 60 * 60 * 1000);
    every(() => runObserved("email-attachment", runEmailAttachmentMaintenance), 24 * 60 * 60 * 1000);
    runObserved("crm-outbox", pruneCrmOutbox);
    every(() => runObserved("crm-outbox", pruneCrmOutbox), 24 * 60 * 60 * 1000);
    every(() => runObserved("discord-health", sendDiscordHealth), 15000);
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
