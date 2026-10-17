const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const AVATAR_DIR = path.resolve(__dirname, '../../uploads/avatars');
const ASSIGNMENT_DIR = path.resolve(__dirname, '../../uploads/assignments');

[AVATAR_DIR, ASSIGNMENT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const sanitizeExt = (ext) => ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => {
    const ext = sanitizeExt(path.extname(file.originalname)) || '.png';
    cb(null, `avatar-${crypto.randomUUID()}${ext}`);
  },
});

const avatarFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(ApiError.badRequest('Invalid image format. Supported formats: JPEG, PNG, WebP'));
};

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: avatarFilter,
});

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ASSIGNMENT_DIR),
  filename: (_req, file, cb) => {
    const ext = sanitizeExt(path.extname(file.originalname));
    cb(null, `file-${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.txt', '.png', '.jpg', '.jpeg', '.webp'];
  if (allowedExts.includes(ext)) cb(null, true);
  else cb(ApiError.badRequest(`File type ${ext} is not supported. Supported types: PDF, Word, Excel, PowerPoint, ZIP, Images, TXT`));
};

const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: fileFilter,
});

module.exports = { avatarUpload, fileUpload };
