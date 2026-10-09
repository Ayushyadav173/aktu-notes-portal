require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { UPLOAD_DIR } = require('./utils/fileStorage');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.set('trust proxy', 1); // Render and Vercel sit behind a proxy; needed for rate limiting by real IP

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);

const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean),
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips "$" and "." keys so users cannot inject MongoDB operators

// ---- API ----
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running.', data: {} }));
app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api', notFound);

// ---- Static files (development convenience; on Vercel the frontend is hosted separately) ----
if (process.env.STORAGE_DRIVER === 'local' && process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(UPLOAD_DIR, { setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));
}
app.get('/admin', (req, res) => res.redirect('/admin/dashboard.html'));
app.get('/admin/login', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'login.html')));
app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));

app.use(errorHandler);

if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is missing. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  connectDB()
    .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error('Startup failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
