'use strict';

const Quotation = require('../models/QuotationModel');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const catchAsync = require('../utils/catchAsync');

/* ════════════════════════════════════════════════════════
   CUSTOMER ROUTES
════════════════════════════════════════════════════════ */

/**
 * POST /api/quotations
 * Customer creates a new quotation request
 */
exports.createRequest = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { items, notes, companyName, vatNumber, crNumber, contactPerson, contactPhone, address } = req.body;

  // ── Basic validation ──
  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new ApiError(400, 'At least one item is required'));
  }
  if (!companyName || !companyName.trim()) {
    return next(new ApiError(400, 'Company name is required'));
  }
  if (!vatNumber || !vatNumber.trim()) {
    return next(new ApiError(400, 'VAT number is required'));
  }
  if (!contactPerson || !contactPerson.trim()) {
    return next(new ApiError(400, 'Contact person is required'));
  }
  if (!contactPhone || !contactPhone.trim()) {
    return next(new ApiError(400, 'Contact phone is required'));
  }

  // ── Validate items ──
  for (const item of items) {
    if (!item.name || !item.name.trim()) {
      return next(new ApiError(400, 'Each item must have a name'));
    }
    if (!item.qty || item.qty < 1) {
      return next(new ApiError(400, 'Each item must have a quantity of at least 1'));
    }
  }

  const quotation = await Quotation.create({
    userId,
    items: items.map((it) => ({
      productId:    it.productId || null,
      variantId:    it.variantId || null,
      name:         it.name,
      sku:          it.sku || '',
      variantTitle: it.variantTitle || null,
      qty:          it.qty,
      unit:         it.unit || 'pcs',
      specs:        it.specs || [],
      targetPrice:  it.targetPrice || null,
      itemNote:     it.itemNote || '',
      fromDB:       it.fromDB !== undefined ? it.fromDB : false,
      image:        it.image || null,
    })),
    companyInfo: {
      companyName:   companyName.trim(),
      vatNumber:     vatNumber.trim(),
      crNumber:      crNumber || '',
      contactPerson: contactPerson.trim(),
      contactPhone:  contactPhone.trim(),
      address:       address || '',
    },
    notes: notes || '',
  });

  try {
    const { createAdminNotification } = require('./notification.controller');
    await createAdminNotification({
      type: 'system',
      title: 'New Quotation Requested',
      message: `Company: ${companyName} requested quotation for ${items.length} items. Contact: ${contactPerson}`,
      data: { quotationId: quotation._id }
    });
  } catch (err) {
    console.error('Failed to create quotation admin notification:', err);
  }

  return ApiResponse.created(res, quotation, 'Quotation request submitted successfully');
});

/**
 * GET /api/quotations/my
 * Customer sees their own quotations
 */
exports.getMyQuotations = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { userId };
  if (status && status !== 'all') filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Quotation.countDocuments(filter);
  const quotations = await Quotation.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  return ApiResponse.paginated(
    res,
    quotations,
    {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    'Your quotations fetched successfully'
  );
});

/**
 * GET /api/quotations/:id
 * Customer gets a single quotation detail
 */
exports.getById = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { id } = req.params;

  const quotation = await Quotation.findOne({ _id: id, userId }).lean();
  if (!quotation) {
    return next(new ApiError(404, 'Quotation not found'));
  }

  return ApiResponse.success(res, quotation);
});

/**
 * PATCH /api/quotations/:id/accept
 * Customer accepts an approved quotation
 */
exports.acceptQuotation = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { id } = req.params;

  const quotation = await Quotation.findOne({ _id: id, userId });
  if (!quotation) {
    return next(new ApiError(404, 'Quotation not found'));
  }
  if (quotation.status !== 'approved') {
    return next(new ApiError(400, 'Only approved quotations can be accepted'));
  }

  quotation.status = 'accepted';
  await quotation.save();

  return ApiResponse.success(res, quotation, 'Quotation accepted successfully');
});

/**
 * PATCH /api/quotations/:id/reject
 * Customer rejects an approved quotation
 */
exports.rejectQuotation = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { id } = req.params;

  const quotation = await Quotation.findOne({ _id: id, userId });
  if (!quotation) {
    return next(new ApiError(404, 'Quotation not found'));
  }
  if (quotation.status !== 'approved') {
    return next(new ApiError(400, 'Only approved quotations can be rejected'));
  }

  quotation.status = 'rejected';
  await quotation.save();

  return ApiResponse.success(res, quotation, 'Quotation rejected');
});

/* ════════════════════════════════════════════════════════
   ADMIN ROUTES
════════════════════════════════════════════════════════ */

