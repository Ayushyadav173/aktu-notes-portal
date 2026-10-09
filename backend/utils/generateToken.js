const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'token';

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

const cookieOptions = () => {
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';
  return {
    httpOnly: true, // JavaScript in the browser can never read this cookie
    sameSite,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    path: '/',
  };
};

const setAuthCookie = (res, token) =>
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: 24 * 60 * 60 * 1000 });

const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, cookieOptions());

module.exports = { COOKIE_NAME, signToken, setAuthCookie, clearAuthCookie };
