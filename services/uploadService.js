const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Magic bytes signatures for validated types
const MAGIC_BYTES = {
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
  mp4: [0x00, 0x00, 0x00], // ftyp header checked via string
  mp3: [0x49, 0x44, 0x33], // ID3 header or 0xFF 0xFB
  ogg: [0x4F, 0x67, 0x67, 0x53], // OggS
  wav: [0x52, 0x49, 0x46, 0x46] // RIFF
};

function validateMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;

  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimeType.includes('png')) {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (mimeType.includes('gif')) {
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
  }
  if (mimeType.includes('webp')) {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  }
  if (mimeType.includes('mp3')) {
    return (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) || (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0);
  }
  if (mimeType.includes('ogg')) {
    return buffer[0] === 0x4F && buffer[1] === 0x47 && buffer[2] === 0x67 && buffer[3] === 0x53;
  }
  if (mimeType.includes('wav')) {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  }
  if (mimeType.includes('mp4') || mimeType.includes('video')) {
    // Check if buffer contains 'ftyp' in first 16 bytes
    const headerStr = buffer.slice(4, 12).toString('binary');
    return headerStr.includes('ftyp') || buffer.slice(0, 4).toString('binary').includes('webm');
  }

  return true; // Fallback for audio recorder blobs
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024 // 30 MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'
    ];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported media format. Allowed: JPG, PNG, GIF, WEBP, MP4, WEBM, MP3, WAV, OGG.'));
    }
  }
});

function saveUploadedFile(fileBuffer, originalName, mimeType) {
  if (!validateMagicBytes(fileBuffer, mimeType)) {
    throw new Error('Security check failed: File content does not match reported MIME type.');
  }

  const ext = path.extname(originalName) || (mimeType.includes('png') ? '.png' : mimeType.includes('mp4') ? '.mp4' : mimeType.includes('ogg') ? '.ogg' : '.jpg');
  const safeFilename = `media_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext.toLowerCase()}`;
  const destination = path.join(UPLOADS_DIR, safeFilename);

  fs.writeFileSync(destination, fileBuffer);
  return `/uploads/${safeFilename}`;
}

module.exports = {
  upload,
  saveUploadedFile,
  validateMagicBytes
};
