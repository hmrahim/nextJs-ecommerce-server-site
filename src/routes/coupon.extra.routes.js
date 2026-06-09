'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const { protect } = require('../middleware/auth.middleware');
const Coupon = require('../models/Coupon.model');

router.post('/validate', protect, asyncHandler(async (req, res) => {
  const { code, orderAmount } = req.body;
  if (!code || orderAmount == null) throw new ApiError(400, 'code and orderAmount required');
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase() });
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  const result = coupon.isValid(orderAmount, req.user._id);
  if (!result.valid) throw new ApiError(400, result.reason);
  const discount = coupon.calcDiscount(orderAmount);
  return ApiResponse.success(res, { code: coupon.code, type: coupon.type, value: coupon.value, discount });
}));

module.exports = router;
