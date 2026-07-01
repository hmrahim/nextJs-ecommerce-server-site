// 📁 PATH: src/routes/analyticsRoutes.js
'use strict';

const express = require('express');
const router = express.Router();

const {
  getOverview,
  getRevenue,
  getCustomerGrowth,
  getFunnel,
  getOrdersByStatus,
  getTopProducts,
  getTopCategories,
  getCouponStats,
} = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — store analytics dashboard (all real-data, computed on the fly)
// Mount at: /admin/analytics
// ══════════════════════════════════════════════════════════════════════════════
router.get('/admin/analytics/overview',              protect, restrictTo('admin'), getOverview);
router.get('/admin/analytics/revenue',                protect, restrictTo('admin'), getRevenue);
router.get('/admin/analytics/customers/growth',       protect, restrictTo('admin'), getCustomerGrowth);
router.get('/admin/analytics/funnel',                 protect, restrictTo('admin'), getFunnel);
router.get('/admin/analytics/orders/status',          protect, restrictTo('admin'), getOrdersByStatus);
router.get('/admin/analytics/products/top',           protect, restrictTo('admin'), getTopProducts);
router.get('/admin/analytics/products/categories',    protect, restrictTo('admin'), getTopCategories);
router.get('/admin/analytics/coupons',                protect, restrictTo('admin'), getCouponStats);

module.exports = router;