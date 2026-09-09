// DragMe Deep Input Sanitization, Prototype Pollution & Anti-Injection Engine

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

  const clean = Object.create(null); // Protect against prototype pollution
  for (const [k, v] of Object.entries(obj)) {
    // Strip forbidden prototype/constructor keys
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      continue;
    }

    if (typeof v === 'string') {
      // Allow valid media URL formats without over-encoding
      if (k.toLowerCase().includes('url') || k.toLowerCase().includes('media')) {
        clean[k] = v.trim().replace(/[<>"'`]/g, '');
      } else {
        clean[k] = sanitizeText(v);
      }
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
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

module.exports = {
  sanitizeText,
  sanitizeObject,
  sanitizeMiddleware
};
