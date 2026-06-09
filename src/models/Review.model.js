'use strict';

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    title:     { type: String, trim: true, maxlength: 150 },
    body:      { type: String, trim: true, maxlength: 2000 },
    images:    { type: [String], default: [] },
    isVerified:{ type: Boolean, default: false }, // verified purchase
    isApproved:{ type: Boolean, default: false }, // moderation flag
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
reviewSchema.index({ productId: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true }); // one review per product per user
reviewSchema.index({ productId: 1, isApproved: 1, rating: -1 });

/* ── Post-save: update product avgRating ─────────────────── */
reviewSchema.post('save', async function () {
  const Product = mongoose.model('Product');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { productId: this.productId, isApproved: true } },
    { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (stats.length > 0) {
    await Product.findByIdAndUpdate(this.productId, {
      avgRating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].count,
    });
  }
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
