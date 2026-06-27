// 📁 PATH: src/routes/flashSaleRoutes.js
// Flash Sale routes — production ready
'use strict';

const express = require('express');
const router = express.Router();

const {
    adminGetAll,
    adminGetStats,
    adminGetById,
    adminCreate,
    adminUpdate,
    adminDelete,
    adminToggle,
    adminBulkDelete,
    adminDuplicate,
    adminAddProducts,
    adminRemoveProduct,
    adminUpdateProduct,
    adminGetSaleStats,
    adminGetRevenue,
    getActive,
    getUpcoming,
    getBySlug,
    getOfferProducts,
    purchaseCheck,
} = require('../controllers/flashSaleController');

const {
    validateCreateFlashSale,
    validateUpdateFlashSale,
    validateAddProducts,
    validateUpdateProduct,
    validateBulkDelete,
    validatePurchaseCheck,
} = require('../validators/flashSale.validator');

const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');

/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES  —  /api/admin/flash-sales
   (protect + restrictTo('admin') required for all)
══════════════════════════════════════════════════════════════════════════════ */

// ── Stats & revenue (before /:id to avoid param collision) ───────────────────
router.get(
    '/admin/flash-sales/stats',
    protect, restrictTo('admin'),
    adminGetStats
);

router.get(
    '/admin/flash-sales/revenue',
    protect, restrictTo('admin'),
    adminGetRevenue
);

// ── Bulk delete ──────────────────────────────────────────────────────────────
router.delete(
    '/admin/flash-sales/bulk',
    protect, restrictTo('admin'),
    validateBulkDelete,
    adminBulkDelete
);

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get(
    '/admin/flash-sales',
    protect, restrictTo('admin'),
    adminGetAll
);

router.post(
    '/admin/flash-sales',
    protect, restrictTo('admin'),
    validateCreateFlashSale,
    adminCreate
);

router.get(
    '/admin/flash-sales/:id',
    protect, restrictTo('admin'),
    adminGetById
);

router.put(
    '/admin/flash-sales/:id',
    protect, restrictTo('admin'),
    validateUpdateFlashSale,
    adminUpdate
);

router.delete(
    '/admin/flash-sales/:id',
    protect, restrictTo('admin'),
    adminDelete
);

// ── Toggle active status ─────────────────────────────────────────────────────
router.patch(
    '/admin/flash-sales/:id/toggle',
    protect, restrictTo('admin'),
    adminToggle
);

// ── Duplicate ────────────────────────────────────────────────────────────────
router.post(
    '/admin/flash-sales/:id/duplicate',
    protect, restrictTo('admin'),
    adminDuplicate
);

// ── Product management within a flash sale ───────────────────────────────────
router.post(
    '/admin/flash-sales/:id/products',
    protect, restrictTo('admin'),
    validateAddProducts,
    adminAddProducts
);

router.delete(
    '/admin/flash-sales/:id/products/:prodId',
    protect, restrictTo('admin'),
    adminRemoveProduct
);

router.patch(
    '/admin/flash-sales/:id/products/:prodId',
    protect, restrictTo('admin'),
    validateUpdateProduct,
    adminUpdateProduct
);

// ── Per-sale stats ───────────────────────────────────────────────────────────
router.get(
    '/admin/flash-sales/:id/stats',
    protect, restrictTo('admin'),
    adminGetSaleStats
);

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC / STOREFRONT ROUTES  —  /api/flash-sales
══════════════════════════════════════════════════════════════════════════════ */

// ── Active flash sales (for homepage/storefront) ─────────────────────────────
router.get(
    '/flash-sales/active',
    getActive
);

// ── Upcoming flash sales ─────────────────────────────────────────────────────
router.get(
    '/flash-sales/upcoming',
    getUpcoming
);

// ── Offer products: resolved product list for current active sale ────────────
//    (handles both applicationType === 'all' and 'specific')
router.get(
    '/flash-sales/offer-products',
    getOfferProducts
);

// ── Single flash sale by slug (public detail page) ───────────────────────────
router.get(
    '/flash-sales/:slug',
    getBySlug
);

// ── Purchase eligibility check (requires auth) ───────────────────────────────
router.post(
    '/flash-sales/:id/purchase-check',
    protect,
    validatePurchaseCheck,
    purchaseCheck
);

module.exports = router;
