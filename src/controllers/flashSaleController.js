// 📁 PATH: src/controllers/flashSaleController.js
// Production-ready Flash Sale controller (Noon/Amazon/Daraz style)
'use strict';

const mongoose   = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const FlashSale  = require('../models/FlashSaleModel');
const Product    = require('../models/ProductModel');

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

const ALLOWED_FIELDS = [
  'name', 'slug', 'description', 'discountType', 'discountValue',
  'applicationType', 'startTime', 'endTime', 'totalStock', 'maxOrdersPerUser',
  'isActive', 'banner', 'bannerMobile', 'priority',
];

function sanitizePayload(body = {}) {
  const payload = {};
  ALLOWED_FIELDS.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });
  // Drop empty slug so the pre-update hook can auto-generate it
  if (payload.slug !== undefined && (payload.slug === null || String(payload.slug).trim() === '')) {
    delete payload.slug;
  }
  return payload;
}

/* ── Helper: compute sale price from original price + discount ── */
function computeSalePrice(originalPrice, discountType, discountValue) {
  const op = Number(originalPrice) || 0;
  const dv = Number(discountValue) || 0;
  if (discountType === 'percent') {
    return Math.max(0, Math.round(op * (1 - dv / 100)));
  }
  return Math.max(0, Math.round(op - dv));
}

function buildFilter(query) {
  const { search, status, discountType, isActive } = query;
  const filter = {};
  const now = new Date();

  if (discountType && discountType !== 'all') {
    filter.discountType = discountType;
  }

  if (isActive !== undefined && isActive !== 'all') {
    filter.isActive = isActive === 'true';
  }

  if (status && status !== 'all') {
    switch (status) {
      case 'active':
        filter.isActive = true;
        filter.startTime = { $lte: now };
        filter.endTime = { $gt: now };
        break;
      case 'upcoming':
      case 'scheduled':
        filter.isActive = true;
        filter.startTime = { $gt: now };
        break;
      case 'ended':
        filter.endTime = { $lt: now };
        break;
      case 'draft':
        filter.isActive = false;
        break;
      case 'sold_out':
        filter.isActive = true;
        filter.startTime = { $lte: now };
        filter.endTime = { $gt: now };
        filter.$expr = { $gte: ['$soldCount', '$totalStock'] };
        break;
    }
  }

  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { slug: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
    ];
  }

  return filter;
}

function buildSort(sort) {
  switch (sort) {
    case 'oldest':    return { createdAt: 1 };
    case 'startTime': return { startTime: 1 };
    case 'revenue':   return { revenue: -1 };
    case 'soldCount': return { soldCount: -1 };
    case 'priority':  return { priority: -1, startTime: 1 };
    case 'newest':
    default:          return { createdAt: -1 };
  }
}

/* ════════════════════════════════════════════════════════════
   ADMIN CONTROLLERS
════════════════════════════════════════════════════════════ */

// ─── GET /admin/flash-sales ──────────────────────────────────────────────────
const adminGetAll = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sort = 'newest' } = req.query;
  const filter = buildFilter(req.query);
  const sortObj = buildSort(sort);

  const skip = (Number(page) - 1) * Number(limit);

  const [flashSales, total] = await Promise.all([
    FlashSale.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate('createdBy', 'firstName lastName email')
      .lean({ virtuals: true }),
    FlashSale.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    flashSales,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    limit: Number(limit),
  });
});

// ─── GET /admin/flash-sales/stats ────────────────────────────────────────────
const adminGetStats = catchAsync(async (req, res) => {
  const now = new Date();

  const [totalCount, activeCount, upcomingCount, endedCount, draftCount, revenueAgg] = await Promise.all([
    FlashSale.countDocuments({}),
    FlashSale.countDocuments({ isActive: true, startTime: { $lte: now }, endTime: { $gt: now } }),
    FlashSale.countDocuments({ isActive: true, startTime: { $gt: now } }),
    FlashSale.countDocuments({ endTime: { $lt: now } }),
    FlashSale.countDocuments({ isActive: false }),
    FlashSale.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          totalSold: { $sum: '$soldCount' },
          totalStock: { $sum: '$totalStock' },
          totalOrders: { $sum: '$orderCount' },
        },
      },
    ]),
  ]);

  const agg = revenueAgg[0] || { totalRevenue: 0, totalSold: 0, totalStock: 0, totalOrders: 0 };

  res.status(200).json({
    success: true,
    data: {
      total: totalCount,
      active: activeCount,
      upcoming: upcomingCount,
      ended: endedCount,
      draft: draftCount,
      totalRevenue: agg.totalRevenue,
      totalSold: agg.totalSold,
      totalStock: agg.totalStock,
      totalOrders: agg.totalOrders,
      fillRate: agg.totalStock > 0 ? Math.round((agg.totalSold / agg.totalStock) * 100) : 0,
    },
  });
});

