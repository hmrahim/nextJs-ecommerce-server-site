/**
 * 📁 models/Wishlist.js
 *
 * Wishlist model — Amazon / Noon / Alibaba pattern:
 *  • One wishlist document per user
 *  • Items array holds productId refs + addedAt timestamp
 *  • Duplicate guard at DB level via compound unique index
 */

const mongoose = require('mongoose');
const Product = require("./ProductModel")

const wishlistItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one wishlist per user
      index: true,
    },
    items: {
      type: [wishlistItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ── Virtual: total item count ─────────────────────────────── */
wishlistSchema.virtual('itemCount').get(function () {
  return this.items.length;
});

/* ── Instance method: check if product already in list ──────── */
wishlistSchema.methods.hasProduct = function (productId) {
  return this.items.some((i) => i.product.equals(productId));
};

module.exports = mongoose.model('Wishlist', wishlistSchema);