/**
 * GET /api/admin/quotations/stats
 * Admin gets quotation statistics
 */
exports.adminStats = catchAsync(async (req, res, next) => {
  const stats = await Quotation.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    pending: 0,
    approved: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
  };

  stats.forEach((s) => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  return ApiResponse.success(res, result);
});

/**
 * GET /api/admin/quotations
 * Admin gets all quotations with filters
 */
exports.adminGetAll = catchAsync(async (req, res, next) => {
  const { status, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status && status !== 'all') filter.status = status;

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { quotationNumber: { $regex: s, $options: 'i' } },
      { 'companyInfo.companyName': { $regex: s, $options: 'i' } },
      { 'companyInfo.contactPerson': { $regex: s, $options: 'i' } },
      { 'companyInfo.contactPhone': { $regex: s, $options: 'i' } },
      { 'companyInfo.vatNumber': { $regex: s, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Quotation.countDocuments(filter);
  const quotations = await Quotation.find(filter)
    .populate('userId', 'firstName lastName email phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  // Map to include customer info from populated user
  const mapped = quotations.map((q) => ({
    ...q,
    id: q._id,
    customer: q.userId
      ? {
          name: `${q.userId.firstName || ''} ${q.userId.lastName || ''}`.trim(),
          email: q.userId.email || '',
          phone: q.userId.phone || '',
        }
      : null,
  }));

  return ApiResponse.paginated(
    res,
    mapped,
    {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    'Quotations fetched successfully'
  );
});

/**
 * GET /api/admin/quotations/:id
 * Admin gets a single quotation detail
 */
exports.adminGetById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const quotation = await Quotation.findById(id)
    .populate('userId', 'firstName lastName email phone')
    .lean();

  if (!quotation) {
    return next(new ApiError(404, 'Quotation not found'));
  }

  const mapped = {
    ...quotation,
    id: quotation._id,
    customer: quotation.userId
      ? {
          name: `${quotation.userId.firstName || ''} ${quotation.userId.lastName || ''}`.trim(),
          email: quotation.userId.email || '',
          phone: quotation.userId.phone || '',
        }
      : null,
  };

  return ApiResponse.success(res, mapped);
});

/**
 * PATCH /api/admin/quotations/:id/approve
 * Admin approves a quotation with per-item pricing
 */
exports.adminApprove = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { items, subtotal, tax, shipping, total, note, validDays } = req.body;

  const quotation = await Quotation.findById(id);
  if (!quotation) {
    return next(new ApiError(404, 'Quotation not found'));
  }
  if (quotation.status !== 'pending') {
    return next(new ApiError(400, 'Only pending quotations can be approved'));
  }

  // ── Update items with pricing ──
  if (items && Array.isArray(items)) {
    quotation.items = items.map((it, idx) => {
      const existing = quotation.items[idx] || {};
      return {
        ...existing.toObject ? existing.toObject() : existing,
        ...it,
      };
    });
  }

  // ── Update totals ──
  quotation.subtotal = subtotal || 0;
  quotation.tax = tax || 0;
  quotation.shipping = shipping || 0;
  quotation.total = total || 0;
  quotation.adminNote = note || '';
  quotation.approvedAt = new Date();
  quotation.validUntil = new Date(Date.now() + (validDays || 7) * 86400000);
  quotation.status = 'approved';

  await quotation.save();

  return ApiResponse.success(res, quotation, 'Quotation approved and sent to customer');
});

/**
 * PATCH /api/admin/quotations/:id/reject
 * Admin rejects a quotation
 */
exports.adminReject = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { note } = req.body;

  const quotation = await Quotation.findById(id);
  if (!quotation) {
    return next(new ApiError(404, 'Quotation not found'));
  }
  if (quotation.status !== 'pending') {
    return next(new ApiError(400, 'Only pending quotations can be rejected'));
  }

  quotation.status = 'rejected';
  quotation.adminNote = note || '';
  await quotation.save();

  return ApiResponse.success(res, quotation, 'Quotation rejected');
});

/**
 * PATCH /api/admin/quotations/:id/expire
 * Admin marks a quotation as expired
 */
exports.adminExpire = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const quotation = await Quotation.findById(id);
  if (!quotation) {
    return next(new ApiError(404, 'Quotation not found'));
  }
  if (quotation.status !== 'approved') {
    return next(new ApiError(400, 'Only approved quotations can be expired'));
  }

  quotation.status = 'expired';
  await quotation.save();

  return ApiResponse.success(res, quotation, 'Quotation marked as expired');
});