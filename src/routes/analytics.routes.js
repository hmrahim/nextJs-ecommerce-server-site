'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiHelpers');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const Order = require('../models/Order.model');
const User  = require('../models/User');
const Product = require('../models/Product.model');
const Visitor = require('../models/Visitor.model');
const Review = require('../models/Review.model');
const Transaction = require('../models/Transaction.model');

const adminOnly = [protect, restrictTo('admin')];

router.get('/overview', adminOnly, asyncHandler(async (_req, res) => {
  const [totalOrders, totalUsers, totalProducts, revenueAgg, paidOrders, todayVisitors] = await Promise.all([
    Order.countDocuments({}),
    User.countDocuments({}),
    Product.countDocuments({ isActive: true }),
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.countDocuments({ paymentStatus: 'paid' }),
    Visitor.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 24*60*60*1000) } }),
  ]);
  return ApiResponse.success(res, {
    totalOrders,
    totalUsers,
    totalProducts,
    paidOrders,
    totalRevenue: revenueAgg[0]?.total || 0,
    todayVisitors,
  });
}));

router.get('/revenue', adminOnly, asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '30', 10), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const data = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return ApiResponse.success(res, data);
}));

router.get('/top-products', adminOnly, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
  const data = await Order.aggregate([
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', name: { $first: '$items.name' }, qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);
  return ApiResponse.success(res, data);
}));

router.get('/customer-growth', adminOnly, asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '30', 10), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const data = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return ApiResponse.success(res, data);
}));

router.get('/orders-by-status', adminOnly, asyncHandler(async (_req, res) => {
  const data = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  return ApiResponse.success(res, data);
}));

router.get('/category-share', adminOnly, asyncHandler(async (_req, res) => {
  const data = await Product.aggregate([
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $project: { count: 1, name: { $arrayElemAt: ['$category.name', 0] } } },
  ]);
  return ApiResponse.success(res, data);
}));

router.get('/recent-orders', adminOnly, asyncHandler(async (_req, res) => {
  const data = await Order.find({}).sort({ createdAt: -1 }).limit(10).populate('userId', 'firstName lastName email').lean();
  return ApiResponse.success(res, data);
}));

router.get('/reviews-summary', adminOnly, asyncHandler(async (_req, res) => {
  const data = await Review.aggregate([{ $group: { _id: '$rating', count: { $sum: 1 } } }, { $sort: { _id: -1 } }]);
  return ApiResponse.success(res, data);
}));

router.get('/transactions-summary', adminOnly, asyncHandler(async (_req, res) => {
  const data = await Transaction.aggregate([{ $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  return ApiResponse.success(res, data);
}));

module.exports = router;
