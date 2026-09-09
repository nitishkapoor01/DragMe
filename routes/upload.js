const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { upload, saveUploadedFile } = require('../services/uploadService');

router.post('/', requireAuth, rateLimiter({ windowMs: 60000, max: 20 }), upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No media file provided.' });
  }

  try {
    const fileUrl = saveUploadedFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    return res.json({
      message: 'Media uploaded successfully!',
      url: fileUrl,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload validation error:', err.message);
    return res.status(400).json({ error: err.message || 'File upload failed validation.' });
  }
});

module.exports = router;