// ─── GET /admin/flash-sales/:id ──────────────────────────────────────────────
const adminGetById = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const sale = await FlashSale.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email')
    .populate('products.product', 'name slug images price stock sku')
    .lean({ virtuals: true });

  if (!sale) throw new AppError('Flash sale not found', 404);

  res.status(200).json({ success: true, data: sale });
});

// ─── POST /admin/flash-sales ─────────────────────────────────────────────────
const adminCreate = catchAsync(async (req, res) => {
  const payload = sanitizePayload(req.body);

  if (req.user?._id) payload.createdBy = req.user._id;

  // Handle product selection based on applicationType
  if (payload.applicationType === 'specific' && Array.isArray(req.body.selectedProducts)) {
    const productItems = [];
    for (const item of req.body.selectedProducts) {
      if (!mongoose.isValidObjectId(item.productId)) continue;

      // Try to fetch product details from DB for accurate data
      let productData;
      try {
        productData = await Product.findById(item.productId).lean();
      } catch {
        productData = null;
      }

      const originalPrice = productData?.price ?? item.originalPrice ?? 0;
      let salePrice;
      if (payload.discountType === 'percent') {
        salePrice = Math.round(originalPrice * (1 - payload.discountValue / 100));
      } else {
        salePrice = Math.max(0, originalPrice - payload.discountValue);
      }

      productItems.push({
        product: item.productId,
        name: productData?.name ?? item.name ?? 'Unknown Product',
        image: productData?.images?.[0]?.url ?? item.image ?? null,
        sku: productData?.sku ?? item.sku ?? '',
        originalPrice,
        salePrice,
        stock: productData?.stock ?? item.stock ?? 0,
        sold: 0,
        sortOrder: productItems.length,
      });
    }
    payload.products = productItems;

    // Auto-calculate totalStock from selected products if not manually set higher
    const productsStock = productItems.reduce((sum, p) => sum + p.stock, 0);
    if (productsStock > 0 && (!payload.totalStock || payload.totalStock < productsStock)) {
      payload.totalStock = productsStock;
    }
  } else if (payload.applicationType === 'all') {
    // For 'all' products, we don't embed products — the discount applies globally
    payload.products = [];
  }

  // Remove selectedProducts from payload (it's not a model field)
  delete payload.selectedProducts;

  const sale = await FlashSale.create(payload);
  const result = await FlashSale.findById(sale._id).lean({ virtuals: true });

  res.status(201).json({
    success: true,
    message: 'Flash sale created successfully',
    data: result,
  });
});

// ─── PUT /admin/flash-sales/:id ──────────────────────────────────────────────
const adminUpdate = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const payload = sanitizePayload(req.body);
  // Don't allow direct manipulation of tracked fields
  delete payload.soldCount;
  delete payload.revenue;
  delete payload.orderCount;

  // Handle product selection based on applicationType
  if (payload.applicationType === 'specific' && Array.isArray(req.body.selectedProducts)) {
    const productItems = [];
    for (const item of req.body.selectedProducts) {
      if (!mongoose.isValidObjectId(item.productId)) continue;

      let productData;
      try {
        productData = await Product.findById(item.productId).lean();
      } catch {
        productData = null;
      }

      const originalPrice = productData?.price ?? item.originalPrice ?? 0;
      const discType = payload.discountType || 'percent';
      const discVal = payload.discountValue || 0;
      let salePrice;
      if (discType === 'percent') {
        salePrice = Math.round(originalPrice * (1 - discVal / 100));
      } else {
        salePrice = Math.max(0, originalPrice - discVal);
      }

      productItems.push({
        product: item.productId,
        name: productData?.name ?? item.name ?? 'Unknown Product',
        image: productData?.images?.[0]?.url ?? item.image ?? null,
        sku: productData?.sku ?? item.sku ?? '',
        originalPrice,
        salePrice,
        stock: productData?.stock ?? item.stock ?? 0,
        sold: 0,
        sortOrder: productItems.length,
      });
    }
    payload.products = productItems;

    const productsStock = productItems.reduce((sum, p) => sum + p.stock, 0);
    if (productsStock > 0 && (!payload.totalStock || payload.totalStock < productsStock)) {
      payload.totalStock = productsStock;
    }
  } else if (payload.applicationType === 'all') {
    payload.products = [];
  }

  // Remove selectedProducts from payload
  delete payload.selectedProducts;

  const sale = await FlashSale.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean({ virtuals: true });

  if (!sale) throw new AppError('Flash sale not found', 404);

  res.status(200).json({
    success: true,
    message: 'Flash sale updated successfully',
    data: sale,
  });
});

