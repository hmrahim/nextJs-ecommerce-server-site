'use strict';
// 📁 PATH: src/models/Attribute.model.js

const mongoose = require('mongoose');
const slugify  = require('slugify');

/* ── Value sub-schema ─────────────────────────────────────────────────────── */
const attributeValueSchema = new mongoose.Schema(
  {
    label:     { type: String, required: true, trim: true },   // "Red", "XL"
    slug:      { type: String, trim: true },                   // "red", "xl"
    valueData: { type: String, default: '' },                  // hex for color, etc.
    sortOrder: { type: Number, default: 0 },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

// value save এর আগে slug auto-generate
attributeValueSchema.pre('save', function (next) {
  if (!this.slug && this.label) {
    this.slug = slugify(this.label, { lower: true, strict: true });
  }
  next();
});

/* ── Attribute schema ─────────────────────────────────────────────────────── */
const attributeSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Attribute name is required'],
      trim:     true,
    },
    slug: {
      type:   String,
      unique: true,
      trim:   true,
      index:  true,
    },
    type: {
      type:    String,
      enum:    ['select', 'multiselect', 'color', 'boolean', 'text', 'number'],
      default: 'select',
    },
    isFilterable:    { type: Boolean, default: false },
    isVariant:       { type: Boolean, default: true  },
    isActive:        { type: Boolean, default: true  },
    sortOrder:       { type: Number,  default: 0     },
    usedInProducts:  { type: Number,  default: 0     },  // denormalized counter
    values:          { type: [attributeValueSchema], default: [] },
  },
  { timestamps: true }
);

// slug auto-generate
attributeSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Attribute', attributeSchema);