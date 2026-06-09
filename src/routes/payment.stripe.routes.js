'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const { protect } = require('../middleware/auth.middleware');
const Order   = require('../models/Order.model');
const Payment = require('../models/Payment.model');
const Transaction = require('../models/Transaction.model');

function getStripe(){
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ApiError(503, 'Stripe is not configured');
  return require('stripe')(key);
}

// Create payment intent for an order
router.post('/create-payment-intent', protect, asyncHandler(async (req, res) => {
  const stripe = getStripe();
  const { orderId } = req.body;
  if (!orderId) throw new ApiError(400, 'orderId required');
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (String(order.userId) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }
  const amountCents = Math.round(order.totalAmount * 100);
  const pi = await stripe.paymentIntents.create({
    amount:   amountCents,
    currency: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: String(order._id), userId: String(order.userId) },
  });
  return ApiResponse.success(res, { clientSecret: pi.client_secret, paymentIntentId: pi.id });
}));

// Refund (admin)
router.post('/refund/:paymentIntentId', protect, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin only');
  const stripe = getStripe();
  const refund = await stripe.refunds.create({ payment_intent: req.params.paymentIntentId, amount: req.body.amount ? Math.round(req.body.amount * 100) : undefined });
  return ApiResponse.success(res, refund, 'Refund created');
}));

module.exports = router;
