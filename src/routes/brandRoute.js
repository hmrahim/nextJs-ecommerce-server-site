// 📁 PATH: src/routes/brandRoutes.js
'use strict';

const express = require('express');
const { adminGetBrandStats, adminReorderBrands, adminGetAllBrands, adminCreateBrand, adminGetBrandById, adminUpdateBrand, adminDeleteBrand, adminToggleBrand, adminFeatureBrand, getAllBrands, getBrandBySlug } = require('../controllers/brandController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();


/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES  —  /api/admin/brands
══════════════════════════════════════════════════════════════════════════════ */

// Stats & Reorder — /:id এর আগে রাখতে হবে
router.get('/admin/brands/stats',protect, adminGetBrandStats);
router.patch('/admin/brands/reorder',protect, adminReorderBrands);

// CRUD
router.get('/admin/brands',protect, adminGetAllBrands);
router.post('/admin/brands',protect, adminCreateBrand);
router.get('/admin/brands/:id',protect, adminGetBrandById);
router.put('/admin/brands/:id',protect, adminUpdateBrand);
router.delete('/admin/brands/:id',protect, adminDeleteBrand);

// Toggle patches
router.patch('/admin/brands/:id/toggle',protect, adminToggleBrand);
router.patch('/admin/brands/:id/feature',protect, adminFeatureBrand);

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════════════════════ */
router.get('/brands', getAllBrands);
router.get('/brands/:slug', getBrandBySlug);

module.exports = router;

// ─── app.js তে এভাবে mount করো ───────────────────────────────────────────────
//
//  const brandRouter = require('./routes/brandRoutes');
//  app.use('/api', brandRouter);