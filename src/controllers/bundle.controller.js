// 📁 PATH: src/controllers/bundle.controller.js
'use strict';

const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const Bundle     = require('../models/Bundle.model');
const Product    = require('../models/ProductModel');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBundleStatus(bundle) {
  if (!bundle.isActive) return 'inactive';
  if (bundle.validUntil && new Date(bundle.validUntil) < new Date()) return 'expired';
  return 'active';
}

function shapeBundle(doc) {
  const originalPrice = (doc.products || []).reduce((s, p) => s + p.price * p.quantity, 0);
  return {
    ...doc,
    _id:           String(doc._id),
    originalPrice,
    status:        getBundleStatus(doc),
  };
}

// Helper: enrich bundle products with images from Product collection
async function enrichBundleProductImages(bundle) {
  if (!bundle || !bundle.products || bundle.products.length === 0) return bundle;
  
  const productIds = bundle.products
    .map(p => p.productId)
    .filter(Boolean);
  
  if (productIds.length === 0) return bundle;
  
  const products = await Product.find(
    { _id: { $in: productIds } },
    { _id: 1, images: 1 }
  ).lean();
  
  const imageMap = {};
  products.forEach(p => {
    imageMap[String(p._id)] = p.images && p.images.length > 0 ? p.images[0].url : '';
  });
  
  bundle.products = bundle.products.map(p => ({
    ...p,
    image: p.image || imageMap[String(p.productId)] || '',
  }));
  
  return bundle;
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — BUNDLES
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /admin/bundles ─────────────────────────────────────────────────────────
const adminGetAllBundles = catchAsync(async (req, res) => {
  const { search, status, page = 1, limit = 15, sort = 'createdAt:desc' } = req.query;

  const filter = {};
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ name: regex }, { sku: regex }];
  }
  if (status === 'inactive') filter.isActive = false;
  if (status === 'active')   { filter.isActive = true; filter.$or = (filter.$or || []).concat([{ validUntil: null }, { validUntil: { $gte: new Date() } }]); }
  if (status === 'expired')  { filter.isActive = true; filter.validUntil = { $lt: new Date() }; }

  const [field, dir] = String(sort).split(':');
  const sortMap = {
    createdAt: 'createdAt',
    price:     'bundlePrice',
    sold:      'sold',
    discount:  'bundlePrice', // computed client-side; fall back to price
  };
  const sortObj = { [sortMap[field] || 'createdAt']: dir === 'asc' ? 1 : -1 };

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Bundle.countDocuments(filter);
  const docs  = await Bundle.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean({ virtuals: true });

  res.status(200).json({
    success: true,
    bundles: docs.map(shapeBundle),
    total,
    pages: Math.max(1, Math.ceil(total / Number(limit))),
    page: Number(page),
  });
});

// ─── GET /admin/bundles/:id ──────────────────────────────────────────────────────
const adminGetBundleById = catchAsync(async (req, res) => {
  const bundle = await Bundle.findById(req.params.id).lean({ virtuals: true });
  if (!bundle) throw new AppError('Bundle not found', 404);

  res.status(200).json({ success: true, data: shapeBundle(bundle) });
});

// ─── POST /admin/bundles ──────────────────────────────────────────────────────────
const adminCreateBundle = catchAsync(async (req, res) => {
  const {
    name, description, sku, products, bundlePrice, comparePrice,
    stock, validFrom, validUntil, isActive, isFeatured, image, tags,
  } = req.body;

  if (!name || !name.trim()) throw new AppError('Bundle name is required', 400);
  if (!Array.isArray(products) || products.length < 2) {
    throw new AppError('A bundle must have at least 2 products', 400);
  }
  if (!bundlePrice || Number(bundlePrice) <= 0) throw new AppError('Valid bundle price is required', 400);

  // Fetch product images from Product collection
  const productIds = products.map(p => p.productId).filter(Boolean);
  const productDocs = await Product.find({ _id: { $in: productIds } }, { _id: 1, images: 1 }).lean();
  const imageMap = {};
  productDocs.forEach(p => {
    imageMap[String(p._id)] = p.images && p.images.length > 0 ? p.images[0].url : '';
  });

  const bundle = await Bundle.create({
    name, description, sku: sku || undefined,
    products: products.map((p) => ({
      productId: p.productId, name: p.name, sku: p.sku || '', price: Number(p.price) || 0, quantity: Number(p.quantity) || 1,
      image: p.image || imageMap[String(p.productId)] || '',
    })),
    bundlePrice:  Number(bundlePrice),
    comparePrice: comparePrice ? Number(comparePrice) : null,
    stock:        stock !== null && stock !== undefined && stock !== '' ? Number(stock) : null,
    validFrom:    validFrom  || null,
    validUntil:   validUntil || null,
    isActive:     isActive !== false,
    isFeatured:   !!isFeatured,
    image:        image || '',
    tags:         Array.isArray(tags) ? tags : [],
  });

  res.status(201).json({ success: true, data: shapeBundle(bundle.toObject({ virtuals: true })) });
});

