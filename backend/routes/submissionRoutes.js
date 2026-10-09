const router = require('express').Router();
const c = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const { upload, verifyFiles } = require('../middleware/uploadMiddleware');
const { submissionLimiter } = require('../middleware/rateLimiters');
const v = require('../middleware/validators');

// Hidden "website" field: real people leave it empty, simple bots fill it in.
// Bots get a fake success so they do not learn they were blocked.
const honeypot = (req, res, next) => {
  if (req.body && req.body.website) {
    return res.status(201).json({ success: true, message: 'Submitted.', data: {} });
  }
  next();
};

// Public: students submit notes (always saved as pending).
router.post('/', submissionLimiter, upload, honeypot, verifyFiles({ required: true }), v.submission, c.createSubmission);

// Admin only.
router.get('/', protect, c.listSubmissions);
router.get('/:id', protect, v.mongoId, c.getSubmission);
router.put('/:id/approve', protect, v.mongoId, c.approveSubmission);
router.put('/:id/reject', protect, v.mongoId, v.reject, c.rejectSubmission);

module.exports = router;
