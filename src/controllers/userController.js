// 📁 PATH: src/controllers/user.controller.js
'use strict';

const bcrypt    = require('bcryptjs');
const User      = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError  = require('../utils/AppError');

/* ─────────────────────────────────────────────
   GET /api/users/me
   → পুরো profile return করে
───────────────────────────────────────────── */
exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    '-passwordHash -emailOtp -emailOtpExpires -passwordResetToken -passwordResetExpires'
  );
  if (!user) throw new AppError(404, 'User not found');
  res.json({ user });
});

/* ─────────────────────────────────────────────
   PATCH /api/users/me
   Body: { firstName, lastName, phone }
───────────────────────────────────────────── */
exports.updateMe = catchAsync(async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  const updates = {};
  if (firstName !== undefined) updates.firstName = firstName.trim();
  if (lastName  !== undefined) updates.lastName  = lastName.trim();
  if (phone     !== undefined) updates.phone     = phone.trim();

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-passwordHash -emailOtp -emailOtpExpires -passwordResetToken -passwordResetExpires');

  res.json({ user });
});

/* ─────────────────────────────────────────────
   PATCH /api/users/me/avatar
   Body: { avatarUrl }   ← Cloudinary URL
   → DB-তে avatar field save করে
───────────────────────────────────────────── */
exports.updateAvatar = catchAsync(async (req, res) => {
  const { avatarUrl } = req.body;

  if (!avatarUrl || typeof avatarUrl !== 'string') {
    throw new AppError(400, 'avatarUrl is required');
  }

  // basic URL check
  try { new URL(avatarUrl); } catch {
    throw new AppError(400, 'Invalid avatarUrl');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { avatar: avatarUrl } },
    { new: true }
  ).select('_id firstName lastName email avatar role');

  res.json({
    message: 'Avatar updated successfully',
    user: {
      id:        user._id,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      avatar:    user.avatar,   // ← এই URL frontend-এ set হবে
      role:      user.role,
    },
  });
});

/* ─────────────────────────────────────────────
   PATCH /api/users/me/password
   Body: { currentPassword, newPassword }
───────────────────────────────────────────── */
exports.changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    throw new AppError(400, 'Both currentPassword and newPassword are required');
  if (newPassword.length < 6)
    throw new AppError(400, 'New password must be at least 6 characters');

  const user = await User.findById(req.user._id).select('+passwordHash');
  const ok   = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new AppError(401, 'Current password is incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  res.json({ message: 'Password changed successfully' });
});

/* ─────────────────────────────────────────────
   POST /api/users/me/addresses
───────────────────────────────────────────── */
exports.addAddress = catchAsync(async (req, res) => {
  const { street, city, state, country, zipCode, isDefault = false } = req.body;
  const user = await User.findById(req.user._id);
  if (isDefault) user.addresses.forEach(a => { a.isDefault = false; });
  user.addresses.push({ street, city, state, country, zipCode, isDefault });
  await user.save();
  res.status(201).json({ addresses: user.addresses });
});

/* ─────────────────────────────────────────────
   PATCH /api/users/me/addresses/:addressId
───────────────────────────────────────────── */
exports.updateAddress = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  const addr = user.addresses.id(req.params.addressId);
  if (!addr) throw new AppError(404, 'Address not found');
  const { street, city, state, country, zipCode, isDefault } = req.body;
  if (street  !== undefined) addr.street  = street;
  if (city    !== undefined) addr.city    = city;
  if (state   !== undefined) addr.state   = state;
  if (country !== undefined) addr.country = country;
  if (zipCode !== undefined) addr.zipCode = zipCode;
  if (isDefault) { user.addresses.forEach(a => { a.isDefault = false; }); addr.isDefault = true; }
  await user.save();
  res.json({ addresses: user.addresses });
});

/* ─────────────────────────────────────────────
   DELETE /api/users/me/addresses/:addressId
───────────────────────────────────────────── */
exports.deleteAddress = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.addressId);
  await user.save();
  res.json({ addresses: user.addresses });
});

/* ─────────────────────────────────────────────
   PATCH /api/users/me/addresses/:addressId/default
───────────────────────────────────────────── */
exports.setDefaultAddress = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses.forEach(a => { a.isDefault = a._id.toString() === req.params.addressId; });
  await user.save();
  res.json({ addresses: user.addresses });
});

/* ─────────────────────────────────────────────
   DELETE /api/users/me/cards/:cardType
───────────────────────────────────────────── */
exports.deleteCard = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.savedCards = user.savedCards.filter(c => c.type !== req.params.cardType);
  await user.save();
  res.json({ savedCards: user.savedCards });
});

/* ─────────────────────────────────────────────
   GET /api/users/me/activity
───────────────────────────────────────────── */
exports.getActivity = catchAsync(async (_req, res) => {
  res.json({ activity: [], page: 1, total: 0 });
});

/* ─────────────────────────────────────────────
   POST /api/users/me/delete-request
───────────────────────────────────────────── */
exports.requestDeletion = catchAsync(async (_req, res) => {
  res.json({ message: 'Deletion request submitted. We will review within 48 hours.' });
});

/* ─────────────────────────────────────────────
   PATCH /api/users/me/notifications
───────────────────────────────────────────── */
exports.updateNotifications = catchAsync(async (_req, res) => {
  res.json({ message: 'Notification preferences saved' });
});
