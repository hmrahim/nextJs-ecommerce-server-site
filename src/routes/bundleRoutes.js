// 📁 PATH: src/routes/bundleRoutes.js
'use strict';

const express = require('express');
const {
  adminGetAllBundles,
  adminGetBundleById,
  adminCreateBundle,
  adminUpdateBundle,
  adminDeleteBundle,
  adminBulkDeleteBundles,
  adminToggleBundle,
  getAllBundles,
  getBundleBySlug,
} = require('../controllers/bundle.controller');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES  —  /api/admin/bundles
   NOTE: /bulk must come before /:id
══════════════════════════════════════════════════════════════════════════════ */
router.delete('/admin/bundles/bulk',       protect, adminBulkDeleteBundles);

router.get('/admin/bundles',               protect, adminGetAllBundles);
router.post('/admin/bundles',              protect, adminCreateBundle);
router.get('/admin/bundles/:id',           protect, adminGetBundleById);
router.put('/admin/bundles/:id',           protect, adminUpdateBundle);
router.delete('/admin/bundles/:id',        protect, adminDeleteBundle);
router.patch('/admin/bundles/:id/toggle',  protect, adminToggleBundle);

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════════════════════ */
router.get('/bundles',       getAllBundles);
router.get('/bundles/:slug', getBundleBySlug);

module.exports = router;