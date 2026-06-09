'use strict';

const mongoose = require('mongoose');
const slugify  = require('slugify');

/* ── Embedded sub-schemas ────────────────────────────────── */
const imageSchema = new mongoose.Schema(
  {
    url:    { type: String, required: true },
    alt:    { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    sku:   { type: String, required: true },
    attrs: { type: Map, of: String }, // e.g. { color: 'Red', size: 'M' }
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const attributeSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

/* ── Main schema ─────────────────────────────────────────── */
const productSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true, maxlength: 200 },
    slug:       { type: String, unique: true, lowercase: true },
    sku:        { type: String, required: true, unique: true, uppercase: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brandId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
    description:{ type: String, trim: true },
    basePrice:  { type: Number, required: true, min: 0 },
    salePrice:  { type: Number, min: 0, default: null },
    images:     { type: [imageSchema], default: [] },
    variants:   { type: [variantSchema], default: [] },
    attributes: { type: [attributeSchema], default: [] },
    tags:       { type: [String], default: [] },
    avgRating:  { type: Number, default: 0, min: 0, max: 5 },
    reviewCount:{ type: Number, default: 0, min: 0 },
    isActive:   { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ categoryId: 1 });
productSchema.index({ brandId: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' }); // full-text search

/* ── Pre-save: auto-generate slug ───────────────────────── */
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

/* ── Virtual: effectivePrice ─────────────────────────────── */
productSchema.virtual('effectivePrice').get(function () {
  return this.salePrice !== null && this.salePrice < this.basePrice
    ? this.salePrice
    : this.basePrice;
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
