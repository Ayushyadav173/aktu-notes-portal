const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');

const MAX_PDF_BYTES = (Number(process.env.MAX_PDF_MB) || 20) * 1024 * 1024;
const MAX_COVER_BYTES = 2 * 1024 * 1024;

// Files are kept in memory briefly, then streamed to cloud storage. Nothing is executed.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 2, fields: 20, fieldSize: 20 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'file') {
      if (file.mimetype === 'application/pdf' && ext === '.pdf') return cb(null, true);
      return cb(new AppError(400, 'Only PDF files are allowed for the note file.'));
    }
    if (file.fieldname === 'coverImage') {
      if (['image/jpeg', 'image/png'].includes(file.mimetype) && ['.jpg', '.jpeg', '.png'].includes(ext)) {
        return cb(null, true);
      }
      return cb(new AppError(400, 'Cover image must be a JPG or PNG file.'));
    }
    return cb(new AppError(400, 'Unexpected file field.'));
  },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
]);

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

// Runs after multer: checks the real file contents, not just the name the browser claimed.
const verifyFiles = ({ required }) => (req, res, next) => {
  req.files = req.files || {};
  const pdf = req.files.file && req.files.file[0];
  const cover = req.files.coverImage && req.files.coverImage[0];

  if (required && !pdf) return next(new AppError(400, 'A PDF file is required.'));
  if (pdf && !startsWith(pdf.buffer, [0x25, 0x50, 0x44, 0x46])) {
    return next(new AppError(400, 'The uploaded file is not a valid PDF.'));
  }
  if (cover) {
    const isPng = startsWith(cover.buffer, [0x89, 0x50, 0x4e, 0x47]);
    const isJpg = startsWith(cover.buffer, [0xff, 0xd8, 0xff]);
    if (!isPng && !isJpg) return next(new AppError(400, 'The cover image is not a valid JPG or PNG.'));
    if (cover.size > MAX_COVER_BYTES) return next(new AppError(413, 'Cover image must be 2 MB or smaller.'));
  }
  next();
};

module.exports = { upload, verifyFiles };
