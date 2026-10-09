const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/generateToken');

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  const passwordOk = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

  if (!user || !passwordOk || user.role !== 'admin') {
    throw new AppError(401, 'Incorrect email or password.');
  }
  setAuthCookie(res, signToken(user._id));
  res.json({ success: true, message: 'Logged in successfully.', data: { user: publicUser(user) } });
});

// POST /api/auth/logout
exports.logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out.', data: {} });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Authenticated.', data: { user: publicUser(req.user) } });
});
