'use strict';

const mongoose = require('mongoose');
const slugify  = require('slugify');

const brandSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    slug:     { type: String, unique: true, lowercase: true },
    logoUrl:  { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
brandSchema.index({ slug: 1 }, { unique: true });
brandSchema.index({ isActive: 1 });

/* ── Pre-save: auto-generate slug ───────────────────────── */
brandSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

const Brand = mongoose.model('Brand', brandSchema);
module.exports = Brand;
