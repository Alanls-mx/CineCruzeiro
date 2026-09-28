function createSnapshotCache({ load, clone, ttlMs = 30000, now = Date.now }) {
  const entries = new Map();
  const inFlight = new Map();
  let generation = 0;
  let hits = 0, misses = 0, invalidations = 0;
  const durations = [];
  return {
    async read(key) {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > now()) { hits += 1; return clone(cached.value); }
      misses += 1;
      if (!inFlight.has(key)) {
        const version = generation;
        const started = performance.now();
        const pending = Promise.resolve().then(() => load(key)).then((value) => {
          if (version === generation) entries.set(key, { value, expiresAt: now() + ttlMs });
          return value;
        }).finally(() => {
          durations.push(Math.round(performance.now() - started));
          if (durations.length > 100) durations.shift();
          if (inFlight.get(key) === pending) inFlight.delete(key);
        });
        inFlight.set(key, pending);
      }
      return clone(await inFlight.get(key));
    },
    invalidate() { generation += 1; invalidations += 1; entries.clear(); inFlight.clear(); },
    metrics() {
      const sorted = [...durations].sort((a, b) => a - b);
      return { hits, misses, invalidations, entries: entries.size, pending: inFlight.size, loadP95Ms: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null, ttlMs };
    }
  };
}
module.exports = { createSnapshotCache };
