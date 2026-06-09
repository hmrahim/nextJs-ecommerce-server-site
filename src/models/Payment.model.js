'use strict';

const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    amount:    { type: Number, required: true, min: 0 },
    reason:    { type: String, default: '' },
    refundedAt:{ type: Date, default: Date.now },
    gatewayRefundId: { type: String },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    orderId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gateway:         { type: String, enum: ['stripe', 'paypal', 'cod', 'bank_transfer', 'other'], required: true },
    transactionId:   { type: String, unique: true, sparse: true },
    amount:          { type: Number, required: true, min: 0 },
    currency:        { type: String, default: 'USD', uppercase: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    paymentMethod:   { type: String },          // card, wallet, bank, etc.
    gatewayResponse: { type: mongoose.Schema.Types.Mixed }, // raw gateway payload
    refunds:         { type: [refundSchema], default: [] },
    paidAt:          { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ status: 1 });

/* ── Virtual: totalRefunded ──────────────────────────────── */
paymentSchema.virtual('totalRefunded').get(function () {
  return this.refunds.reduce((sum, r) => sum + r.amount, 0);
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
