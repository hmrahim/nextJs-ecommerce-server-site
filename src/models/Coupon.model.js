'use strict';

const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code:         { type: String, required: true, unique: true, uppercase: true, trim: true },
    type:         { type: String, enum: ['percent', 'fixed'], required: true },
    value:        { type: Number, required: true, min: 0 },
    minOrderAmt:  { type: Number, default: 0, min: 0 },
    maxUses:      { type: Number, default: null },  // null = unlimited
    usedCount:    { type: Number, default: 0, min: 0 },
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = public
    isActive:     { type: Boolean, default: true },
    expiresAt:    { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ userId: 1 });
couponSchema.index({ isActive: 1, expiresAt: 1 });

/* ── Virtual: isExpired ──────────────────────────────────── */
couponSchema.virtual('isExpired').get(function () {
  return this.expiresAt ? this.expiresAt < new Date() : false;
});

/* ── Virtual: isExhausted ────────────────────────────────── */
couponSchema.virtual('isExhausted').get(function () {
  return this.maxUses !== null && this.usedCount >= this.maxUses;
});

/* ── Instance: isValid ───────────────────────────────────── */
couponSchema.methods.isValid = function (orderAmount, userId = null) {
  if (!this.isActive)       return { valid: false, reason: 'Coupon is inactive' };
  if (this.isExpired)       return { valid: false, reason: 'Coupon has expired' };
  if (this.isExhausted)     return { valid: false, reason: 'Coupon usage limit reached' };
  if (orderAmount < this.minOrderAmt)
    return { valid: false, reason: `Minimum order amount is ${this.minOrderAmt}` };
  if (this.userId && String(this.userId) !== String(userId))
    return { valid: false, reason: 'Coupon is not valid for this user' };
  return { valid: true };
};

/* ── Instance: calcDiscount ──────────────────────────────── */
couponSchema.methods.calcDiscount = function (orderAmount) {
  if (this.type === 'percent') {
    return Math.min((this.value / 100) * orderAmount, orderAmount);
  }
  return Math.min(this.value, orderAmount);
};

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
