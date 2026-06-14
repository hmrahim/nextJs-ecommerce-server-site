// 📁 PATH: backend/models/Coupon.js
// Mongoose model for Coupons — production ready

const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 20,
      match: [/^[A-Z0-9_-]+$/, 'Code may only contain letters, numbers, - and _'],
      index: true,
    },
    description: { type: String, trim: true, maxlength: 300, default: '' },

    type: {
      type: String,
      enum: ['percent', 'fixed', 'shipping'],
      required: true,
      default: 'percent',
    },
    value: {
      type: Number,
      required: true,
      min: [0, 'Value cannot be negative'],
      validate: {
        validator: function (v) {
          if (this.type === 'percent') return v > 0 && v <= 100;
          return v >= 0;
        },
        message: 'Invalid discount value for the selected type',
      },
    },

    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 }, // cap for percent type

    maxUses: { type: Number, default: null, min: 1 },           // null = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    maxUsesPerUser: { type: Number, default: 1, min: 1 },

    applicableTo: {
      type: String,
      enum: ['all', 'category', 'product', 'brand'],
      default: 'all',
    },
    applicableIds: [{ type: mongoose.Schema.Types.ObjectId }],

    startDate: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },

    isActive: { type: Boolean, default: true, index: true },

    // Per-user redemption tracking
    redemptions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        amount: Number,
        at: { type: Date, default: Date.now },
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Virtual: computed status
couponSchema.virtual('status').get(function () {
  if (!this.isActive) return 'inactive';
  if (this.expiresAt && this.expiresAt < new Date()) return 'expired';
  if (this.maxUses && this.usedCount >= this.maxUses) return 'exhausted';
  if (this.startDate && this.startDate > new Date()) return 'scheduled';
  return 'active';
});

couponSchema.set('toJSON', { virtuals: true });
couponSchema.set('toObject', { virtuals: true });

// Instance: how much discount this coupon yields for a given order amount
couponSchema.methods.calculateDiscount = function (orderAmount) {
  if (this.type === 'percent') {
    let d = (orderAmount * this.value) / 100;
    if (this.maxDiscountAmount) d = Math.min(d, this.maxDiscountAmount);
    return Math.round(d * 100) / 100;
  }
  if (this.type === 'fixed') return Math.min(this.value, orderAmount);
  if (this.type === 'shipping') return 0; // shipping handled separately
  return 0;
};

// Instance: validity check
couponSchema.methods.isUsable = function (userId = null) {
  const now = new Date();
  if (!this.isActive) return { ok: false, reason: 'Coupon is inactive' };
  if (this.startDate && this.startDate > now) return { ok: false, reason: 'Coupon not yet active' };
  if (this.expiresAt && this.expiresAt < now) return { ok: false, reason: 'Coupon expired' };
  if (this.maxUses && this.usedCount >= this.maxUses) return { ok: false, reason: 'Coupon usage limit reached' };
  if (userId && this.maxUsesPerUser) {
    const userUses = this.redemptions.filter(r => String(r.user) === String(userId)).length;
    if (userUses >= this.maxUsesPerUser) {
      return { ok: false, reason: 'You have already used this coupon the maximum number of times' };
    }
  }
  return { ok: true };
};

// Static: generate a random unique coupon code
couponSchema.statics.generateUniqueCode = async function (length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let exists = true;

  while (exists) {
    code = Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
    exists = await this.findOne({ code });
  }

  return code;
};

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, expiresAt: 1 });
couponSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);