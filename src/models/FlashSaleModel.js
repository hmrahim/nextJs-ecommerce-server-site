// 📁 PATH: src/models/FlashSaleModel.js
// Mongoose model for Flash Sales — production ready (Noon/Amazon/Daraz style)
'use strict';

const mongoose = require('mongoose');
const slugify  = require('slugify');

/* ── Embedded: Flash Sale Product ─────────────────────────── */
const flashSaleProductSchema = new mongoose.Schema(
  {
    product:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name:          { type: String, required: true, trim: true },
    image:         { type: String, default: null },
    sku:           { type: String, default: '' },
    originalPrice: { type: Number, required: true, min: 0 },
    salePrice:     { type: Number, required: true, min: 0 },
    stock:         { type: Number, required: true, min: 0 },
    sold:          { type: Number, default: 0, min: 0 },
    maxPerUser:    { type: Number, default: null, min: 1 },
    sortOrder:     { type: Number, default: 0 },
  },
  { _id: true, timestamps: false }
);

/* ── Main Schema ──────────────────────────────────────────── */
const flashSaleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Flash sale name is required'],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, trim: true, default: '' },

    // Discount config
    discountType: {
      type: String,
      enum: ['percent', 'fixed'],
      required: true,
      default: 'percent',
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount cannot be negative'],
      validate: {
        validator: function (v) {
          if (this.discountType === 'percent') return v > 0 && v <= 100;
          return v > 0;
        },
        message: 'Invalid discount value for the selected type',
      },
    },

    // Application type — determines if offer applies to all products or specific ones
    applicationType: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all',
      required: true,
    },

    // Timeline
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      index: true,
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
      index: true,
      validate: {
        validator: function (v) {
          // On document.save() — `this` is the document
          if (this instanceof mongoose.Document) {
            if (!this.startTime) return true;
            return new Date(v) > new Date(this.startTime);
          }
          // On findOneAndUpdate / updateOne with runValidators — `this` is the query.
          // If startTime is also being updated, ensure end > start; otherwise skip
          // (cross-field check is done in the express-validator layer).
          const update = (typeof this.getUpdate === 'function' ? this.getUpdate() : null) || {};
          const start = update.$set?.startTime ?? update.startTime;
          if (!start) return true;
          return new Date(v) > new Date(start);
        },
        message: 'End time must be after start time',
      },
    },

    // Stock & limits
    totalStock:       { type: Number, required: true, min: 0 },
    soldCount:        { type: Number, default: 0, min: 0 },
    maxOrdersPerUser: { type: Number, default: 1, min: 1 },

    // Revenue tracking
    revenue:     { type: Number, default: 0, min: 0 },
    orderCount:  { type: Number, default: 0, min: 0 },

    // Visual
    banner:      { type: String, default: null },
    bannerMobile:{ type: String, default: null },
    priority:    { type: Number, default: 0 },  // for sorting on storefront

    // Products
    products: { type: [flashSaleProductSchema], default: [] },

    // State
    isActive: { type: Boolean, default: true, index: true },

    // Metadata
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Per-user purchase tracking (for maxOrdersPerUser enforcement)
    userPurchases: [
      {
        user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 0 },
        _id: false,
      },
    ],
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ── Indexes ──────────────────────────────────────────────── */
flashSaleSchema.index({ slug: 1 }, { unique: true });
flashSaleSchema.index({ isActive: 1, startTime: 1, endTime: 1 });
flashSaleSchema.index({ startTime: 1 });
flashSaleSchema.index({ endTime: 1 });
flashSaleSchema.index({ priority: -1, startTime: 1 });
flashSaleSchema.index({ createdAt: -1 });
flashSaleSchema.index({ 'products.product': 1 });
flashSaleSchema.index({ applicationType: 1 });

/* ── Virtual: computed status ─────────────────────────────── */
flashSaleSchema.virtual('status').get(function () {
  const now = new Date();
  if (!this.isActive) return 'draft';
  if (now < this.startTime) return 'upcoming';
  if (now > this.endTime) return 'ended';
  // Check if sold out
  if (this.totalStock > 0 && this.soldCount >= this.totalStock) return 'sold_out';
  return 'active';
});

/* ── Virtual: progress percentage ─────────────────────────── */
flashSaleSchema.virtual('progress').get(function () {
  if (this.totalStock <= 0) return 0;
  return Math.min(100, Math.round((this.soldCount / this.totalStock) * 100));
});

