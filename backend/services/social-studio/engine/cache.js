class LruTtlCache {
  constructor({ maxEntries = 64, ttlMs = 15 * 60 * 1000 } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.values = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.values.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.values.delete(key);
    this.values.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key, value) {
    this.values.delete(key);
    this.values.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.values.size > this.maxEntries) this.values.delete(this.values.keys().next().value);
    return value;
  }

  async getOrLoad(key, loader) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const pending = Promise.resolve().then(loader);
    this.set(key, pending);
    try {
      const value = await pending;
      this.set(key, value);
      return value;
    } catch (error) {
      this.values.delete(key);
      throw error;
    }
  }

  stats() {
    return { entries: this.values.size, hits: this.hits, misses: this.misses };
  }
}

module.exports = { LruTtlCache };
