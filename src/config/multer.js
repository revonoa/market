const path = require('path');
const multer = require('multer');
const fs = require('fs');

const uploadRoot = process.env.UPLOAD_DIR || 'public/uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadRoot);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('Invalid file type'), ok);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
