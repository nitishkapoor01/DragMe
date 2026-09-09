// Sliding window in-memory rate limiter to prevent spam, bot scraping, and brute force
const ipHits = new Map();

function rateLimiter({ windowMs = 60 * 1000, max = 60, message = 'Too many requests. Please slow down.' } = {}) {
  return (req, res, next) => {
    const key = (req.user ? `user_${req.user.id}` : `ip_${req.ip || req.connection.remoteAddress || 'unknown'}`);
    const now = Date.now();

    let record = ipHits.get(key);
    if (!record) {
      record = [];
      ipHits.set(key, record);
    }

    // Filter out timestamps outside current window
    const recentHits = record.filter(ts => now - ts < windowMs);
    recentHits.push(now);
    ipHits.set(key, recentHits);

    if (recentHits.length > max) {
      const retryAfterSeconds = Math.ceil((recentHits[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSeconds
      });
    }

    next();
  };
}

// Clean up stale records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of ipHits.entries()) {
    const freshHits = hits.filter(ts => now - ts < 600000);
    if (freshHits.length === 0) {
      ipHits.delete(key);
    } else {
      ipHits.set(key, freshHits);
    }
  }
}, 600000);

module.exports = {
  rateLimiter
};
