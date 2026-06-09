'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const Order   = require('../models/Order.model');
const { emit } = require('../sockets');

// Place a new order (authenticated buyer)
router.post('/checkout', protect, asyncHandler(async (req, res) => {
  const { shippingAddr, items, couponId, taxAmount = 0, shippingAmount = 0 } = req.body;
  if (!shippingAddr || !Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'shippingAddr and items required');
  }
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmount = 0; // coupon engine could compute this
  const totalAmount = Math.max(subtotal - discountAmount + taxAmount + shippingAmount, 0);
  const order = await Order.create({
    userId: req.user._id,
    shippingAddr,
    items,
    couponId,
    subtotal,
    discountAmount,
    taxAmount,
    shippingAmount,
    totalAmount,
  });
  emit.toUser(req.user._id, 'order:created', { orderId: order._id, orderNumber: order.orderNumber });
  emit.toAdmins('order:created', { orderId: order._id, orderNumber: order.orderNumber });
  return ApiResponse.created(res, order, 'Order placed');
}));

// My orders
router.get('/me', protect, asyncHandler(async (req, res) => {
  const data = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  return ApiResponse.success(res, data);
}));

// Update order status (admin)
router.patch('/:id/status', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  order.status = status;
  if (note) order.statusHistory.push({ status, note, changedAt: new Date() });
  await order.save();
  emit.toUser(order.userId, 'order:status', { orderId: order._id, status });
  emit.toOrder(order._id, 'order:status', { orderId: order._id, status });
  return ApiResponse.success(res, order, 'Status updated');
}));

// Cancel order (buyer)
router.post('/:id/cancel', protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (String(order.userId) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }
  if (['delivered','cancelled','refunded'].includes(order.status)) {
    throw new ApiError(409, `Order cannot be cancelled from ${order.status}`);
  }
  order.status = 'cancelled';
  await order.save();
  emit.toAdmins('order:cancelled', { orderId: order._id });
  return ApiResponse.success(res, order, 'Order cancelled');
}));

module.exports = router;
