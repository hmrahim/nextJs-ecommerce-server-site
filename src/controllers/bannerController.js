// 📁 PATH: src/controllers/bannerController.js
'use strict';

const AppError    = require('../utils/AppError');
const Banner      = require('../models/BannerModel');
const catchAsync  = require('../utils/catchAsync');

// ─── Whitelisted fields (mass-assignment protection) ─────────────────────────
const ALLOWED_FIELDS = [
  'title', 'subtitle', 'buttonText', 'placement', 'status', 'priority',
  'image', 'linkType', 'linkValue', 'startsAt', 'endsAt', 'devices',
];

function sanitizePayload(body = {}, { isCreate = false } = {}) {
  const payload = {};

  ALLOWED_FIELDS.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });

  // Normalize empty-string dates to null so Mongoose Date casting doesn't fail
  if ('startsAt' in payload && payload.startsAt === '') payload.startsAt = null;
  if ('endsAt'   in payload && payload.endsAt   === '') payload.endsAt   = null;

  // linkValue must be empty when linkType is "none"
  if (payload.linkType === 'none') payload.linkValue = '';

  if (isCreate) {
    payload.status    = payload.status    || 'draft';
    payload.priority  = payload.priority  || 5;
    payload.devices   = payload.devices   || 'all';
    payload.linkType  = payload.linkType  || 'url';
  }

  return payload;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcStats(banners) {
  return {
    total:       banners.length,
    live:        banners.filter((b) => b.status === 'live').length,
    scheduled:   banners.filter((b) => b.status === 'scheduled').length,
    paused:      banners.filter((b) => b.status === 'paused').length,
    expired:     banners.filter((b) => b.status === 'expired').length,
    draft:       banners.filter((b) => b.status === 'draft').length,
    clicks:      banners.reduce((s, b) => s + (b.clicks || 0), 0),
    impressions: banners.reduce((s, b) => s + (b.impressions || 0), 0),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /admin/banners ────────────────────────────────────────────────────────
// Query: search, placement (id|all), status (id|all)
const adminGetAllBanners = catchAsync(async (req, res) => {
  const { search, placement, status } = req.query;

  const filter = {};

  if (placement && placement !== 'all') filter.placement = placement;
  if (status    && status    !== 'all') filter.status    = status;

  if (search) {
    filter.title = new RegExp(search, 'i');
  }

  const banners = await Banner.find(filter)
    .sort({ priority: 1, createdAt: -1 })
    .lean({ virtuals: true });

  const stats = calcStats(banners);

  res.status(200).json({ success: true, data: { banners, stats } });
});

// ─── GET /admin/banners/stats ──────────────────────────────────────────────────
const adminGetBannerStats = catchAsync(async (req, res) => {
  const banners = await Banner.find({}).lean({ virtuals: true });
  const stats   = calcStats(banners);

  res.status(200).json({ success: true, data: stats });
});

// ─── GET /admin/banners/:id ─────────────────────────────────────────────────────
const adminGetBannerById = catchAsync(async (req, res) => {
  const banner = await Banner.findById(req.params.id).lean({ virtuals: true });
  if (!banner) throw new AppError('Banner not found', 404);

  res.status(200).json({ success: true, data: banner });
});

// ─── POST /admin/banners ────────────────────────────────────────────────────────
const adminCreateBanner = catchAsync(async (req, res) => {
  const payload = sanitizePayload(req.body, { isCreate: true });

  const banner = await Banner.create(payload);

  res.status(201).json({ success: true, data: banner.toJSON({ virtuals: true }) });
});

// ─── PUT /admin/banners/:id ──────────────────────────────────────────────────────
const adminUpdateBanner = catchAsync(async (req, res) => {
  const payload = sanitizePayload(req.body, { isCreate: false });

  const banner = await Banner.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { new: true, runValidators: true, context: 'query' }
  );

  if (!banner) throw new AppError('Banner not found', 404);

  res.status(200).json({ success: true, data: banner.toJSON({ virtuals: true }) });
});

// ─── DELETE /admin/banners/:id ───────────────────────────────────────────────────
const adminDeleteBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  res.status(200).json({ success: true, data: null });
});

// ─── PATCH /admin/banners/:id/toggle-status  (live ⇄ paused) ────────────────────
const adminToggleBannerStatus = catchAsync(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError('Banner not found', 404);

  banner.status = banner.status === 'live' ? 'paused' : 'live';
  await banner.save();

  res.status(200).json({ success: true, data: banner.toJSON({ virtuals: true }) });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /banners/:placement ─────────────────────────────────────────────────────
// Returns active (live, within schedule window) banners for a given placement,
// sorted by priority — for storefront rendering.
const getBannersByPlacement = catchAsync(async (req, res) => {
  const { placement } = req.params;

  if (!Banner.PLACEMENT_IDS.includes(placement)) {
    throw new AppError('Invalid placement', 400);
  }

  const now = new Date();

  const banners = await Banner.find({
    placement,
    status: 'live',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null },   { endsAt:   { $gte: now } }] },
    ],
  })
    .sort({ priority: 1 })
    .select('title subtitle buttonText image linkType linkValue devices priority')
    .lean();

  res.status(200).json({ success: true, data: banners });
});

// ─── PATCH /banners/:id/click  (increment click counter) ─────────────────────────
const trackBannerClick = catchAsync(async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(
    req.params.id,
    { $inc: { clicks: 1 } },
    { new: true }
  );
  if (!banner) throw new AppError('Banner not found', 404);

  res.status(200).json({ success: true, data: { clicks: banner.clicks } });
});

// ─── PATCH /banners/:id/impression  (increment impression counter) ───────────────
const trackBannerImpression = catchAsync(async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(
    req.params.id,
    { $inc: { impressions: 1 } },
    { new: true }
  );
  if (!banner) throw new AppError('Banner not found', 404);

  res.status(200).json({ success: true, data: { impressions: banner.impressions } });
});

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // admin
  adminGetAllBanners,
  adminGetBannerStats,
  adminGetBannerById,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  adminToggleBannerStatus,
  // public
  getBannersByPlacement,
  trackBannerClick,
  trackBannerImpression,
};
