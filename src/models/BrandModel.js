// 📁 PATH: src/models/Brand.js
'use strict';

const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Brand name is required'],
      trim:      true,
      unique:    true,
      maxlength: [100, 'Brand name cannot exceed 100 characters'],
    },

    slug: {
      type:      String,
      unique:    true,
      lowercase: true,
      trim:      true,
    },

    description: {
      type:    String,
      trim:    true,
      default: '',
    },

    logo: {
      url:      { type: String, default: '' },
      publicId: { type: String, default: '' }, // Cloudinary public_id (optional)
    },

    country: {
      type:    String,
      trim:    true,
      default: '',
    },

    website: {
      type:    String,
      trim:    true,
      default: '',
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    isFeatured: {
      type:    Boolean,
      default: false,
    },

    // Virtual-এর পরিবর্তে denormalized count রাখলে stats fast হয়
    productCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // SEO
    metaTitle:       { type: String, trim: true, default: '' },
    metaDescription: { type: String, trim: true, default: '' },

    // Sort order for manual reorder (adminReorder endpoint)
    sortOrder: {
      type:    Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
brandSchema.index({ slug:       1 });
brandSchema.index({ isActive:   1 });
brandSchema.index({ isFeatured: 1 });
brandSchema.index({ sortOrder:  1 });
brandSchema.index({ name: 'text', country: 'text' }); // full-text search fallback

// ─── Pre-save: slug auto-generate ────────────────────────────────────────────
brandSchema.pre('save', function (next) {
  if (!this.slug || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

const Brand = mongoose.models.Brand || mongoose.model('Brand', brandSchema);

module.exports = Brand;