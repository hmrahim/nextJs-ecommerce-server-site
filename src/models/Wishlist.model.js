'use strict';

const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    addedAt:   { type: Date, default: Date.now },
  },
  { _id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:     { type: String, default: 'My Wishlist', trim: true, maxlength: 100 },
    isPublic: { type: Boolean, default: false },
    items:    { type: [wishlistItemSchema], default: [] },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
wishlistSchema.index({ userId: 1 });
wishlistSchema.index({ userId: 1, isPublic: 1 });

/* ── Virtual: itemCount ──────────────────────────────────── */
wishlistSchema.virtual('itemCount').get(function () {
  return this.items.length;
});

const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);
module.exports = Wishlist;
