const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const getToken = (req) => {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.slice(7) : null;
};

// Returns the user for a valid token, otherwise null. Never throws.
async function resolveUser(req) {
  const token = getToken(req);
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(id);
  } catch {
    return null;
  }
}

// Blocks everything except a logged-in admin. The role comes from the database, never from the request.
const protect = asyncHandler(async (req, res, next) => {
  // CSRF guard: a cross-site form cannot add this header, and CORS blocks other sites from sending it.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Requested-With') !== 'fetch') {
    throw new AppError(403, 'Missing required request header.');
  }
  const user = await resolveUser(req);
  if (!user) throw new AppError(401, 'Please log in as admin to continue.');
  if (user.role !== 'admin') throw new AppError(403, 'Admin access only.');
  req.user = user;
  next();
});

// For public routes that show extra data to the admin (for example draft notes).
const optionalAdmin = asyncHandler(async (req, res, next) => {
  const user = await resolveUser(req);
  req.isAdmin = Boolean(user && user.role === 'admin');
  next();
});

module.exports = { protect, optionalAdmin };
