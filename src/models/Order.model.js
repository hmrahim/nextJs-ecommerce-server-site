'use strict';

const mongoose = require('mongoose');

/* ── Embedded sub-schemas ────────────────────────────────── */
const orderItemSchema = new mongoose.Schema(
  {
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, required: true },
    name:       { type: String, required: true },
    qty:        { type: Number, required: true, min: 1 },
    price:      { type: Number, required: true, min: 0 }, // unit price snapshot
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status:    { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    note:      { type: String, default: '' },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    street:  { type: String, required: true },
    city:    { type: String, required: true },
    state:   { type: String },
    country: { type: String, required: true },
    zipCode: { type: String },
  },
  { _id: false }
);

/* ── Main schema ─────────────────────────────────────────── */
const orderSchema = new mongoose.Schema(
  {
    orderNumber:    { type: String, unique: true }, // auto-generated
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    shippingAddr:   { type: shippingAddressSchema, required: true },
    items:          { type: [orderItemSchema], required: true },
    couponId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    subtotal:       { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount:      { type: Number, default: 0, min: 0 },
    shippingAmount: { type: Number, default: 0, min: 0 },
    totalAmount:    { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'partially_refunded', 'refunded', 'failed'],
      default: 'unpaid',
    },
    statusHistory:  { type: [statusHistorySchema], default: [] },
    placedAt:       { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ placedAt: -1 });
orderSchema.index({ userId: 1, status: 1 });

/* ── Pre-save: generate order number ────────────────────── */
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const ts   = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `ORD-${ts}-${rand}`;
  }
  // Push status history on status change
  if (this.isModified('status')) {
    this.statusHistory.push({ status: this.status, changedAt: new Date() });
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
