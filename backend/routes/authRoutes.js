const router = require('express').Router();
const { login, logout, me } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiters');
const validators = require('../middleware/validators');

router.post('/login', loginLimiter, validators.login, login);
router.post('/logout', logout);
router.get('/me', protect, me);

module.exports = router;
