// 📁 PATH: src/routes/bannerRoute.js
'use strict';

const express = require('express');
const router = express.Router();

const {
  adminGetAllBanners,
  adminGetBannerStats,
  adminGetBannerById,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  adminToggleBannerStatus,
  getBannersByPlacement,
  trackBannerClick,
  trackBannerImpression,
} = require('../controllers/bannerController');

const {
  validateCreateBanner,
  validateUpdateBanner,
} = require('../validators/banner.validator');
const { protect } = require('../middleware/authMiddleware');

/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES  —  /api/admin/banners
══════════════════════════════════════════════════════════════════════════════ */

// Stats — /:id এর আগে রাখতে হবে
router.get('/admin/banners/stats', protect, adminGetBannerStats);

// CRUD
router.get('/admin/banners',protect, adminGetAllBanners);
router.post('/admin/banners',protect, validateCreateBanner, adminCreateBanner);
router.get('/admin/banners/:id',protect, adminGetBannerById);
router.put('/admin/banners/:id', protect,validateUpdateBanner, adminUpdateBanner);
router.delete('/admin/banners/:id',protect, adminDeleteBanner);

// Toggle status (live ⇄ paused)
router.patch('/admin/banners/:id/toggle-status',protect, adminToggleBannerStatus);

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════════════════════ */

router.get('/banners/:placement', getBannersByPlacement);
router.patch('/banners/:id/click', trackBannerClick);
router.patch('/banners/:id/impression', trackBannerImpression);

module.exports = router;

// ─── routes/index.js তে এভাবে mount করো ──────────────────────────────────────
//
//  router.use(require('./bannerRoute'));
