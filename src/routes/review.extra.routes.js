'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const Review = require('../models/Review.model');

// Create review (authenticated buyer)
router.post('/', protect, asyncHandler(async (req, res) => {
  const { productId, rating, title, body, images, orderId } = req.body;
  if (!productId || !rating) throw new ApiError(400, 'productId and rating required');
  const review = await Review.create({ productId, rating, title, body, images, orderId, userId: req.user._id });
  return ApiResponse.created(res, review, 'Review submitted');
}));

// Approve / reject (admin)
router.patch('/:id/moderate', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const { isApproved } = req.body;
  const r = await Review.findByIdAndUpdate(req.params.id, { isApproved: !!isApproved }, { new: true });
  if (!r) throw new ApiError(404, 'Review not found');
  await r.save(); // trigger post-save aggregation
  return ApiResponse.success(res, r);
}));

module.exports = router;
