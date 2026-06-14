// 📁 PATH: backend/src/routes/productVariantRoutes.js
const express = require('express');
const {
  getVariants,
  createVariant,
  bulkGenerateVariants,
  updateVariant,
  deleteAllVariants,
  deleteVariant,
  toggleVariant,
  getPublicVariants,
} = require('../controllers/variantController/productVariantController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router({ mergeParams: true });

/* ── Public ───────────────────────────────────────────── */
router.get('/products/:productId/variants', getPublicVariants);

/* ── Admin ────────────────────────────────────────────── */
router.get   ('/admin/products/:productId/variants',                    protect, getVariants);
router.post  ('/admin/products/:productId/variants',                    protect, createVariant);
router.post  ('/admin/products/:productId/variants/bulk',               protect, bulkGenerateVariants);
router.put   ('/admin/products/:productId/variants/:variantId',         protect, updateVariant);
router.delete('/admin/products/:productId/variants',                    protect, deleteAllVariants);
router.delete('/admin/products/:productId/variants/:variantId',         protect, deleteVariant);
router.patch ('/admin/products/:productId/variants/:variantId/toggle',  protect, toggleVariant);

module.exports = router;
