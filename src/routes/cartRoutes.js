// 📁 PATH: src/routes/cartRoutes.js
'use strict';

const express = require('express');
const router  = express.Router();

const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  mergeCart,
} = require('../controllers/cart.controller');

const { optionalAuth, protect } = require('../middleware/authMiddleware');

const {
  addItemValidator,
  updateItemValidator,
  removeItemValidator,
  mergeCartValidator,
} = require('../validators/cart.validator');

/* ══════════════════════════════════════════════════════════════
   CART ROUTES — /api/cart
   Works for both logged-in users (JWT) and guests (x-session-id)
══════════════════════════════════════════════════════════════ */

router.get('/cart',             optionalAuth, getCart);
router.post('/cart/items',      optionalAuth, addItemValidator,    addItem);
router.patch('/cart/items/:productId',  optionalAuth, updateItemValidator, updateItem);
router.delete('/cart/items/:productId', optionalAuth, removeItemValidator, removeItem);
router.delete('/cart',          optionalAuth, clearCart);

// Merge guest cart into user cart after login (requires auth)
router.post('/cart/merge', protect, mergeCartValidator, mergeCart);

module.exports = router;