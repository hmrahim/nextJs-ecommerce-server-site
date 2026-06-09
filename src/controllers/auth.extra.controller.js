'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');

const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';

function signAccess(user){
  return jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}
function signRefresh(user){
  return jwt.sign({ id: user._id.toString(), type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: REFRESH_TTL });
}
function setRefreshCookie(res, token){
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   30 * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });
}

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password required');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'Invalid credentials');
  if (!user.isActive) throw new ApiError(403, 'Account deactivated');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Invalid credentials');

  const accessToken  = signAccess(user);
  const refreshToken = signRefresh(user);
  setRefreshCookie(res, refreshToken);

  return ApiResponse.success(res, {
    accessToken, refreshToken,
    user: user.toPublicJSON(),
  }, 'Login successful');
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token');
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (_) { throw new ApiError(401, 'Invalid refresh token'); }
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new ApiError(401, 'User unavailable');
  const accessToken  = signAccess(user);
  const refreshToken = signRefresh(user);
  setRefreshCookie(res, refreshToken);
  return ApiResponse.success(res, { accessToken, refreshToken }, 'Token refreshed');
});

exports.logout = asyncHandler(async (_req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
  return ApiResponse.success(res, null, 'Logged out');
});

exports.me = asyncHandler(async (req, res) => ApiResponse.success(res, req.user.toPublicJSON ? req.user.toPublicJSON() : req.user));

exports.updateMe = asyncHandler(async (req, res) => {
  const allowed = ['firstName','lastName','phone','addresses'];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
  return ApiResponse.success(res, user.toPublicJSON(), 'Profile updated');
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Both passwords required');
  if (String(newPassword).length < 8) throw new ApiError(422, 'New password must be at least 8 characters');
  const user = await User.findById(req.user._id).select('+passwordHash');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Current password incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  return ApiResponse.success(res, null, 'Password updated');
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'Email required');
  const user = await User.findOne({ email: String(email).toLowerCase() });
  // Always respond success to avoid email enumeration
  if (user) {
    const raw  = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    user.passwordResetToken   = hash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    // TODO: send email via your provider; we return token in dev for testing
    if (process.env.NODE_ENV !== 'production') {
      return ApiResponse.success(res, { resetToken: raw }, 'Reset token generated (dev)');
    }
  }
  return ApiResponse.success(res, null, 'If the email exists, a reset link was sent');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) throw new ApiError(400, 'Token and newPassword required');
  const hash = crypto.createHash('sha256').update(String(token)).digest('hex');
  const user = await User.findOne({ passwordResetToken: hash, passwordResetExpires: { $gt: new Date() } }).select('+passwordHash');
  if (!user) throw new ApiError(400, 'Invalid or expired token');
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  return ApiResponse.success(res, null, 'Password reset successfully');
});