// ─── DELETE /admin/flash-sales/:id ───────────────────────────────────────────
const adminDelete = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const sale = await FlashSale.findByIdAndDelete(req.params.id);
  if (!sale) throw new AppError('Flash sale not found', 404);

  res.status(200).json({
    success: true,
    message: 'Flash sale deleted successfully',
    data: null,
  });
});

// ─── PATCH /admin/flash-sales/:id/toggle ─────────────────────────────────────
const adminToggle = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const sale = await FlashSale.findById(req.params.id);
  if (!sale) throw new AppError('Flash sale not found', 404);

  sale.isActive = !sale.isActive;
  await sale.save();

  res.status(200).json({
    success: true,
    message: `Flash sale ${sale.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { isActive: sale.isActive, status: sale.status },
  });
});

// ─── DELETE /admin/flash-sales/bulk ──────────────────────────────────────────
const adminBulkDelete = catchAsync(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Provide an array of flash sale IDs to delete', 400);
  }

  const invalidIds = ids.filter((id) => !mongoose.isValidObjectId(id));
  if (invalidIds.length > 0) {
    throw new AppError(`Invalid IDs: ${invalidIds.join(', ')}`, 400);
  }

  const result = await FlashSale.deleteMany({ _id: { $in: ids } });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} flash sale(s) deleted successfully`,
    data: { deletedCount: result.deletedCount },
  });
});

// ─── POST /admin/flash-sales/:id/duplicate ───────────────────────────────────
const adminDuplicate = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const original = await FlashSale.findById(req.params.id).lean();
  if (!original) throw new AppError('Flash sale not found', 404);

  // Create duplicate with reset stats
  const duplicateData = {
    name: `${original.name} (Copy)`,
    slug: null, // will be auto-generated
    description: original.description,
    discountType: original.discountType,
    discountValue: original.discountValue,
    applicationType: original.applicationType || 'all',
    startTime: original.startTime,
    endTime: original.endTime,
    totalStock: original.totalStock,
    maxOrdersPerUser: original.maxOrdersPerUser,
    isActive: false, // start as draft
    banner: original.banner,
    bannerMobile: original.bannerMobile,
    priority: original.priority,
    products: original.products.map((p) => ({
      ...p,
      sold: 0, // reset sold count
    })),
    soldCount: 0,
    revenue: 0,
    orderCount: 0,
    userPurchases: [],
    createdBy: req.user?._id,
  };

  const duplicate = await FlashSale.create(duplicateData);
  const result = await FlashSale.findById(duplicate._id).lean({ virtuals: true });

  res.status(201).json({
    success: true,
    message: 'Flash sale duplicated successfully',
    data: result,
  });
});

/* ════════════════════════════════════════════════════════════
   PRODUCT MANAGEMENT (within a flash sale)
════════════════════════════════════════════════════════════ */

// ─── POST /admin/flash-sales/:id/products ────────────────────────────────────
const adminAddProducts = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Provide an array of product items to add', 400);
  }

  const sale = await FlashSale.findById(req.params.id);
  if (!sale) throw new AppError('Flash sale not found', 404);

  // Validate product IDs and fetch product data
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.productId)) {
      throw new AppError(`Invalid product ID: ${item.productId}`, 400);
    }

    // Check if product already exists in this sale
    const exists = sale.products.find(
      (p) => String(p.product) === String(item.productId)
    );
    if (exists) {
      throw new AppError(`Product ${item.productId} is already in this flash sale`, 400);
    }

    // Fetch product details
    const product = await Product.findById(item.productId).lean();
    if (!product) {
      throw new AppError(`Product not found: ${item.productId}`, 404);
    }

    // Calculate sale price if not provided
    let salePrice = item.salePrice;
    if (!salePrice) {
      if (sale.discountType === 'percent') {
        salePrice = Math.round(product.price * (1 - sale.discountValue / 100));
      } else {
        salePrice = Math.max(0, product.price - sale.discountValue);
      }
    }

    sale.products.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0]?.url || null,
      sku: product.sku,
      originalPrice: product.price,
      salePrice,
      stock: item.stock ?? product.stock ?? 0,
      sold: 0,
      maxPerUser: item.maxPerUser || null,
      sortOrder: item.sortOrder || sale.products.length,
    });
  }

  // Update total stock
  sale.totalStock = sale.products.reduce((sum, p) => sum + p.stock, 0);
  await sale.save();

  const result = await FlashSale.findById(sale._id)
    .populate('products.product', 'name slug images price stock sku')
    .lean({ virtuals: true });

  res.status(200).json({
    success: true,
    message: `${items.length} product(s) added to flash sale`,
    data: result,
  });
});

