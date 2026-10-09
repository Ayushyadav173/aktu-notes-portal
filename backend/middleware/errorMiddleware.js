const AppError = require('../utils/AppError');

const notFound = (req, res, next) =>
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// Every error ends up here and leaves as { success: false, message }.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let errors = err.errors;

  if (err.name === 'ValidationError' && !err.isOperational) {
    status = 400;
    errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors[0] || 'Validation failed.';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id or value.';
  } else if (err.code === 11000) {
    status = 409;
    message = 'That entry already exists.';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Your session is invalid or has expired. Please log in again.';
  } else if (err.name === 'MulterError') {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    status = tooBig ? 413 : 400;
    message = tooBig
      ? `File is too large. Maximum size is ${process.env.MAX_PDF_MB || 20} MB.`
      : 'Invalid file upload.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON.';
  }

  if (status >= 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong';
  }

  const body = { success: false, message };
  if (errors && status < 500) body.errors = errors;
  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
