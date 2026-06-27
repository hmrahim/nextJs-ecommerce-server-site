'use strict';

const mongoose             = require('mongoose');
const Category             = require('../../models/CategoryModel');
const Product              = require('../../models/ProductModel');
const ProductVariantModel  = require('../../models/ProductVariantModel');

const PUBLIC_FILTER = { status: 'active', isActive: true };
const PUBLIC_SELECT = '-cost -trackInventory';

const withPopulates = (query) =>
  query
    .populate('category',       'name slug')
    .populate('subCategory',    'name slug')
    .populate('subSubCategory', 'name slug')
    .populate('brand',          'name logo');

const SORT_MAP = {
  'price:asc':   'price',
  'price:desc':  '-price',
  'rating:desc': '-avgRating',
  'rating:asc':  'avgRating',
  'sold:desc':   '-sold',
  'newest':      '-createdAt',
  '-createdAt':  '-createdAt',
};
const resolveSort = (raw) => SORT_MAP[raw] ?? '-createdAt';

const buildPriceFilter = (min, max) => {
  const f = {};
  if (min !== undefined && min !== '') f.$gte = Number(min);
  if (max !== undefined && max !== '') f.$lte = Number(max);
  return Object.keys(f).length ? f : null;
};

const paginate = (total, page, limit) => ({
  total,
  page:  Number(page),
  pages: Math.ceil(total / Number(limit)),
  limit: Number(limit),
});

/* Helper: attach active variants from ProductVariantModel to a product */
const attachVariants = async (product) => {
  if (!product?._id) return product;
  const variants = await ProductVariantModel
    .find({ product: product._id, isActive: true })
    .select('-cost -__v')
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  product.variants = variants;

  // Derived attribute summary (e.g. { Color: [{label,data}], Size: [...] })
  const attrMap = {};
  for (const v of variants) {
    for (const a of v.attributes || []) {
      const key = a.attributeName;
      if (!attrMap[key]) attrMap[key] = { slug: a.attributeSlug, values: [] };
      if (!attrMap[key].values.some((x) => x.valueId === a.valueId)) {
        attrMap[key].values.push({
          valueId:    a.valueId,
          valueLabel: a.valueLabel,
          valueData:  a.valueData || '',
        });
      }
    }
  }
  product.variantAttributes = Object.entries(attrMap).map(([name, v]) => ({
    name, slug: v.slug, values: v.values,
  }));
  return product;
};