// ─── DELETE /admin/flash-sales/:id/products/:prodId ──────────────────────────
const adminRemoveProduct = catchAsync(async (req, res) => {
  const { id, prodId } = req.params;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(prodId)) {
    throw new AppError('Invalid ID', 400);
  }

  const sale = await FlashSale.findById(id);
  if (!sale) throw new AppError('Flash sale not found', 404);

  const idx = sale.products.findIndex(
    (p) => String(p.product) === prodId || String(p._id) === prodId
  );
  if (idx === -1) throw new AppError('Product not found in this flash sale', 404);

  sale.products.splice(idx, 1);
  sale.totalStock = sale.products.reduce((sum, p) => sum + p.stock, 0);
  await sale.save();

  res.status(200).json({
    success: true,
    message: 'Product removed from flash sale',
    data: sale.toObject({ virtuals: true }),
  });
});

// ─── PATCH /admin/flash-sales/:id/products/:prodId ───────────────────────────
const adminUpdateProduct = catchAsync(async (req, res) => {
  const { id, prodId } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const sale = await FlashSale.findById(id);
  if (!sale) throw new AppError('Flash sale not found', 404);

  const product = sale.products.find(
    (p) => String(p.product) === prodId || String(p._id) === prodId
  );
  if (!product) throw new AppError('Product not found in this flash sale', 404);

  // Update allowed fields
  const { salePrice, stock, maxPerUser, sortOrder } = req.body;
  if (salePrice !== undefined) product.salePrice = Number(salePrice);
  if (stock !== undefined)     product.stock = Number(stock);
  if (maxPerUser !== undefined) product.maxPerUser = maxPerUser ? Number(maxPerUser) : null;
  if (sortOrder !== undefined) product.sortOrder = Number(sortOrder);

  sale.totalStock = sale.products.reduce((sum, p) => sum + p.stock, 0);
  await sale.save();

  res.status(200).json({
    success: true,
    message: 'Product updated in flash sale',
    data: sale.toObject({ virtuals: true }),
  });
});

// ─── GET /admin/flash-sales/:id/stats ────────────────────────────────────────
const adminGetSaleStats = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const sale = await FlashSale.findById(req.params.id).lean({ virtuals: true });
  if (!sale) throw new AppError('Flash sale not found', 404);

  const totalProductStock = sale.products.reduce((s, p) => s + p.stock, 0);
  const totalProductSold  = sale.products.reduce((s, p) => s + p.sold, 0);
  const avgDiscount = sale.products.length > 0
    ? Math.round(sale.products.reduce((s, p) => {
        const disc = p.originalPrice > 0 ? ((p.originalPrice - p.salePrice) / p.originalPrice) * 100 : 0;
        return s + disc;
      }, 0) / sale.products.length)
    : 0;

  // Top selling products
  const topProducts = [...sale.products]
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  res.status(200).json({
    success: true,
    data: {
      saleId: sale._id,
      name: sale.name,
      status: sale.status,
      revenue: sale.revenue,
      orderCount: sale.orderCount,
      soldCount: sale.soldCount,
      totalStock: sale.totalStock,
      fillRate: sale.totalStock > 0 ? Math.round((sale.soldCount / sale.totalStock) * 100) : 0,
      productCount: sale.products.length,
      totalProductStock,
      totalProductSold,
      avgDiscount,
      topProducts,
      timeRemaining: sale.timeRemaining,
      startTime: sale.startTime,
      endTime: sale.endTime,
    },
  });
});

