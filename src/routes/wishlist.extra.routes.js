'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiHelpers');
const { protect } = require('../middleware/auth.middleware');
const Wishlist = require('../models/Wishlist.model');

router.get('/me', protect, asyncHandler(async (req, res) => {
  const w = await Wishlist.findOne({ userId: req.user._id }).populate('items.productId');
  return ApiResponse.success(res, w);
}));

router.post('/toggle', protect, asyncHandler(async (req, res) => {
  const { productId } = req.body;
  let w = await Wishlist.findOne({ userId: req.user._id });
  if (!w) {
    w = await Wishlist.create({ userId: req.user._id, items: [{ productId }] });
  } else {
    const idx = w.items.findIndex((i) => String(i.productId) === String(productId));
    if (idx >= 0) w.items.splice(idx, 1);
    else w.items.push({ productId });
    await w.save();
  }
  return ApiResponse.success(res, w);
}));

module.exports = router;
