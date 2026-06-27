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
  getBannersByPlatform,
  getBannersByPlatformAndPlacement,
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

router.get('/admin/banners/stats', protect, adminGetBannerStats);
router.get('/admin/banners', protect, adminGetAllBanners);
router.post('/admin/banners', protect, validateCreateBanner, adminCreateBanner);
router.get('/admin/banners/:id', protect, adminGetBannerById);
router.put('/admin/banners/:id', protect, validateUpdateBanner, adminUpdateBanner);
router.delete('/admin/banners/:id', protect, adminDeleteBanner);
router.patch('/admin/banners/:id/toggle-status', protect, adminToggleBannerStatus);

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
   ✅ IMPORTANT: specific routes MUST come before wildcard routes
══════════════════════════════════════════════════════════════════════════════ */

// ✅ Most specific first — platform + placement
router.get('/banners/platform/:platform/placement/:placement', getBannersByPlatformAndPlacement);

// ✅ Then platform only
router.get('/banners/platform/:platform', getBannersByPlatform);

// Analytics — before /:placement so "click"/"impression" don't get caught as placement
router.patch('/banners/:id/click', trackBannerClick);
router.patch('/banners/:id/impression', trackBannerImpression);

// ✅ Legacy placement route — last (most generic)
router.get('/banners/:placement', getBannersByPlacement);

module.exports = router;