/* ── Virtual: time remaining (ms) ─────────────────────────── */
flashSaleSchema.virtual('timeRemaining').get(function () {
  const now = new Date();
  if (now > this.endTime) return 0;
  if (now < this.startTime) return this.startTime - now;
  return this.endTime - now;
});

/* ── Pre-save: auto-generate slug if missing ──────────────── */
flashSaleSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true }) + '-' + Date.now().toString(36);
  }
  next();
});

/* ── Pre findOneAndUpdate: regenerate slug from name when empty ── */
flashSaleSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;
  if ($set && $set.name && (!$set.slug || $set.slug === '')) {
    $set.slug = slugify($set.name, { lower: true, strict: true }) + '-' + Date.now().toString(36);
    if (update.$set) update.$set = $set; else this.setUpdate($set);
  }
  next();
});

/* ── Instance: check if user can purchase ─────────────────── */
flashSaleSchema.methods.canUserPurchase = function (userId) {
  if (!userId) return { ok: false, reason: 'Authentication required' };

  const now = new Date();
  if (!this.isActive) return { ok: false, reason: 'Flash sale is not active' };
  if (now < this.startTime) return { ok: false, reason: 'Flash sale has not started yet' };
  if (now > this.endTime) return { ok: false, reason: 'Flash sale has ended' };
  if (this.totalStock > 0 && this.soldCount >= this.totalStock) {
    return { ok: false, reason: 'Flash sale is sold out' };
  }

  // Per-user limit check
  if (this.maxOrdersPerUser) {
    const userEntry = this.userPurchases.find(
      (up) => String(up.user) === String(userId)
    );
    if (userEntry && userEntry.count >= this.maxOrdersPerUser) {
      return { ok: false, reason: 'You have reached the maximum purchase limit for this sale' };
    }
  }

  return { ok: true };
};

/* ── Instance: record a purchase ──────────────────────────── */
flashSaleSchema.methods.recordPurchase = function (userId, quantity = 1, amount = 0) {
  this.soldCount += quantity;
  this.orderCount += 1;
  this.revenue += amount;

  // Update per-user tracking
  const userEntry = this.userPurchases.find(
    (up) => String(up.user) === String(userId)
  );
  if (userEntry) {
    userEntry.count += 1;
  } else {
    this.userPurchases.push({ user: userId, count: 1 });
  }

  return this;
};

/* ── Static: find currently active sales ──────────────────── */
flashSaleSchema.statics.findActive = function () {
  const now = new Date();
  return this.find({
    isActive: true,
    startTime: { $lte: now },
    endTime: { $gt: now },
  })
    .sort({ priority: -1, startTime: 1 })
    .lean({ virtuals: true });
};

/* ── Static: find upcoming sales ──────────────────────────── */
flashSaleSchema.statics.findUpcoming = function () {
  const now = new Date();
  return this.find({
    isActive: true,
    startTime: { $gt: now },
  })
    .sort({ startTime: 1 })
    .lean({ virtuals: true });
};

/* ── Static: get effective flash-sale price for a product ───
   Returns { salePrice, originalPrice, saleId, discountType, discountValue }
   or null when no active flash sale applies to this product. */
flashSaleSchema.statics.getEffectivePriceForProduct = async function (productId, originalPrice) {
  if (!productId) return null;
  const now = new Date();
  const sale = await this.findOne({
    isActive: true,
    startTime: { $lte: now },
    endTime:   { $gt: now },
    $or: [
      { applicationType: 'all' },
      { 'products.product': productId },
    ],
  })
    .sort({ priority: -1, startTime: 1 })
    .lean();

  if (!sale) return null;

  let salePrice;
  let op = Number(originalPrice) || 0;

  if (sale.applicationType === 'specific') {
    const embedded = (sale.products || []).find(
      (p) => String(p.product) === String(productId)
    );
    if (!embedded) return null;
    op = embedded.originalPrice ?? op;
    salePrice = embedded.salePrice;
  } else {
    // 'all' — compute from sale-wide discount config
    if (sale.discountType === 'percent') {
      salePrice = Math.max(0, Math.round(op * (1 - (sale.discountValue || 0) / 100)));
    } else {
      salePrice = Math.max(0, Math.round(op - (sale.discountValue || 0)));
    }
  }

  if (salePrice == null || salePrice >= op) return null;

  return {
    salePrice,
    originalPrice: op,
    saleId: sale._id,
    saleSlug: sale.slug,
    discountType: sale.discountType,
    discountValue: sale.discountValue,
    endTime: sale.endTime,
  };
};

const FlashSale = mongoose.models.FlashSale || mongoose.model('FlashSale', flashSaleSchema);
module.exports = FlashSale;
