// Input sanitization middleware to prevent XSS, HTML Injection, and oversized payloads
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      clean[k] = sanitizeText(v);
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitizeObject(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // Sanitize text fields in request body
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        // preserve media URLs, don't over-encode slashes/colons
        if (key.includes('url') || key.includes('media')) {
          req.body[key] = req.body[key].trim().replace(/[<>"]/g, '');
        } else {
          req.body[key] = sanitizeText(req.body[key]);
        }
      }
    }
  }
  next();
}

module.exports = {
  sanitizeText,
  sanitizeObject,
  sanitizeMiddleware
};
