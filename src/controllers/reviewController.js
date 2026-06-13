
const mongoose = require('mongoose');
const Review = require('../models/ReviewModel');
const Product = require('../models/ProductModel');

/* ── Helpers ──────────────────────────────────────────────────────────── */
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Product-এর avgRating ও reviewCount live recalculate করে update করে */
async function syncProductRating(productId) {
  const [stat] = await Review.aggregate([
    { $match: { productId: toObjectId(productId), isApproved: true } },
    {
      $group: {
        _id:         '$productId',
        avgRating:   { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  await Product.findByIdAndUpdate(productId, {
    avgRating:   stat ? Math.round(stat.avgRating * 10) / 10 : 0,
    reviewCount: stat ? stat.reviewCount : 0,
  });
}

/* ══════════════════════════════════════════════════════════════════════
   PUBLIC — GET /products/:productId/reviews
   Query params: page, limit, sort, rating (filter by exact star)
   Only isApproved: true reviews are returned to clients.
══════════════════════════════════════════════════════════════════════ */
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidId(productId))
      return res.status(400).json({ success: false, message: 'Invalid product ID' });

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    /* ── sort ── */
    const SORT_MAP = {
      newest:   { createdAt: -1 },
      oldest:   { createdAt:  1 },
      highest:  { rating: -1, createdAt: -1 },
      lowest:   { rating:  1, createdAt: -1 },
      helpful:  { helpfulCount: -1, createdAt: -1 }, // future-proof
    };
    const sort = SORT_MAP[req.query.sort] ?? SORT_MAP.newest;

    /* ── match ── */
    const match = { productId: toObjectId(productId), isApproved: true };
    if (req.query.rating) {
      const r = parseInt(req.query.rating);
      if (r >= 1 && r <= 5) match.rating = r;
    }

    const [reviews, total, ratingAgg] = await Promise.all([
      Review.find(match)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName image')
        .lean(),

      Review.countDocuments(match),

      /* Star-distribution — always for the full product (all approved) */
      Review.aggregate([
        { $match: { productId: toObjectId(productId), isApproved: true } },
        {
          $group: {
            _id:         '$rating',
            count:       { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]),
    ]);

    /* Build 5→1 distribution map */
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingAgg.forEach(({ _id, count }) => { distribution[_id] = count; });
    const totalApproved = Object.values(distribution).reduce((a, b) => a + b, 0);
    const avg           = totalApproved
      ? Object.entries(distribution).reduce((s, [star, cnt]) => s + Number(star) * cnt, 0) / totalApproved
      : 0;

    res.json({
      success: true,
      total,
      page,
      pages:  Math.ceil(total / limit),
      limit,
      stats: {
        avgRating:    Math.round(avg * 10) / 10,
        totalReviews: totalApproved,
        distribution,
      },
      results: reviews.map((r) => ({
        ...r,
        user: {
          id:    r.userId?._id,
          name:  `${r.userId?.firstName ?? ''} ${r.userId?.lastName ?? ''}`.trim() || 'Anonymous',
          image: r.userId?.image ?? null,
        },
        userId: undefined, // hide raw ref from client
      })),
    });
  } catch (err) {
    console.error('[getProductReviews]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   PROTECTED — POST /products/:productId/reviews
   - Logged-in user (req.user._id set by auth middleware)
   - One review per user per product (unique index handles DB level)
   - Optionally links a verified order → isVerified: true
══════════════════════════════════════════════════════════════════════ */
exports.createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidId(productId))
      return res.status(400).json({ success: false, message: 'Invalid product ID' });

    /* product exists? */
    const product = await Product.findById(productId).lean();
    if (!product)
      return res.status(404).json({ success: false, message: 'Product not found' });

    /* already reviewed? */
    const exists = await Review.findOne({ productId, userId: req.user._id });
    if (exists)
      return res.status(409).json({ success: false, message: 'You have already reviewed this product' });

    const { rating, title, body, images, orderId } = req.body;

    /* rating validation */
    const ratingNum = parseInt(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5)
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });

    /* verify purchase — optional but sets isVerified flag */
    let isVerified = false;
    if (orderId && isValidId(orderId)) {
      const order = await Order.findOne({
        _id:    orderId,
        userId: req.user._id,
        status: 'delivered',
        'items.productId': toObjectId(productId),
      }).lean();
      if (order) isVerified = true;
    }

    const review = await Review.create({
      productId,
      userId:     req.user._id,
      orderId:    isVerified ? orderId : null,
      rating:     ratingNum,
      title:      title?.trim()  || undefined,
      body:       body?.trim()   || undefined,
      images:     Array.isArray(images) ? images.slice(0, 5) : [],
      isVerified,
      isApproved: false, // admin moderation required by default
    });

    // post-save hook on the model handles syncProductRating when isApproved changes
    // but we call it defensively here too (new review starts unapproved, so no-op for stats)

    res.status(201).json({
      success: true,
      message: 'Review submitted and pending moderation',
      data:    review,
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'You have already reviewed this product' });
    console.error('[createReview]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   PROTECTED — PUT /reviews/:reviewId
   Owner-only edit. Resets approval (admin must re-approve).
══════════════════════════════════════════════════════════════════════ */
exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!isValidId(reviewId))
      return res.status(400).json({ success: false, message: 'Invalid review ID' });

    const review = await Review.findById(reviewId);
    if (!review)
      return res.status(404).json({ success: false, message: 'Review not found' });

    if (String(review.userId) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });

    const { rating, title, body, images } = req.body;

    if (rating !== undefined) {
      const r = parseInt(rating);
      if (r < 1 || r > 5)
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      review.rating = r;
    }
    if (title   !== undefined) review.title  = title.trim();
    if (body    !== undefined) review.body   = body.trim();
    if (images  !== undefined) review.images = Array.isArray(images) ? images.slice(0, 5) : [];

    /* re-submit for moderation */
    review.isApproved = false;
    await review.save(); // post-save hook fires → syncProductRating

    res.json({ success: true, message: 'Review updated and pending re-moderation', data: review });
  } catch (err) {
    console.error('[updateReview]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   PROTECTED — DELETE /reviews/:reviewId
   Owner can delete their own review.
══════════════════════════════════════════════════════════════════════ */
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!isValidId(reviewId))
      return res.status(400).json({ success: false, message: 'Invalid review ID' });

    const review = await Review.findById(reviewId);
    if (!review)
      return res.status(404).json({ success: false, message: 'Review not found' });

    if (String(review.userId) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });

    const { productId } = review;
    await review.deleteOne();
    await syncProductRating(productId);

    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    console.error('[deleteReview]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ADMIN — GET /admin/reviews
   Full list with filters + pagination.
══════════════════════════════════════════════════════════════════════ */
exports.adminGetAll = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;

    const match = {};
    if (req.query.productId && isValidId(req.query.productId))
      match.productId = toObjectId(req.query.productId);
    if (req.query.userId && isValidId(req.query.userId))
      match.userId = toObjectId(req.query.userId);
    if (req.query.rating)
      match.rating = parseInt(req.query.rating);
    if (req.query.status === 'approved')  match.isApproved = true;
    if (req.query.status === 'pending')   match.isApproved = false;
    if (req.query.verified === 'true')    match.isVerified = true;

    const SORT_MAP = {
      newest:  { createdAt: -1 },
      oldest:  { createdAt:  1 },
      highest: { rating: -1 },
      lowest:  { rating:  1 },
    };
    const sort = SORT_MAP[req.query.sort] ?? SORT_MAP.newest;

    const [reviews, total] = await Promise.all([
      Review.find(match)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId',    'firstName lastName email image')
        .populate('productId', 'name slug images')
        .lean(),
      Review.countDocuments(match),
    ]);

    res.json({
      success: true,
      total,
      page,
      pages:  Math.ceil(total / limit),
      limit,
      results: reviews,
    });
  } catch (err) {
    console.error('[adminGetAll]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ADMIN — GET /admin/reviews/stats
══════════════════════════════════════════════════════════════════════ */
exports.adminGetStats = async (req, res) => {
  try {
    const [totals, ratingDist] = await Promise.all([
      Review.aggregate([
        {
          $group: {
            _id:      null,
            total:    { $sum: 1 },
            approved: { $sum: { $cond: ['$isApproved', 1, 0] } },
            pending:  { $sum: { $cond: ['$isApproved', 0, 1] } },
            verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
            avgRating:{ $avg: '$rating' },
          },
        },
      ]),
      Review.aggregate([
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
    ]);

    const s = totals[0] ?? { total: 0, approved: 0, pending: 0, verified: 0, avgRating: 0 };

    res.json({
      success: true,
      data: {
        total:      s.total,
        approved:   s.approved,
        pending:    s.pending,
        verified:   s.verified,
        avgRating:  Math.round((s.avgRating ?? 0) * 10) / 10,
        distribution: ratingDist,
      },
    });
  } catch (err) {
    console.error('[adminGetStats]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ADMIN — GET /admin/reviews/:id
══════════════════════════════════════════════════════════════════════ */
exports.adminGetById = async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const review = await Review.findById(req.params.id)
      .populate('userId',    'firstName lastName email image')
      .populate('productId', 'name slug images price')
      .populate('orderId',   'orderNumber createdAt')
      .lean();

    if (!review)
      return res.status(404).json({ success: false, message: 'Review not found' });

    res.json({ success: true, data: review });
  } catch (err) {
    console.error('[adminGetById]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ADMIN — PATCH /admin/reviews/:id/approve
══════════════════════════════════════════════════════════════════════ */
exports.adminApprove = async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const review = await Review.findById(req.params.id);
    if (!review)
      return res.status(404).json({ success: false, message: 'Review not found' });

    review.isApproved = true;
    await review.save(); // post-save hook fires → syncProductRating

    res.json({ success: true, message: 'Review approved', data: review });
  } catch (err) {
    console.error('[adminApprove]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ADMIN — PATCH /admin/reviews/:id/reject
══════════════════════════════════════════════════════════════════════ */
exports.adminReject = async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const review = await Review.findById(req.params.id);
    if (!review)
      return res.status(404).json({ success: false, message: 'Review not found' });

    const wasApproved = review.isApproved;
    review.isApproved = false;
    await review.save();

    // Rating sync needed only if it was previously approved
    if (wasApproved) await syncProductRating(review.productId);

    res.json({ success: true, message: 'Review rejected', data: review });
  } catch (err) {
    console.error('[adminReject]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ADMIN — DELETE /admin/reviews/:id
══════════════════════════════════════════════════════════════════════ */
exports.adminDelete = async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const review = await Review.findById(req.params.id);
    if (!review)
      return res.status(404).json({ success: false, message: 'Review not found' });

    const { productId, isApproved } = review;
    await review.deleteOne();

    if (isApproved) await syncProductRating(productId);

    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    console.error('[adminDelete]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ADMIN — POST /admin/reviews/bulk
   body: { ids: string[], action: 'approve' | 'reject' | 'delete' }
══════════════════════════════════════════════════════════════════════ */
exports.adminBulkAction = async (req, res) => {
  try {
    const { ids, action } = req.body;

    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ success: false, message: 'ids array required' });

    if (!['approve', 'reject', 'delete'].includes(action))
      return res.status(400).json({ success: false, message: 'Invalid action' });

    const validIds = ids.filter(isValidId).map(toObjectId);

    if (action === 'delete') {
      const reviews = await Review.find({ _id: { $in: validIds } }).select('productId isApproved').lean();
      await Review.deleteMany({ _id: { $in: validIds } });

      // sync all affected products
      const affectedProductIds = [...new Set(
        reviews.filter((r) => r.isApproved).map((r) => String(r.productId))
      )];
      await Promise.all(affectedProductIds.map(syncProductRating));
    } else {
      const isApproved = action === 'approve';
      await Review.updateMany({ _id: { $in: validIds } }, { $set: { isApproved } });

      // sync all affected products
      const affected = await Review.find({ _id: { $in: validIds } }).select('productId').lean();
      const productIds = [...new Set(affected.map((r) => String(r.productId)))];
      await Promise.all(productIds.map(syncProductRating));
    }

    res.json({ success: true, message: `Bulk ${action} completed`, count: validIds.length });
  } catch (err) {
    console.error('[adminBulkAction]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.adminReply = async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });
 
    const { reply } = req.body;
 
    if (typeof reply !== 'string' || !reply.trim())
      return res.status(400).json({ success: false, message: 'reply field is required' });
 
    const review = await Review.findById(req.params.id);
    if (!review)
      return res.status(404).json({ success: false, message: 'Review not found' });
 
    review.adminReply     = reply.trim();
    review.adminRepliedAt = new Date();
    await review.save();
 
    res.json({
      success: true,
      message: 'Reply saved',
      data:    review,
    });
  } catch (err) {
    console.error('[adminReply]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};