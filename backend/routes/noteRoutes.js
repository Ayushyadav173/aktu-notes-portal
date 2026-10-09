const router = require('express').Router();
const c = require('../controllers/noteController');
const { protect, optionalAdmin } = require('../middleware/authMiddleware');
const { upload, verifyFiles } = require('../middleware/uploadMiddleware');
const v = require('../middleware/validators');

// Fixed paths must come before "/:id" or Express would treat "search" as an id.
router.get('/', optionalAdmin, c.listNotes);
router.get('/search', optionalAdmin, c.listNotes);
router.get('/popular-subjects', c.popularSubjects);
router.get('/unit-counts', c.unitCounts);
router.get('/:id', optionalAdmin, v.mongoId, c.getNote);
router.post('/:id/download', v.mongoId, c.downloadNote);

// Admin only. Multer parses the form first, then files and fields are validated.
router.post('/', protect, upload, verifyFiles({ required: true }), v.adminNote, c.createNote);
router.put('/:id', protect, v.mongoId, upload, verifyFiles({ required: false }), v.adminNote, c.updateNote);
router.delete('/:id', protect, v.mongoId, c.deleteNote);

module.exports = router;
