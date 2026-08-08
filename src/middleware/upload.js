const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const TYPES_AUTORISES = [
  'image/jpeg', 'image/png',
  'application/pdf',
  'audio/mpeg', 'audio/wav', 'audio/ogg'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter: (req, file, cb) => {
    if (TYPES_AUTORISES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé (JPEG, PNG, PDF, MP3, WAV, OGG uniquement)'));
    }
  }
});

module.exports = upload;
