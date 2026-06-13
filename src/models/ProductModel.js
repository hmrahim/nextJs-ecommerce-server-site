'use strict';

const mongoose = require('mongoose');
const slugify  = require('slugify');


/* ── Embedded sub-schemas ────────────────────────────────── */
const imageSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true },
    publicId: { type: String, default: null },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    sku:   { type: String, required: true },
    attrs: { type: Map, of: String },
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

const dimensionSchema = new mongoose.Schema(
  {
    length: { type: Number, default: null },
    width:  { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false }
);

const discountSchema = new mongoose.Schema(
  {
    minQty:   { type: Number, required: true, min: 1 },
    discount: { type: Number, required: true, min: 0 },
    type:     { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  },
  { _id: false }
);

/* ── Main schema ─────────────────────────────────────────── */
const productSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 200 },
    slug:        { type: String, unique: true, lowercase: true },
    sku:         { type: String, required: true, unique: true, uppercase: true, trim: true },

    description:      { type: String, trim: true, default: '' },
    shortDescription: { type: String, trim: true, default: '' },

    images:     { type: [imageSchema], default: [] },

    variants:   { type: [variantSchema], default: [] },
    attributes: { type: [attributeSchema], default: [] },

    category:       { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subSubCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null },

    price:        { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, min: 0, default: null },
    cost:         { type: Number, min: 0, default: null },

    stock:          { type: Number, default: 0, min: 0 },
    trackInventory: { type: Boolean, default: true },

    status:   { type: String, enum: ['active', 'draft', 'archived'], default: 'draft' },
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    tags:        { type: [String], default: [] },
    avgRating:   { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },

    weight:     { type: Number, min: 0, default: null },
    dimensions: { type: dimensionSchema, default: () => ({}) },

    discounts: { type: [discountSchema], default: [] },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
productSchema.index({ slug: 1 },         { unique: true });
productSchema.index({ sku: 1 },          { unique: true });
productSchema.index({ category: 1 });
productSchema.index({ subCategory: 1 });
productSchema.index({ subSubCategory: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ status: 1 });
productSchema.index({ isActive: 1, featured: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

/* ── Pre-save: auto-generate slug ───────────────────────── */
productSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

/* ── Virtual: effectivePrice ─────────────────────────────── */
productSchema.virtual('effectivePrice').get(function () {
  return (this.comparePrice !== null && this.comparePrice < this.price)
    ? this.comparePrice
    : this.price;
});

/* ── Virtual: inStock ────────────────────────────────────── */
productSchema.virtual('inStock').get(function () {
  return !this.trackInventory || this.stock > 0;
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;