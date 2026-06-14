// 📁 PATH: src/controllers/coupon.controller.js
'use strict';

const mongoose = require('mongoose');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const CouponModel = require('../models/CouponModel');


/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

const ALLOWED_FIELDS = [
  'code', 'description', 'type', 'value', 'minOrderAmount',
  'maxDiscountAmount', 'applicableTo', 'applicableIds',
  'maxUses', 'maxUsesPerUser',
  'startDate', 'expiresAt', 'isActive',
];

function sanitizePayload(body = {}, { isCreate = false } = {}) {
  const payload = {};

  ALLOWED_FIELDS.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });

  if ('startDate' in payload && payload.startDate === '') payload.startDate = null;
  if ('expiresAt' in payload && payload.expiresAt === '') payload.expiresAt = null;
  if ('maxUses'   in payload && payload.maxUses   === '') payload.maxUses   = null;

  if ('applicableTo' in payload) {
    if (payload.applicableTo === 'all')      { payload.applicableIds = []; }
    if (payload.applicableTo === 'product')  { payload.applicableIds = payload.applicableIds ?? []; }
    if (payload.applicableTo === 'category') { payload.applicableIds = payload.applicableIds ?? []; }
  }

  if (isCreate) {
    payload.isActive       = payload.isActive       ?? true;
    payload.maxUsesPerUser = payload.maxUsesPerUser  ?? 1;
    payload.applicableTo   = payload.applicableTo    ?? 'all';
    payload.type           = payload.type            ?? 'percent';
  }

  return payload;
}

function buildFilter(query) {
  const { search, type, isActive, applicableTo, status } = query;
  const filter = {};
  const now = new Date();

  if (type         && type         !== 'all') filter.type        = type;
  if (applicableTo && applicableTo !== 'all') filter.applicableTo = applicableTo;

  if (isActive !== undefined && isActive !== 'all') {
    filter.isActive = isActive === 'true';
  }

  if (status && status !== 'all') {
    switch (status) {
      case 'active':
        filter.isActive = true;
        filter.$and = [
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        ];
        break;
      case 'expired':
        filter.expiresAt = { $lt: now };
        break;
      case 'scheduled':
        filter.startDate = { $gt: now };
        break;
      case 'exhausted':
        filter.$expr = { $and: [
          { $ne: ['$maxUses', null] },
          { $gte: ['$usedCount', '$maxUses'] },
        ]};
        break;
    }
  }

  if (search) {
    filter.$or = [
      { code:        new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
    ];
  }

  return filter;
}

function calcStats(coupons) {
  const now = new Date();
  return {
    total:     coupons.length,
    active:    coupons.filter((c) => c.isActive && (!c.expiresAt || c.expiresAt > now) && (!c.startDate || c.startDate <= now)).length,
    expired:   coupons.filter((c) => c.expiresAt && c.expiresAt < now).length,
    scheduled: coupons.filter((c) => c.startDate && c.startDate > now).length,
    inactive:  coupons.filter((c) => !c.isActive).length,
    totalUsed: coupons.reduce((s, c) => s + (c.usedCount || 0), 0),
    byType: {
      percent:  coupons.filter((c) => c.type === 'percent').length,
      fixed:    coupons.filter((c) => c.type === 'fixed').length,
      shipping: coupons.filter((c) => c.type === 'shipping').length,
    },
  };
}

/* ════════════════════════════════════════════════════════════
   ADMIN CONTROLLERS
════════════════════════════════════════════════════════════ */

// ─── GET /admin/coupons ───────────────────────────────────────────────────────
const adminGetAllCoupons = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const filter = buildFilter(req.query);

  const [coupons, total] = await Promise.all([
    CouponModel.find(filter)
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean({ virtuals: true }),
    CouponModel.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      coupons,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

// ─── GET /admin/coupons/stats ─────────────────────────────────────────────────
const adminGetCouponStats = catchAsync(async (req, res) => {
  const coupons = await CouponModel.find({}).lean({ virtuals: true });
  const stats   = calcStats(coupons);

  res.status(200).json({ success: true, data: stats });
});

// ─── GET /admin/coupons/generate-code ────────────────────────────────────────
const adminGenerateCode = catchAsync(async (req, res) => {
  const code = await CouponModel.generateUniqueCode(Number(req.query.length) || 8);
  res.status(200).json({ success: true, data: { code } });
});

// ─── GET /admin/coupons/:id ───────────────────────────────────────────────────
const adminGetCouponById = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid coupon ID', 400);
  }

  const coupon = await CouponModel.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email')
    .lean({ virtuals: true });

  if (!coupon) throw new AppError('Coupon not found', 404);

  res.status(200).json({ success: true, data: coupon });
});

// ─── POST /admin/coupons ──────────────────────────────────────────────────────
const adminCreateCoupon = catchAsync(async (req, res) => {
  const payload = sanitizePayload(req.body, { isCreate: true });

  if (payload.code) payload.code = payload.code.toUpperCase();
  if (req.user?._id) payload.createdBy = req.user._id;

  const coupon = await CouponModel.create(payload);
  const result = await CouponModel.findById(coupon._id).lean({ virtuals: true });

  res.status(201).json({
    success: true,
    message: 'Coupon created successfully',
    data: result,
  });
});

