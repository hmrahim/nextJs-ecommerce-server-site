// 📁 PATH: backend/src/routes/productRoute.js
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
const {
  getAllPublicProducts,
  getFeaturedProducts,
  searchProducts,
  getProductBySku,
  getProductBySlug,
  getRelatedProducts,
} = require('../controllers/productController/productControllerPublic');

const router = express.Router();

/* ─── Admin ───────────────────────────────────────────── */
router.get   ('/admin/products',              protect, getAllProducts);
router.get   ('/admin/products/:id',          protect, getProductById);
router.post  ('/admin/products',              protect, createProduct);
router.put   ('/admin/products/:id',          protect, updateProduct);
router.patch ('/admin/products/:id/status',   protect, updateStatus);
router.patch ('/admin/products/:id/stock',    protect, updateStock);
router.delete('/admin/products/:id',          protect, deleteProduct);
router.delete('/admin/products/:id/hard',     protect, hardDeleteProduct);

/* ─── Public ──────────────────────────────────────────────
   IMPORTANT: specific paths MUST come before wildcard /:slug
─────────────────────────────────────────────────────────── */
router.get('/products',                    getAllPublicProducts);
router.get('/products/featured',           getFeaturedProducts);
router.get('/products/search',             searchProducts);
router.get('/products/sku/:sku',           getProductBySku);
router.get('/products/:id/related',        getRelatedProducts);
router.get('/products/:slug',              getProductBySlug); // wildcard — LAST

module.exports = router;
