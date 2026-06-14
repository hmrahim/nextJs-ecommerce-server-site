
const mongoose = require('mongoose');
const Product = require('../models/ProductModel');


/**
 * Build Mongoose query filter from request query params
 */
const buildFilter = (q) => {
  const filter = { status: 'active' };

  // ── Text search (name, description, tags, sku) ────────────────────
  if (q.q && q.q.trim()) {
    const term = q.q.trim();
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // regex escape
    const rx = new RegExp(safe, 'i');
    filter.$or = [
      { name: rx },
      { description: rx },
      { shortDescription: rx },
      { sku: rx },
      { tags: rx },
    ];
  }

  // ── Category (id বা slug দুটোই support) ───────────────────────────
  if (q.category) {
    if (mongoose.Types.ObjectId.isValid(q.category)) {
      filter.category = q.category;
    } else {
      filter.categorySlug = q.category;
    }
  }

  // ── Brand ────────────────────────────────────────────────────────
  if (q.brand) {
    filter.brand = mongoose.Types.ObjectId.isValid(q.brand)
      ? q.brand
      : { $exists: true };
  }

  // ── Price range ──────────────────────────────────────────────────
  const min = Number(q.minPrice);
  const max = Number(q.maxPrice);
  if (!Number.isNaN(min) && q.minPrice !== '' && q.minPrice != null) {
    filter.price = { ...(filter.price || {}), $gte: min };
  }
  if (!Number.isNaN(max) && q.maxPrice !== '' && q.maxPrice != null) {
    filter.price = { ...(filter.price || {}), $lte: max };
  }

  // ── Rating ───────────────────────────────────────────────────────
  const rating = Number(q.rating);
  if (!Number.isNaN(rating) && rating > 0) {
    filter.avgRating = { $gte: rating };
  }

  // ── In stock ─────────────────────────────────────────────────────
  if (q.inStock === 'true' || q.inStock === true) {
    filter.stock = { $gt: 0 };
  }

  return filter;
};

/**
 * Sort mapping
 * Accepts: 'price:asc' | 'price:desc' | 'rating:desc' | 'newest' | 'sold:desc'
 */
const buildSort = (sortStr) => {
  switch (sortStr) {
    case 'price:asc':   return { price: 1 };
    case 'price:desc':  return { price: -1 };
    case 'rating:desc': return { avgRating: -1, reviewCount: -1 };
    case 'newest':      return { createdAt: -1 };
    case 'sold:desc':   return { soldCount: -1 };
    default:            return { createdAt: -1 }; // relevance fallback
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const filter = buildFilter(req.query);
    const sort   = buildSort(req.query.sort);

    const [results, total] = await Promise.all([
      Product.find(filter)
        .select('name slug images price comparePrice avgRating reviewCount category brand stock soldCount createdAt')
        .populate('category', 'name slug')
        .populate('brand', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    // Add convenience fields
    const enriched = results.map((p) => ({
      ...p,
      inStock: (p.stock ?? 0) > 0,
      effectivePrice: p.price,
    }));

    return res.status(200).json({
      success: true,
      query:   req.query.q || '',
      total,
      page,
      pages:   Math.ceil(total / limit),
      limit,
      results: enriched,
    });
  } catch (err) {
    console.error('[searchProducts] error:', err);
    return res.status(500).json({
      success: false,
      message: 'Search এ সমস্যা হয়েছে',
      error:   process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