// ─── PUT /admin/coupons/:id ───────────────────────────────────────────────────
const adminUpdateCoupon = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid coupon ID', 400);
  }

  const payload = sanitizePayload(req.body, { isCreate: false });
  delete payload.usedCount;

  if (payload.code) payload.code = payload.code.toUpperCase();

  const coupon = await CouponModel.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean({ virtuals: true });

  if (!coupon) throw new AppError('Coupon not found', 404);

  res.status(200).json({
    success: true,
    message: 'Coupon updated successfully',
    data: coupon,
  });
});

// ─── DELETE /admin/coupons/:id ────────────────────────────────────────────────
const adminDeleteCoupon = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid coupon ID', 400);
  }

  const coupon = await CouponModel.findByIdAndDelete(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);

  res.status(200).json({
    success: true,
    message: 'Coupon deleted successfully',
    data: null,
  });
});

// ─── PATCH /admin/coupons/:id/toggle-status ──────────────────────────────────
const adminToggleCouponStatus = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid coupon ID', 400);
  }

  const coupon = await CouponModel.findById(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  res.status(200).json({
    success: true,
    message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { isActive: coupon.isActive },
  });
});

// ─── DELETE /admin/coupons (bulk) ─────────────────────────────────────────────
const adminBulkDeleteCoupons = catchAsync(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Provide an array of coupon IDs to delete', 400);
  }

  const invalidIds = ids.filter((id) => !mongoose.isValidObjectId(id));
  if (invalidIds.length > 0) {
    throw new AppError(`Invalid IDs: ${invalidIds.join(', ')}`, 400);
  }

  const result = await CouponModel.deleteMany({ _id: { $in: ids } });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} coupon(s) deleted successfully`,
    data: { deletedCount: result.deletedCount },
  });
});

// ─── GET /admin/coupons/:id/usage ─────────────────────────────────────────────
const adminGetCouponUsage = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError('Invalid coupon ID', 400);
  }

  const coupon = await CouponModel.findById(req.params.id)
    .populate('redemptions.user', 'firstName lastName email')
    .lean({ virtuals: true });

  if (!coupon) throw new AppError('Coupon not found', 404);

  res.status(200).json({
    success: true,
    data: {
      code:         coupon.code,
      usedCount:    coupon.usedCount,
      maxUses:      coupon.maxUses,
      redemptions:  coupon.redemptions,
    },
  });
});

/* ════════════════════════════════════════════════════════════
   PUBLIC / CUSTOMER CONTROLLERS
════════════════════════════════════════════════════════════ */

// ─── POST /coupons/validate ───────────────────────────────────────────────────
const validateCoupon = catchAsync(async (req, res) => {
  const { code, orderAmount = 0 } = req.body;

  if (!code) throw new AppError('Coupon code is required', 400);

  const coupon = await CouponModel.findOne({ code: code.toUpperCase().trim() });
  if (!coupon) throw new AppError('Invalid coupon code', 404);

  const userId = req.user?._id ?? null;
  const usable = coupon.isUsable(userId);

  if (!usable.ok) {
    return res.status(400).json({
      success: false,
      message: usable.reason,
      data: null,
    });
  }

  if (Number(orderAmount) < coupon.minOrderAmount) {
    return res.status(400).json({
      success: false,
      message: `Minimum order amount is ${coupon.minOrderAmount}`,
      data: null,
    });
  }

  const discount = coupon.calculateDiscount(Number(orderAmount));

  res.status(200).json({
    success: true,
    message: 'Coupon applied successfully',
    data: {
      couponId:    coupon._id,
      code:        coupon.code,
      type:        coupon.type,
      value:       coupon.value,
      discount,
      finalAmount: Math.max(0, Number(orderAmount) - discount),
    },
  });
});

// ─── POST /coupons/apply ──────────────────────────────────────────────────────
const applyCoupon = catchAsync(async (req, res) => {
  const { code, orderAmount = 0 } = req.body;

  if (!code) throw new AppError('Coupon code is required', 400);

  const coupon = await CouponModel.findOne({ code: code.toUpperCase().trim() });
  if (!coupon) throw new AppError('Invalid coupon code', 404);

  const userId = req.user?._id ?? null;
  const usable = coupon.isUsable(userId);

  if (!usable.ok) {
    return res.status(400).json({ success: false, message: usable.reason, data: null });
  }

  if (Number(orderAmount) < coupon.minOrderAmount) {
    return res.status(400).json({
      success: false,
      message: `Minimum order amount is ${coupon.minOrderAmount}`,
      data: null,
    });
  }

  const discount = coupon.calculateDiscount(Number(orderAmount));

  // Record redemption
  coupon.usedCount += 1;
  coupon.redemptions.push({ user: userId, amount: discount, at: new Date() });
  await coupon.save();

  res.status(200).json({
    success: true,
    message: 'Coupon redeemed successfully',
    data: {
      couponId:    coupon._id,
      code:        coupon.code,
      type:        coupon.type,
      value:       coupon.value,
      discount,
      finalAmount: Math.max(0, Number(orderAmount) - discount),
    },
  });
});

/* ════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════ */

module.exports = {
  adminGetAllCoupons,
  adminGetCouponStats,
  adminGenerateCode,
  adminGetCouponById,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
  adminToggleCouponStatus,
  adminBulkDeleteCoupons,
  adminGetCouponUsage,
  validateCoupon,
  applyCoupon,
};