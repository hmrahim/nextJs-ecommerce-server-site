// 📁 PATH: src/routes/couponRoute.js
'use strict';

const express = require('express');
const router  = express.Router();

const {
  adminGetAllCoupons,
  adminGetCouponStats,
  adminGenerateCode,
  adminGetCouponById,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
  adminToggleCouponStatus,
  adminBulkDeleteCoupons,
  adminGetCouponUsage,
  validateCoupon,
  applyCoupon,
} = require('../controllers/couponController');

const {
  validateCreateCoupon,
  validateUpdateCoupon,
  validateCouponApply,
  validateBulkDelete,
} = require('../validators/coupon.validator');

const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');

/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES  —  /api/admin/coupons
   (protect + restrictTo('admin') required for all)
══════════════════════════════════════════════════════════════════════════════ */

// ── Stats & utilities (before /:id to avoid param collision) ──────────────────
router.get(
  '/admin/coupons/stats',
  protect, restrictTo('admin'),
  adminGetCouponStats
);

router.get(
  '/admin/coupons/generate-code',
  protect, restrictTo('admin'),
  adminGenerateCode
);

// ── Bulk delete ───────────────────────────────────────────────────────────────
router.delete(
  '/admin/coupons/bulk',
  protect, restrictTo('admin'),
  validateBulkDelete,
  adminBulkDeleteCoupons
);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get(
  '/admin/coupons',
  protect, restrictTo('admin'),
  adminGetAllCoupons
);

router.post(
  '/admin/coupons',
  protect, restrictTo('admin'),
  validateCreateCoupon,
  adminCreateCoupon
);

router.get(
  '/admin/coupons/:id',
  protect, restrictTo('admin'),
  adminGetCouponById
);

router.put(
  '/admin/coupons/:id',
  protect, restrictTo('admin'),
  validateUpdateCoupon,
  adminUpdateCoupon
);

router.delete(
  '/admin/coupons/:id',
  protect, restrictTo('admin'),
  adminDeleteCoupon
);

// ── Toggle active status ──────────────────────────────────────────────────────
router.patch(
  '/admin/coupons/:id/toggle-status',
  protect, restrictTo('admin'),
  adminToggleCouponStatus
);

// ── Usage breakdown ───────────────────────────────────────────────────────────
router.get(
  '/admin/coupons/:id/usage',
  protect, restrictTo('admin'),
  adminGetCouponUsage
);

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC / CUSTOMER ROUTES  —  /api/coupons
   (optionalAuth — logged-in users get per-user limit check)
══════════════════════════════════════════════════════════════════════════════ */

// ── Validate (preview discount, no redemption recorded) ──────────────────────
router.post(
  '/coupons/validate',
  optionalAuth,
  validateCouponApply,
  validateCoupon
);

// ── Apply (records redemption — call after order is confirmed) ────────────────
router.post(
  '/coupons/apply',
  protect,             // must be logged in to redeem
  validateCouponApply,
  applyCoupon
);

module.exports = router;

/* ══════════════════════════════════════════════════════════════════════════════
   routes/index.js তে এভাবে mount করো:
   router.use(require('./couponRoute'));
══════════════════════════════════════════════════════════════════════════════ */