// ─── GET /admin/flash-sales/revenue ──────────────────────────────────────────
const adminGetRevenue = catchAsync(async (req, res) => {
  const { period = '30d' } = req.query;

  let startDate;
  const now = new Date();
  switch (period) {
    case '7d':  startDate = new Date(now - 7 * 86400000); break;
    case '30d': startDate = new Date(now - 30 * 86400000); break;
    case '90d': startDate = new Date(now - 90 * 86400000); break;
    default:    startDate = new Date(now - 30 * 86400000);
  }

  const revenue = await FlashSale.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$revenue' },
        orders: { $sum: '$orderCount' },
        sold: { $sum: '$soldCount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({
    success: true,
    data: { period, revenue },
  });
});

/* ════════════════════════════════════════════════════════════
   PUBLIC / STOREFRONT CONTROLLERS
════════════════════════════════════════════════════════════ */

// ─── GET /flash-sales/active ─────────────────────────────────────────────────
// Returns currently active flash sales. For applicationType==='all' sales,
// the embedded products array stays empty — the storefront resolves the
// product list separately via /flash-sales/offer-products.
const getActive = catchAsync(async (req, res) => {
  const now = new Date();

  const sales = await FlashSale.find({
    isActive: true,
    startTime: { $lte: now },
    endTime: { $gt: now },
  })
    .select('name slug discountType discountValue applicationType startTime endTime totalStock soldCount products banner bannerMobile priority')
    .sort({ priority: -1, startTime: 1 })
    .lean({ virtuals: true });

  const sanitized = sales.map((s) => {
    const { userPurchases, ...rest } = s;
    return rest;
  });

  res.status(200).json({
    success: true,
    data: sanitized,
  });
});

// ─── GET /flash-sales/offer-products ─────────────────────────────────────────
// Returns the product list for the *highest priority* active flash sale.
// - applicationType === 'specific' → embedded products (with original/sale price).
// - applicationType === 'all'      → all active products with discount applied.
// Query: ?limit=20&page=1&category=<slug>
const getOfferProducts = catchAsync(async (req, res) => {
  const now = new Date();
  const limit = Math.min(Number(req.query.limit) || 24, 100);
  const page  = Math.max(Number(req.query.page) || 1, 1);

  const sale = await FlashSale.findOne({
    isActive: true,
    startTime: { $lte: now },
    endTime:   { $gt: now },
  })
    .sort({ priority: -1, startTime: 1 })
    .lean({ virtuals: true });

  if (!sale) {
    return res.status(200).json({
      success: true,
      data: { sale: null, products: [], total: 0, page, pages: 0 },
    });
  }

  const baseSale = (() => {
    const { userPurchases, products, ...rest } = sale;
    return rest;
  })();

  // Specific products: return the embedded list with proper slugs
  if (sale.applicationType === 'specific') {
    // Fetch actual product slugs from the Product collection
    const productIds = (sale.products || []).map((p) => p.product).filter(Boolean);
    let slugMap = {};
    if (productIds.length > 0) {
      const productDocs = await Product.find({ _id: { $in: productIds } })
        .select('_id slug name images')
        .lean();
      slugMap = productDocs.reduce((acc, doc) => {
        acc[String(doc._id)] = doc;
        return acc;
      }, {});
    }

    const products = (sale.products || []).map((p) => {
      const productDoc = slugMap[String(p.product)] || {};
      return {
        _id: p.product,
        productId: p.product,
        name: p.name || productDoc.name || 'Unknown Product',
        slug: productDoc.slug || null,
        image: p.image || productDoc.images?.[0]?.url || null,
        images: p.image ? [{ url: p.image }] : (productDoc.images || []),
        sku: p.sku,
        price: p.salePrice,
        originalPrice: p.originalPrice,
        comparePrice: p.originalPrice,
        salePrice: p.salePrice,
        stock: p.stock,
        sold: p.sold,
        flashSale: {
          saleId: sale._id,
          discountType: sale.discountType,
          discountValue: sale.discountValue,
          endTime: sale.endTime,
        },
      };
    });
    return res.status(200).json({
      success: true,
      data: {
        sale: baseSale,
        products,
        total: products.length,
        page: 1,
        pages: 1,
      },
    });
  }

  // applicationType === 'all' — paginate active products and apply discount
  const filter = { isActive: true, status: 'active' };
  if (req.query.category) {
    // best-effort: client passes a category slug
    try {
      const Category = require('../models/CategoryModel');
      const cat = await Category.findOne({ slug: req.query.category }).select('_id').lean();
      if (cat) filter.category = cat._id;
    } catch { /* ignore */ }
  }

  const [docs, total] = await Promise.all([
    Product.find(filter)
      .select('name slug images price comparePrice stock sku brand category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const products = docs.map((p) => {
    const originalPrice = p.price ?? 0;
    const salePrice = computeSalePrice(originalPrice, sale.discountType, sale.discountValue);
    return {
      _id: p._id,
      productId: p._id,
      name: p.name,
      slug: p.slug,
      image: p.images?.[0]?.url || null,
      images: p.images || [],
      sku: p.sku,
      price: salePrice,
      originalPrice,
      comparePrice: originalPrice,
      salePrice,
      stock: p.stock,
      sold: 0,
      brand: p.brand,
      flashSale: {
        saleId: sale._id,
        discountType: sale.discountType,
        discountValue: sale.discountValue,
        endTime: sale.endTime,
      },
    };
  });

  res.status(200).json({
    success: true,
    data: {
      sale: baseSale,
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  });
});

// ─── GET /flash-sales/upcoming ───────────────────────────────────────────────
const getUpcoming = catchAsync(async (req, res) => {
  const now = new Date();

  const sales = await FlashSale.find({
    isActive: true,
    startTime: { $gt: now },
  })
    .select('name slug discountType discountValue startTime endTime totalStock banner priority')
    .sort({ startTime: 1 })
    .limit(10)
    .lean({ virtuals: true });

  res.status(200).json({
    success: true,
    data: sales,
  });
});

// ─── GET /flash-sales/:slug ──────────────────────────────────────────────────
const getBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;

  const sale = await FlashSale.findOne({ slug, isActive: true })
    .select('-userPurchases -createdBy')
    .lean({ virtuals: true });

  if (!sale) throw new AppError('Flash sale not found', 404);

  // For specific type sales, enrich products with their actual slugs from Product collection
  if (sale.applicationType === 'specific' && sale.products && sale.products.length > 0) {
    const productIds = sale.products.map((p) => p.product).filter(Boolean);
    if (productIds.length > 0) {
      const productDocs = await Product.find({ _id: { $in: productIds } })
        .select('_id slug name images')
        .lean();
      const slugMap = productDocs.reduce((acc, doc) => {
        acc[String(doc._id)] = doc;
        return acc;
      }, {});

      sale.products = sale.products.map((p) => {
        const productDoc = slugMap[String(p.product)] || {};
        return {
          ...p,
          slug: productDoc.slug || null,
          image: p.image || productDoc.images?.[0]?.url || null,
        };
      });
    }
  }

  res.status(200).json({
    success: true,
    data: sale,
  });
});

