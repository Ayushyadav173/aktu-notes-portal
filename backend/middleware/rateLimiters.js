const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError(429, message)),
  });

module.exports = {
  loginLimiter: make(15 * 60 * 1000, 10, 'Too many login attempts. Try again in 15 minutes.'),
  submissionLimiter: make(60 * 60 * 1000, 10, 'Too many submissions from this network. Try again later.'),
  apiLimiter: make(15 * 60 * 1000, 600, 'Too many requests. Please slow down.'),
};
