// 📁 PATH: src/models/Bundle.model.js
'use strict';

const mongoose = require('mongoose');
const slugify  = require('slugify');

/* ── Embedded sub-schema: products inside a bundle ──────────── */
const bundleProductSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name:      { type: String, required: true },   // snapshot at time of add
    sku:       { type: String, default: '' },       // snapshot
    price:     { type: Number, required: true, min: 0 }, // snapshot unit price
    quantity:  { type: Number, default: 1, min: 1 },
    image:     { type: String, default: '' },       // product image URL snapshot
  },
  { _id: false }
);

const bundleSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 200 },
    slug:        { type: String, unique: true, lowercase: true },
    description: { type: String, trim: true, default: '' },
    sku:         { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    image:       { type: String, default: '' },

    products: {
      type: [bundleProductSchema],
      validate: {
        validator: (v) => v && v.length >= 2,
        message: 'A bundle must contain at least 2 products.',
      },
    },

    bundlePrice:  { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, default: null, min: 0 },

    stock: { type: Number, default: null, min: 0 }, // null = unlimited
    sold:  { type: Number, default: 0, min: 0 },

    isActive:   { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    validFrom:  { type: Date, default: null },
    validUntil: { type: Date, default: null },

    tags: { type: [String], default: [] },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
bundleSchema.index({ slug: 1 }, { unique: true });
bundleSchema.index({ isActive: 1, isFeatured: 1 });
bundleSchema.index({ validUntil: 1 });
bundleSchema.index({ name: 'text', description: 'text', tags: 'text' });

/* ── Virtual: originalPrice (sum of product line totals) ───── */
bundleSchema.virtual('originalPrice').get(function () {
  return (this.products || []).reduce((sum, p) => sum + p.price * p.quantity, 0);
});

/* ── Virtual: status (active | inactive | expired) ──────────── */
bundleSchema.virtual('status').get(function () {
  if (!this.isActive) return 'inactive';
  if (this.validUntil && new Date(this.validUntil) < new Date()) return 'expired';
  return 'active';
});

/* ── Pre-save: auto slug + auto sku ─────────────────────────── */
bundleSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true }) + '-' + Date.now().toString(36);
  }
  if (!this.sku) {
    this.sku = 'BNDL-' + Date.now().toString(36).toUpperCase();
  }
  next();
});

bundleSchema.set('toJSON', { virtuals: true });
bundleSchema.set('toObject', { virtuals: true });

const Bundle = mongoose.models.Bundle || mongoose.model('Bundle', bundleSchema);
module.exports = Bundle;