/* ══════════════════════════════════════════════════════════════
   1. GET ALL PRODUCTS
═══════════════════════════════════════════════════════════════ */
exports.getAllPublicProducts = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, sort = '-createdAt',
      category, subCategory, subSubCategory, brand,
      tags, featured, freeShipping, inStock,
      minPrice, maxPrice, rating,
    } = req.query;

    const filter = { ...PUBLIC_FILTER };
    if (category)       filter.category       = category;
    if (subCategory)    filter.subCategory    = subCategory;
    if (subSubCategory) filter.subSubCategory = subSubCategory;
    if (brand)          filter.brand          = brand;
    if (featured)       filter.featured       = featured === 'true';
    if (inStock === 'true') filter.stock      = { $gt: 0 };
    if (tags)           filter.tags           = { $in: tags.split(',').map((t) => t.trim()) };

    const priceFilter = buildPriceFilter(minPrice, maxPrice);
    if (priceFilter)    filter.price          = priceFilter;
    if (rating)         filter.avgRating      = { $gte: Number(rating) };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await withPopulates(
      Product.find(filter).select(PUBLIC_SELECT).sort(resolveSort(sort)).skip(skip).limit(Number(limit))
    ).lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      ...paginate(total, page, limit),
      results: products,
    });
  } catch (err) {
    console.error('getAllProducts:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   2. GET PRODUCT BY SLUG  (includes variants)
   Also handles lookup by ObjectId as fallback (e.g. from flash sale links)
═══════════════════════════════════════════════════════════════ */
exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // First try to find by slug
    let product = await withPopulates(
      Product.findOne({ slug, ...PUBLIC_FILTER }).select(PUBLIC_SELECT)
    ).lean({ virtuals: true });

    // If not found by slug, try by ObjectId (fallback for flash sale product links)
    if (!product && mongoose.isValidObjectId(slug)) {
      product = await withPopulates(
        Product.findOne({ _id: slug, ...PUBLIC_FILTER }).select(PUBLIC_SELECT)
      ).lean({ virtuals: true });
    }

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await attachVariants(product);
    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    console.error('getProductBySlug:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   3. GET PRODUCT BY SKU  (includes variants)
═══════════════════════════════════════════════════════════════ */
exports.getProductBySku = async (req, res) => {
  try {
    const product = await withPopulates(
      Product.findOne({ sku: req.params.sku.toUpperCase(), ...PUBLIC_FILTER }).select(PUBLIC_SELECT)
    ).lean({ virtuals: true });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await attachVariants(product);
    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    console.error('getProductBySku:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   4. FULL-TEXT SEARCH
═══════════════════════════════════════════════════════════════ */
exports.searchProducts = async (req, res) => {
  try {
    const { q, page = 1, limit = 20, sort, minPrice, maxPrice, category, brand, rating, inStock } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'Search query (q) is required' });
    }

    const filter = { $text: { $search: q.trim() }, ...PUBLIC_FILTER };
    if (category)           filter.category  = category;
    if (brand)              filter.brand     = brand;
    if (inStock === 'true') filter.stock     = { $gt: 0 };

    const priceFilter = buildPriceFilter(minPrice, maxPrice);
    if (priceFilter)        filter.price     = priceFilter;
    if (rating)             filter.avgRating = { $gte: Number(rating) };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const sortStage = sort ? resolveSort(sort) : { score: { $meta: 'textScore' } };

    const products = await withPopulates(
      Product.find(filter, sort ? undefined : { score: { $meta: 'textScore' } })
        .select(PUBLIC_SELECT).sort(sortStage).skip(skip).limit(Number(limit))
    ).lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      query: q.trim(),
      ...paginate(total, page, limit),
      results: products,
    });
  } catch (err) {
    console.error('searchProducts:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   5. FEATURED PRODUCTS
═══════════════════════════════════════════════════════════════ */
exports.getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const products = await withPopulates(
      Product.find({ featured: true, ...PUBLIC_FILTER }).select(PUBLIC_SELECT).sort('-createdAt').limit(Number(limit))
    ).lean({ virtuals: true });

    return res.status(200).json({ success: true, results: products });
  } catch (err) {
    console.error('getFeaturedProducts:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   6. RELATED PRODUCTS
═══════════════════════════════════════════════════════════════ */
exports.getRelatedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const source = await Product.findOne({ _id: req.params.id, ...PUBLIC_FILTER })
      .select('category brand tags').lean();
    if (!source) return res.status(404).json({ success: false, message: 'Product not found' });

    const filter = {
      _id: { $ne: source._id },
      ...PUBLIC_FILTER,
      $or: [
        { category: source.category, brand: source.brand },
        { category: source.category },
        { tags: { $in: source.tags ?? [] } },
      ],
    };

    const products = await withPopulates(
      Product.find(filter).select(PUBLIC_SELECT).sort('-avgRating -stock').limit(Number(limit))
    ).lean({ virtuals: true });

    return res.status(200).json({ success: true, results: products });
  } catch (err) {
    console.error('getRelatedProducts:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ══════════════════════════════════════════════════════════════
   7. PRODUCTS BY CATEGORY SLUG
═══════════════════════════════════════════════════════════════ */
exports.getProductsByCategory = async (req, res) => {
  try {
    const cat = await Category.findOne({ slug: req.params.slug }).lean();
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });

    const { page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const filter = {
      ...PUBLIC_FILTER,
      $or: [{ category: cat._id }, { subCategory: cat._id }, { subSubCategory: cat._id }],
    };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await withPopulates(
      Product.find(filter).select(PUBLIC_SELECT).sort(resolveSort(sort)).skip(skip).limit(Number(limit))
    ).lean({ virtuals: true });

    return res.status(200).json({
      success: true,
      category: { _id: cat._id, name: cat.name, slug: cat.slug },
      ...paginate(total, page, limit),
      results: products,
    });
  } catch (err) {
    console.error('getProductsByCategory:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