// ─── PUT /admin/bundles/:id ───────────────────────────────────────────────────────
const adminUpdateBundle = catchAsync(async (req, res) => {
  const allowed = [
    'name', 'description', 'sku', 'products', 'bundlePrice', 'comparePrice',
    'stock', 'validFrom', 'validUntil', 'isActive', 'isFeatured', 'image', 'tags',
  ];

  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  if (updates.products) {
    if (!Array.isArray(updates.products) || updates.products.length < 2) {
      throw new AppError('A bundle must have at least 2 products', 400);
    }
    // Fetch product images from Product collection
    const productIds = updates.products.map(p => p.productId).filter(Boolean);
    const productDocs = await Product.find({ _id: { $in: productIds } }, { _id: 1, images: 1 }).lean();
    const imageMap = {};
    productDocs.forEach(p => {
      imageMap[String(p._id)] = p.images && p.images.length > 0 ? p.images[0].url : '';
    });
    updates.products = updates.products.map((p) => ({
      productId: p.productId, name: p.name, sku: p.sku || '', price: Number(p.price) || 0, quantity: Number(p.quantity) || 1,
      image: p.image || imageMap[String(p.productId)] || '',
    }));
  }
  if (updates.bundlePrice !== undefined)  updates.bundlePrice  = Number(updates.bundlePrice);
  if (updates.comparePrice !== undefined) updates.comparePrice = updates.comparePrice ? Number(updates.comparePrice) : null;
  if (updates.stock !== undefined)        updates.stock        = updates.stock !== null && updates.stock !== '' ? Number(updates.stock) : null;

  const bundle = await Bundle.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
  if (!bundle) throw new AppError('Bundle not found', 404);

  res.status(200).json({ success: true, data: shapeBundle(bundle.toObject({ virtuals: true })) });
});

// ─── DELETE /admin/bundles/:id ─────────────────────────────────────────────────────
const adminDeleteBundle = catchAsync(async (req, res) => {
  const bundle = await Bundle.findByIdAndDelete(req.params.id);
  if (!bundle) throw new AppError('Bundle not found', 404);

  res.status(200).json({ success: true, data: null });
});

// ─── DELETE /admin/bundles/bulk ────────────────────────────────────────────────────
// Body: { ids: [] }
const adminBulkDeleteBundles = catchAsync(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids array is required', 400);

  const result = await Bundle.deleteMany({ _id: { $in: ids } });
  res.status(200).json({ success: true, message: `${result.deletedCount} bundle(s) deleted` });
});

// ─── PATCH /admin/bundles/:id/toggle ──────────────────────────────────────────────
const adminToggleBundle = catchAsync(async (req, res) => {
  const bundle = await Bundle.findById(req.params.id);
  if (!bundle) throw new AppError('Bundle not found', 404);

  bundle.isActive = !bundle.isActive;
  await bundle.save();

  res.status(200).json({ success: true, data: shapeBundle(bundle.toObject({ virtuals: true })) });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC — BUNDLES
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /bundles ────────────────────────────────────────────────────────────────
const getAllBundles = catchAsync(async (req, res) => {
  const now = new Date();
  const bundles = await Bundle.find({
    isActive: true,
    $or: [{ validUntil: null }, { validUntil: { $gte: now } }],
  })
    .sort({ isFeatured: -1, createdAt: -1 })
    .lean({ virtuals: true });

  // Enrich product images for bundles that may not have them stored
  const enriched = await Promise.all(bundles.map(b => enrichBundleProductImages(b)));

  res.status(200).json({ success: true, data: enriched.map(shapeBundle) });
});

// ─── GET /bundles/:slug ────────────────────────────────────────────────────────────
const getBundleBySlug = catchAsync(async (req, res) => {
  let bundle = await Bundle.findOne({ slug: req.params.slug, isActive: true }).lean({ virtuals: true });
  if (!bundle) throw new AppError('Bundle not found', 404);

  // Enrich product images
  bundle = await enrichBundleProductImages(bundle);

  res.status(200).json({ success: true, data: shapeBundle(bundle) });
});

module.exports = {
  adminGetAllBundles,
  adminGetBundleById,
  adminCreateBundle,
  adminUpdateBundle,
  adminDeleteBundle,
  adminBulkDeleteBundles,
  adminToggleBundle,
  getAllBundles,
  getBundleBySlug,
};