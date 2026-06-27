// 📁 PATH: src/controllers/bannerController.js
'use strict';

const AppError    = require('../utils/AppError');
const Banner      = require('../models/BannerModel');
const catchAsync  = require('../utils/catchAsync');

// ─── Whitelisted fields (mass-assignment protection) ─────────────────────────
const ALLOWED_FIELDS = [
  'title', 'subtitle', 'buttonText', 'platform', 'placements', 'placement',
  'status', 'priority', 'image', 'linkType', 'linkValue', 'startsAt', 'endsAt', 'devices',
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

  // Ensure placements is always an array
  if ('placements' in payload && !Array.isArray(payload.placements)) {
    payload.placements = payload.placements ? [payload.placements] : [];
  }

  if (isCreate) {
    payload.status    = payload.status    || 'draft';
    payload.priority  = payload.priority  || 5;
    payload.devices   = payload.devices   || 'all';
    payload.linkType  = payload.linkType  || 'url';
    payload.platform  = payload.platform  || 'both';
    payload.placements = payload.placements || [];
  }

  // Backward compat: if placements array has items, set placement to first one
  if (payload.placements && payload.placements.length > 0 && !payload.placement) {
    payload.placement = payload.placements[0];
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
// Query: search, placement (id|all), status (id|all), platform (web|mobile|both|all)
const adminGetAllBanners = catchAsync(async (req, res) => {
  const { search, placement, status, platform } = req.query;

  const filter = {};

  // Platform filter
  if (platform && platform !== 'all') {
    if (platform === 'web') {
      filter.$or = [{ platform: 'web' }, { platform: 'both' }];
    } else if (platform === 'mobile') {
      filter.$or = [{ platform: 'mobile' }, { platform: 'both' }];
    } else {
      filter.platform = platform;
    }
  }

  // Placement filter — check both legacy `placement` and new `placements` array
  if (placement && placement !== 'all') {
    const placementFilter = {
      $or: [
        { placement: placement },
        { placements: placement },
      ],
    };
    // Merge with existing $or if platform filter created one
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, placementFilter];
      delete filter.$or;
    } else {
      filter.$or = placementFilter.$or;
    }
  }

  if (status && status !== 'all') filter.status = status;

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
// Supports both legacy single placement and new placements array.
const getBannersByPlacement = catchAsync(async (req, res) => {
  const { placement } = req.params;

  if (!Banner.PLACEMENT_IDS.includes(placement)) {
    throw new AppError('Invalid placement', 400);
  }

  const now = new Date();

  const banners = await Banner.find({
    $or: [
      { placement: placement },
      { placements: placement },
    ],
    status: 'live',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null },   { endsAt:   { $gte: now } }] },
    ],
  })
    .sort({ priority: 1 })
    .select('title subtitle buttonText image linkType linkValue devices priority platform placements placement')
    .lean();

  res.status(200).json({ success: true, data: banners });
});

// ─── GET /banners/platform/:platform ─────────────────────────────────────────────
// Returns all live banners for a specific platform (web or mobile)
const getBannersByPlatform = catchAsync(async (req, res) => {
  const { platform } = req.params;

  if (!['web', 'mobile'].includes(platform)) {
    throw new AppError('Invalid platform. Must be "web" or "mobile"', 400);
  }

  const now = new Date();

  const banners = await Banner.find({
    $or: [
      { platform: platform },
      { platform: 'both' },
    ],
    status: 'live',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null },   { endsAt:   { $gte: now } }] },
    ],
  })
    .sort({ priority: 1 })
    .select('title subtitle buttonText image linkType linkValue devices priority platform placements placement')
    .lean();

  res.status(200).json({ success: true, data: banners });
});

// ─── GET /banners/platform/:platform/placement/:placement ────────────────────────
// Returns live banners for a specific platform AND placement
const getBannersByPlatformAndPlacement = catchAsync(async (req, res) => {
  const { platform, placement } = req.params;

  
  if (!['web', 'mobile'].includes(platform)) {
    throw new AppError('Invalid platform. Must be "web" or "mobile"', 400);
  }

  const now = new Date();

  const banners = await Banner.find({
    $or: [
      { platform: platform },
      { platform: 'both' },
    ],
    $and: [
      { $or: [{ placement: placement }, { placements: { $in: [placement] } }] },
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null },   { endsAt:   { $gte: now } }] },
    ],
    status: 'live',
  })
    .sort({ priority: 1 })
    .select('title subtitle buttonText image linkType linkValue devices priority platform placements placement')
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
  getBannersByPlatform,
  getBannersByPlatformAndPlacement,
  trackBannerClick,
  trackBannerImpression,
};