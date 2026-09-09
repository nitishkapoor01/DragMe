// DragMe Tiered Rate Limiter, Anti-Abuse & Brute-Force Auto-Jail Engine
const ipHits = new Map();
const failedAttempts = new Map(); // key -> { count, lockedUntil }

function rateLimiter({ windowMs = 60 * 1000, max = 60, message = 'Too many requests. Please slow down.' } = {}) {
  return (req, res, next) => {
    const key = (req.user ? `user_${req.user.id}` : `ip_${req.ip || req.connection.remoteAddress || 'unknown'}`);
    const now = Date.now();

    // Check if IP or user is in jail lockout
    const jail = failedAttempts.get(key);
    if (jail && jail.lockedUntil > now) {
      const waitMinutes = Math.ceil((jail.lockedUntil - now) / 60000);
      res.setHeader('Retry-After', waitMinutes * 60);
      return res.status(429).json({
        error: `Account temporarily locked due to excessive failed attempts. Try again in ${waitMinutes} minute(s).`,
        locked: true,
        retryAfter: waitMinutes * 60
      });
    }

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

// Track and punish brute-force failures
function recordFailedAttempt(key) {
  const now = Date.now();
  const entry = failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;

  if (entry.count >= 5) {
    // Lock for 15 minutes
    entry.lockedUntil = now + (15 * 60 * 1000);
  }

  failedAttempts.set(key, entry);
}

function clearFailedAttempts(key) {
  failedAttempts.delete(key);
}

// Periodic cleanup of expired rate limits and jails
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of ipHits.entries()) {
    const freshHits = hits.filter(ts => now - ts < 600000);
    if (freshHits.length === 0) ipHits.delete(key);
    else ipHits.set(key, freshHits);
  }

  for (const [key, jail] of failedAttempts.entries()) {
    if (now > jail.lockedUntil && jail.count === 0) {
      failedAttempts.delete(key);
    }
  }
}, 300000).unref();

module.exports = {
  rateLimiter,
  recordFailedAttempt,
  clearFailedAttempts
};
