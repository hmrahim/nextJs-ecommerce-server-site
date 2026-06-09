'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiHelpers');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const Order = require('../models/Order.model');
const adminOnly = [protect, restrictTo('admin')];

router.get('/sales', adminOnly, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = { paymentStatus: 'paid' };
  if (from || to) match.createdAt = {};
  if (from) match.createdAt.$gte = new Date(from);
  if (to)   match.createdAt.$lte = new Date(to);
  const data = await Order.aggregate([
    { $match: match },
    { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, items: { $sum: { $size: '$items' } } } },
  ]);
  return ApiResponse.success(res, data[0] || { revenue: 0, orders: 0, items: 0 });
}));

router.get('/sales-heatmap', adminOnly, asyncHandler(async (_req, res) => {
  const data = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: { dow: { $dayOfWeek: '$createdAt' }, hour: { $hour: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
  ]);
  return ApiResponse.success(res, data);
}));

module.exports = router;
