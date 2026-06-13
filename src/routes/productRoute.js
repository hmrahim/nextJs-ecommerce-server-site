// routes/productRoutes.js  (অথবা তোমার existing file যেটাই হোক)
const express = require('express');
const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  hardDeleteProduct,
  updateStatus,
  updateStock,
} = require('../controllers/productController/productControllerAdmin');
const { protect } = require('../middleware/authMiddleware');
const { getAllPublicProducts, getFeaturedProducts, searchProducts, getProductBySku, getProductBySlug, getRelatedProducts } = require('../controllers/productController/productControllerPublic');

const router = express.Router();

// ── GET ──────────────────────────────────────────────────────────────
router.get('/admin/products', protect, getAllProducts);
router.get('/admin/products/:id', protect, getProductById);

// ── POST ─────────────────────────────────────────────────────────────
router.post('/admin/products', protect, createProduct);

// ── PUT ──────────────────────────────────────────────────────────────
router.put('/admin/products/:id', protect, updateProduct);

// ── PATCH ─────────────────────────────────────────────────────────────
router.patch('/admin/products/:id/status', protect, updateStatus);
router.patch('/admin/products/:id/stock', protect, updateStock);

// ── DELETE ────────────────────────────────────────────────────────────
router.delete('/admin/products/:id', protect, deleteProduct);      // soft-delete (archive)
router.delete('/admin/products/:id/hard', protect, hardDeleteProduct);  // permanent delete

// ===============public api====================
router.get('/products', getAllPublicProducts);

// GET /api/products/featured
router.get('/products/featured', getFeaturedProducts);

// GET /api/products/search?q=keyword
router.get('/products/search', searchProducts);

// GET /api/products/sku/:sku
router.get('/products/sku/:sku', getProductBySku);

// GET /api/products/:slug          ← wildcard, LAST
router.get('/products/:slug', getProductBySlug);

// GET /api/products/:id/related
router.get('/products/:id/related', getRelatedProducts);

module.exports = router;