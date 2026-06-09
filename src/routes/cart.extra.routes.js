'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const Cart = require('../models/Cart.model');

// Get my cart (auth or guest by sessionId header)
router.get('/me', optionalAuth, asyncHandler(async (req, res) => {
  const query = req.user ? { userId: req.user._id } : { sessionId: req.headers['x-session-id'] };
  if (!query.userId && !query.sessionId) return ApiResponse.success(res, null);
  const cart = await Cart.findOne(query);
  return ApiResponse.success(res, cart);
}));

// Add/update item
router.post('/items', optionalAuth, asyncHandler(async (req, res) => {
  const { productId, variantSku, qty, price } = req.body;
  if (!productId || !variantSku || !qty || price == null) throw new ApiError(400, 'productId, variantSku, qty, price required');
  const query = req.user ? { userId: req.user._id } : { sessionId: req.headers['x-session-id'] };
  if (!query.userId && !query.sessionId) throw new ApiError(400, 'x-session-id header required for guest');
  let cart = await Cart.findOne(query);
  if (!cart) cart = await Cart.create({ ...query, items: [] });
  const idx = cart.items.findIndex((i) => String(i.productId) === String(productId) && i.variantSku === variantSku);
  if (idx >= 0) cart.items[idx].qty = qty;
  else cart.items.push({ productId, variantSku, qty, price });
  await cart.save();
  return ApiResponse.success(res, cart, 'Cart updated');
}));

router.delete('/items/:productId/:variantSku', optionalAuth, asyncHandler(async (req, res) => {
  const query = req.user ? { userId: req.user._id } : { sessionId: req.headers['x-session-id'] };
  const cart = await Cart.findOne(query);
  if (!cart) throw new ApiError(404, 'Cart not found');
  cart.items = cart.items.filter((i) => !(String(i.productId) === req.params.productId && i.variantSku === req.params.variantSku));
  await cart.save();
  return ApiResponse.success(res, cart, 'Item removed');
}));

router.delete('/me', optionalAuth, asyncHandler(async (req, res) => {
  const query = req.user ? { userId: req.user._id } : { sessionId: req.headers['x-session-id'] };
  await Cart.deleteOne(query);
  return ApiResponse.success(res, null, 'Cart cleared');
}));

module.exports = router;
