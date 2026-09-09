// DragMe High-Performance Multi-Tier In-Memory Cache & ETag Engine
const crypto = require('crypto');

class CacheService {
  constructor(maxEntries = 2000, defaultTTLMs = 60000) {
    this.cache = new Map(); // key -> { value, expiresAt, tags, lastAccessed }
    this.maxEntries = maxEntries;
    this.defaultTTLMs = defaultTTLMs;

    // Periodic sweep for expired cache keys every 30 seconds
    setInterval(() => this.sweep(), 30000).unref();
  }

  set(key, value, ttlMs = this.defaultTTLMs, tags = []) {
    // Evict oldest entry if limit reached
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tags: Array.isArray(tags) ? tags : [tags],
      lastAccessed: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    item.lastAccessed = Date.now();
    return item.value;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  invalidateTag(tag) {
    let count = 0;
    for (const [key, item] of this.cache.entries()) {
      if (item.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear() {
    this.cache.clear();
  }

  sweep() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Generate deterministic ETag for responses
  generateETag(body) {
    const content = typeof body === 'string' ? body : JSON.stringify(body);
    return `W/"${crypto.createHash('md5').update(content).digest('hex')}"`;
  }
}

const cache = new CacheService();

// Express Cache Middleware Helper
function cacheMiddleware({ ttlMs = 15000, tag = null, keyGenerator = null } = {}) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const cacheKey = keyGenerator ? keyGenerator(req) : `${req.originalUrl || req.url}_u${req.user?.id || 'anon'}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      // Check client conditional ETag header
      const clientETag = req.headers['if-none-match'];
      const currentETag = cache.generateETag(cachedData);

      res.setHeader('ETag', currentETag);
      res.setHeader('X-Cache', 'HIT');

      if (clientETag === currentETag) {
        return res.status(304).end();
      }

      return res.json(cachedData);
    }

    // Intercept res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body) {
        const etag = cache.generateETag(body);
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');

        const resolvedTags = typeof tag === 'function' ? tag(req, body) : (tag ? [tag] : []);
        cache.set(cacheKey, body, ttlMs, resolvedTags);
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  cache,
  cacheMiddleware
};