// ─── POST /flash-sales/:id/purchase-check ────────────────────────────────────
// Check if user can purchase from this flash sale (called before checkout)
const purchaseCheck = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid flash sale ID', 400);
  }

  const sale = await FlashSale.findById(req.params.id);
  if (!sale) throw new AppError('Flash sale not found', 404);

  const userId = req.user?._id;
  const check = sale.canUserPurchase(userId);

  // Also check specific product availability
  const { productId } = req.body;
  let productCheck = { ok: true };
  if (productId) {
    const product = sale.products.find(
      (p) => String(p.product) === productId || String(p._id) === productId
    );
    if (!product) {
      productCheck = { ok: false, reason: 'Product not found in this flash sale' };
    } else if (product.stock > 0 && product.sold >= product.stock) {
      productCheck = { ok: false, reason: 'This product is sold out in the flash sale' };
    } else if (product.maxPerUser && userId) {
      // Check per-product per-user limit (simplified — in production, track per product)
      const userEntry = sale.userPurchases.find(
        (up) => String(up.user) === String(userId)
      );
      if (userEntry && userEntry.count >= product.maxPerUser) {
        productCheck = { ok: false, reason: 'You have reached the purchase limit for this product' };
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      canPurchase: check.ok && productCheck.ok,
      saleCheck: check,
      productCheck,
      saleEndsAt: sale.endTime,
      remainingStock: sale.totalStock - sale.soldCount,
    },
  });
});

/* ════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════ */

module.exports = {
  // Admin
  adminGetAll,
  adminGetStats,
  adminGetById,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminToggle,
  adminBulkDelete,
  adminDuplicate,
  adminAddProducts,
  adminRemoveProduct,
  adminUpdateProduct,
  adminGetSaleStats,
  adminGetRevenue,
  // Public
  getActive,
  getUpcoming,
  getBySlug,
  getOfferProducts,
  purchaseCheck,
  // Internal helpers
  computeSalePrice,
};
