'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiHelpers');
const { protect } = require('../middleware/auth.middleware');
const Notification = require('../models/Notification.model');

router.get('/me', protect, asyncHandler(async (req, res) => {
  const list = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  return ApiResponse.success(res, list);
}));

router.patch('/:id/read', protect, asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { isRead: true }, { new: true });
  return ApiResponse.success(res, n);
}));

router.patch('/read-all', protect, asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  return ApiResponse.success(res, null, 'All marked as read');
}));

module.exports = router;
