const router = require('express').Router();
const { getStats } = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

router.get('/stats', protect, getStats);

module.exports = router;
