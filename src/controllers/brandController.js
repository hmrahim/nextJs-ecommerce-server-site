// 📁 PATH: src/controllers/brandController.js
'use strict';



const AppError   = require('../utils/AppError');
const Brand = require('../models/BrandModel');
const catchAsync = require('../utils/catchAsync');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcStats(brands) {
  return {
    total:         brands.length,
    active:        brands.filter((b) => b.isActive).length,
    activeOnly:    brands.filter((b) => b.isActive && !b.isFeatured).length,
    inactive:      brands.filter((b) => !b.isActive).length,
    featured:      brands.filter((b) => b.isFeatured).length,
    totalProducts: brands.reduce((s, b) => s + (b.productCount || 0), 0),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /admin/brands ────────────────────────────────────────────────────────
// Query: search, status (active|inactive|featured), featured (boolean string)
const adminGetAllBrands = catchAsync(async (req, res) => {
  const { search, status, featured } = req.query;

  const filter = {};

  // Status filter
  if (status === 'active')   { filter.isActive = true;  filter.isFeatured = { $ne: true }; }
  if (status === 'inactive') { filter.isActive = false; }
  if (status === 'featured') { filter.isFeatured = true; }

  // Featured standalone param
  if (featured === 'true')  filter.isFeatured = true;
  if (featured === 'false') filter.isFeatured = false;

  // Search (name or country)
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ name: regex }, { country: regex }];
  }

  const brands = await Brand.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();
  const stats  = calcStats(brands);

  res.status(200).json({ success: true, data: { brands, stats } });
});

// ─── GET /admin/brands/stats ──────────────────────────────────────────────────
const adminGetBrandStats = catchAsync(async (req, res) => {
  const brands = await Brand.find({}).lean();
  const stats  = calcStats(brands);

  res.status(200).json({ success: true, data: stats });
});

// ─── GET /admin/brands/:id ────────────────────────────────────────────────────
const adminGetBrandById = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new AppError('Brand not found', 404);

  res.status(200).json({ success: true, data: brand });
});

// ─── POST /admin/brands ───────────────────────────────────────────────────────
const adminCreateBrand = catchAsync(async (req, res) => {
  const {
    name, slug, description, logoPublicId,logoUrl, country, website,
    isActive, isFeatured, metaTitle, metaDescription, sortOrder,
  } = req.body;
 const logo = { url: logoUrl || '', publicId: logoPublicId || '' };

  const brand = await Brand.create({
    name, slug, description, logo, country, website,
    isActive, isFeatured, metaTitle, metaDescription, sortOrder,
  });
console.log(brand);
  res.status(201).json({ success: true, data: brand });
});

// ─── PUT /admin/brands/:id ────────────────────────────────────────────────────
const adminUpdateBrand = catchAsync(async (req, res) => {
  const allowed = [
    'name', 'slug', 'description', 'logo', 'country', 'website',
    'isActive', 'isFeatured', 'metaTitle', 'metaDescription', 'sortOrder',
  ];

  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  // If name is being changed, regenerate slug (unless slug is explicitly sent)
  if (updates.name && !updates.slug) {
    updates.slug = updates.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const brand = await Brand.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!brand) throw new AppError('Brand not found', 404);

  res.status(200).json({ success: true, data: brand });
});

// ─── DELETE /admin/brands/:id ─────────────────────────────────────────────────
const adminDeleteBrand = catchAsync(async (req, res) => {
  const brand = await Brand.findByIdAndDelete(req.params.id);
  if (!brand) throw new AppError('Brand not found', 404);

  // TODO: optionally unlink from products
  // await Product.updateMany({ brand: req.params.id }, { $unset: { brand: 1 } });

  res.status(200).json({ success: true, data: null });
});

// ─── PATCH /admin/brands/:id/toggle  (isActive toggle) ───────────────────────
const adminToggleBrand = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new AppError('Brand not found', 404);

  brand.isActive = !brand.isActive;
  await brand.save();

  res.status(200).json({ success: true, data: brand });
});

// ─── PATCH /admin/brands/:id/feature  (isFeatured toggle) ────────────────────
const adminFeatureBrand = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new AppError('Brand not found', 404);

  brand.isFeatured = !brand.isFeatured;
  await brand.save();

  res.status(200).json({ success: true, data: brand });
});

// ─── PATCH /admin/brands/reorder ─────────────────────────────────────────────
// Body: { items: [{ id, sortOrder }] }
const adminReorderBrands = catchAsync(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items array is required', 400);
  }

  const bulkOps = items.map(({ id, sortOrder }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { sortOrder } },
    },
  }));

  await Brand.bulkWrite(bulkOps);

  res.status(200).json({ success: true, message: 'Brands reordered' });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /brands ──────────────────────────────────────────────────────────────
const getAllBrands = catchAsync(async (req, res) => {
  const brands = await Brand.find({ isActive: true })
    .select('name slug logo country isFeatured productCount')
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  res.status(200).json({ success: true, data: brands });
});

// ─── GET /brands/:slug ────────────────────────────────────────────────────────
const getBrandBySlug = catchAsync(async (req, res) => {
  const brand = await Brand.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!brand) throw new AppError('Brand not found', 404);

  res.status(200).json({ success: true, data: brand });
});

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  adminGetAllBrands,
  adminGetBrandStats,
  adminGetBrandById,
  adminCreateBrand,
  adminUpdateBrand,
  adminDeleteBrand,
  adminToggleBrand,
  adminFeatureBrand,
  adminReorderBrands,
  getAllBrands,
  getBrandBySlug,
};