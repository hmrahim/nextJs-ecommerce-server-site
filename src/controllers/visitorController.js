// 📁 PATH: src/controllers/visitorController.js
'use strict';

const Visitor = require('../models/Visitor.model');
const { emitChange } = require('../utils/socket');
const {
  getClientIp,
  parseUserAgent,
  classifySource,
  currencyForCountry,
  lookupGeo,
  reverseGeocode,
} = require('../utils/visitorMeta');

const MAX_PAGES_STORED = 50;
const ONLINE_MS = 2 * 60 * 1000;   // 2 min
const IDLE_MS   = 15 * 60 * 1000;  // 15 min

/* ─────────────────────────────────────────────────────────────
   Small helpers
───────────────────────────────────────────────────────────── */
function deriveStatus(lastActiveAt) {
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  if (diff <= ONLINE_MS) return 'online';
  if (diff <= IDLE_MS) return 'idle';
  return 'offline';
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${String(rem).padStart(2, '0')}s`;
}

function timeAgo(date) {
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day > 1 ? 's' : ''} ago`;
}

function flagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  return countryCode
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function pageTitleFromPath(path) {
  if (!path || path === '/') return 'Homepage';
  const seg = path.split('/').filter(Boolean).pop() || '';
  return seg
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// range query param → { start, end, prevStart, prevEnd }
function getRangeDates(range = '7d') {
  const days = range === '1d' ? 1 : range === '30d' ? 30 : range === '90d' ? 90 : 7;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const prevEnd = new Date(start);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);
  return { start, end, prevStart, prevEnd, days };
}

function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* Maps a raw Visitor doc → exact shape the admin frontend renders */
function serialize(v) {
  const durationSec = Math.max(0, (new Date(v.lastActiveAt) - new Date(v.firstSeenAt)) / 1000);
  return {
    id: String(v._id),
    ip: v.ip || 'Unknown',
    country: `${flagEmoji(v.countryCode)} ${v.country}`,
    city: v.city,
    region: v.region || 'Unknown',
    device: v.device,
    os: v.os,
    browser: v.browser,
    source: v.source,
    page: v.exitPage,
    duration: formatDuration(durationSec),
    bounce: v.pagesVisited <= 1,
    time: timeAgo(v.lastActiveAt),
    status: deriveStatus(v.lastActiveAt),

    lat: v.lat,
    lng: v.lng,
    streetAddress: v.streetAddress || null,
    timezone: v.timezone,
    isp: v.isp || 'Unknown',
    postalCode: v.postalCode || '—',
    currency: v.currency,

    pagesVisited: v.pagesVisited,
    entryPage: v.entryPage,
    exitPage: v.exitPage,

    scrollDepth: `${v.scrollDepth || 0}%`,
    clickCount: v.clickCount,
    cartAdded: v.cartAdded,
    purchased: v.purchased,

    screenResolution: v.screenResolution || 'Unknown',
    connectionType: v.connectionType || 'Unknown',
    language: v.language || 'Unknown',
    referrerUrl: v.referrerUrl,

    isRegistered: v.isRegistered,
    userId: v.userId ? String(v.userId) : null,
    email: v.email,

    pages: v.pages || [],
    isReturning: v.isReturning,
    visitCount: v.visitCount,
  };
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC — tracking endpoints (no auth, no browser permission
   prompts; geo comes from server-side IP lookup, not the
   navigator.geolocation API)
═══════════════════════════════════════════════════════════ */

// POST /track/visit  — called on every page view from the frontend
exports.trackVisit = async (req, res) => {
  try {
    const sessionId = req.headers['x-visitor-session-id'] || req.headers['x-session-id'] || req.body.sessionId;
    if (!sessionId) return res.status(200).json({ success: false, message: 'No session id' });

    const {
      path = '/',
      referrer = null,
      screenResolution = null,
      connectionType = null,
      language = null,
      ip: bodyIp = null,
    } = req.body;

    const ip = bodyIp || getClientIp(req);
    const { device, os, browser } = parseUserAgent(req.headers['user-agent'] || '');
    const source = classifySource(referrer, req.headers.host);

    const existing = await Visitor.findOne({ sessionId }).select('_id').lean();

    let update = {
      $set: {
        lastActiveAt: new Date(),
        exitPage: path,
        device, os, browser,
        screenResolution, connectionType, language,
      },
      $inc: { pagesVisited: 1 },
      $push: {
        pages: {
          $each: [{ path, at: new Date() }],
          $slice: -MAX_PAGES_STORED,
        },
      },
    };

    if (!existing) {
      const geo = await lookupGeo(ip);
      const currency = currencyForCountry(geo.countryCode);

      let streetAddress = null;
      if (geo.lat && geo.lng) {
        streetAddress = await reverseGeocode(geo.lat, geo.lng);
      }

      // Best-effort "returning visitor" check — same identity seen before
      const identityQuery = req.user
        ? { userId: req.user._id }
        : ip
          ? { ip, userId: null }
          : null;
      const priorCount = identityQuery ? await Visitor.countDocuments(identityQuery) : 0;

      update.$setOnInsert = {
        sessionId,
        ip,
        ...geo,
        streetAddress,
        currency,
        source,
        referrerUrl: referrer,
        entryPage: path,
        firstSeenAt: new Date(),
        userId: req.user?._id || null,
        email: req.user?.email || null,
        isRegistered: !!req.user,
        visitCount: priorCount + 1,
        isReturning: priorCount > 0,
      };
    } else if (req.user) {
      // session started as guest, then logged in mid-session — backfill identity
      update.$set.userId = req.user._id;
      update.$set.email = req.user.email;
      update.$set.isRegistered = true;
    }

    const doc = await Visitor.findOneAndUpdate({ sessionId }, update, { upsert: true, new: true }).lean();

    // Notify admins of visitor activity
    emitChange('Visitor', 'update', { id: doc._id });

    return res.status(200).json({
      success: true,
      geo: {
        city: doc.city || 'Unknown',
        postalCode: doc.postalCode || '',
        country: doc.country || '',
        streetAddress: doc.streetAddress || null
      }
    });
  } catch (err) {
    // Tracking must never break the site — log and move on.
    console.error('trackVisit error:', err.message);
    return res.status(200).json({ success: false });
  }
};

// POST /track/event — scroll depth / click count / cart / purchase pings
exports.trackEvent = async (req, res) => {
  try {
    const sessionId = req.headers['x-visitor-session-id'] || req.headers['x-session-id'] || req.body.sessionId;
    if (!sessionId) return res.status(200).json({ success: false });

    const { type, value } = req.body;
    const update = { $set: { lastActiveAt: new Date() } };

    switch (type) {
      case 'scroll':
        await Visitor.updateOne(
          { sessionId, scrollDepth: { $lt: Number(value) || 0 } },
          { $set: { scrollDepth: Math.min(100, Number(value) || 0), lastActiveAt: new Date() } }
        );
        emitChange('Visitor', 'update');
        return res.status(200).json({ success: true });
      case 'gps_coords':
        if (value && value.includes(',')) {
          const [latStr, lngStr] = value.split(',');
          const lat = Number(latStr);
          const lng = Number(lngStr);
          if (!isNaN(lat) && !isNaN(lng)) {
            const streetAddress = await reverseGeocode(lat, lng);
            await Visitor.updateOne(
              { sessionId },
              { $set: { lat, lng, streetAddress, lastActiveAt: new Date() } }
            );
            emitChange('Visitor', 'update');
            return res.status(200).json({ success: true });
          }
        }
        return res.status(200).json({ success: false, message: 'Invalid coordinates' });
      case 'click':
        update.$inc = { clickCount: 1 };
        break;
      case 'cart':
        update.$set.cartAdded = true;
        break;
      case 'purchase':
        update.$set.purchased = true;
        break;
      default:
        return res.status(200).json({ success: false, message: 'Unknown event type' });
    }

    await Visitor.updateOne({ sessionId }, update);
    emitChange('Visitor', 'update');
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('trackEvent error:', err.message);
    return res.status(200).json({ success: false });
  }
};

/* ═══════════════════════════════════════════════════════════
   ADMIN — read/manage endpoints
═══════════════════════════════════════════════════════════ */

// GET /admin/visitors
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = '',
      device, source, status, range = '7d',
    } = req.query;

    const { start, end } = getRangeDates(range);
    const match = { lastActiveAt: { $gte: start, $lte: end } };

    if (device && device !== 'all') match.device = new RegExp(`^${device}$`, 'i');
    if (source && source !== 'all') match.source = source;

    if (search) {
      const re = new RegExp(search, 'i');
      match.$or = [{ ip: re }, { city: re }, { country: re }, { exitPage: re }, { entryPage: re }];
    }

    let docs = await Visitor.find(match).sort({ lastActiveAt: -1 }).lean();

    // status is derived, so filter after fetch
    if (status && status !== 'all') {
      docs = docs.filter((d) => deriveStatus(d.lastActiveAt) === status);
    }

    const total = docs.length;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const paged = docs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({
      data: {
        visitors: paged.map(serialize),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  } catch (err) {
    console.error('getAll visitors error:', err);
    return res.status(500).json({ message: 'Failed to load visitors' });
  }
};

// GET /admin/visitors/:id
exports.getById = async (req, res) => {
  try {
    const v = await Visitor.findById(req.params.id).lean();
    if (!v) return res.status(404).json({ message: 'Visitor not found' });
    return res.json({ data: serialize(v) });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load visitor' });
  }
};

// GET /admin/visitors/stats
exports.getStats = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const { start, end, prevStart, prevEnd } = getRangeDates(range);

    const [curr, prev, liveNow] = await Promise.all([
      Visitor.find({ lastActiveAt: { $gte: start, $lte: end } }).select('ip pagesVisited firstSeenAt lastActiveAt').lean(),
      Visitor.find({ lastActiveAt: { $gte: prevStart, $lte: prevEnd } }).select('ip').lean(),
      Visitor.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - ONLINE_MS) } }),
    ]);

    const totalVisitors = curr.length;
    const uniqueVisitors = new Set(curr.map((v) => v.ip)).size;
    const pageViews = curr.reduce((s, v) => s + (v.pagesVisited || 0), 0);
    const bounces = curr.filter((v) => (v.pagesVisited || 0) <= 1).length;
    const bounceRate = totalVisitors ? round2((bounces / totalVisitors) * 100) : 0;
    const avgSessionSec = totalVisitors
      ? curr.reduce((s, v) => s + Math.max(0, (new Date(v.lastActiveAt) - new Date(v.firstSeenAt)) / 1000), 0) / totalVisitors
      : 0;

    const prevTotal = prev.length;
    const prevUnique = new Set(prev.map((v) => v.ip)).size;

    return res.json({
      data: {
        totalVisitors,
        uniqueVisitors,
        pageViews,
        avgSession: formatDuration(avgSessionSec),
        bounceRate,
        liveNow,
        totalChange:    `${pctChange(totalVisitors, prevTotal) >= 0 ? '+' : ''}${pctChange(totalVisitors, prevTotal)}%`,
        uniqueChange:   `${pctChange(uniqueVisitors, prevUnique) >= 0 ? '+' : ''}${pctChange(uniqueVisitors, prevUnique)}%`,
        pageViewChange: `${pctChange(pageViews, prevTotal) >= 0 ? '+' : ''}${pctChange(pageViews, prevTotal)}%`,
        bounceChange:   `${pctChange(bounceRate, 0) >= 0 ? '+' : ''}0%`,
      },
    });
  } catch (err) {
    console.error('getStats error:', err);
    return res.status(500).json({ message: 'Failed to load visitor stats' });
  }
};

// GET /admin/visitors/top-pages
exports.getTopPages = async (req, res) => {
  try {
    const { range = '7d', limit = 6 } = req.query;
    const { start, end } = getRangeDates(range);

    const rows = await Visitor.aggregate([
      { $match: { lastActiveAt: { $gte: start, $lte: end } } },
      { $unwind: '$pages' },
      { $match: { 'pages.at': { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$pages.path',
          views: { $sum: 1 },
          sessions: { $addToSet: '$sessionId' },
          bounceSessions: { $sum: { $cond: [{ $lte: ['$pagesVisited', 1] }, 1, 0] } },
          avgDurationSec: { $avg: { $divide: [{ $subtract: ['$lastActiveAt', '$firstSeenAt'] }, 1000] } },
        },
      },
      { $project: {
          path: '$_id', views: 1,
          bounceRate: { $multiply: [{ $divide: ['$bounceSessions', { $size: '$sessions' }] }, 100] },
          avgDurationSec: 1,
        } },
      { $sort: { views: -1 } },
      { $limit: Number(limit) },
    ]);

    const data = rows.map((r) => ({
      path: r.path,
      title: pageTitleFromPath(r.path),
      views: r.views,
      bounce: `${Math.round(r.bounceRate || 0)}%`,
      avgTime: formatDuration(r.avgDurationSec || 0),
    }));

    return res.json({ data });
  } catch (err) {
    console.error('getTopPages error:', err);
    return res.status(500).json({ message: 'Failed to load top pages' });
  }
};

// GET /admin/visitors/by-country
exports.getByCountry = async (req, res) => {
  try {
    const { range = '7d', limit = 5 } = req.query;
    const { start, end } = getRangeDates(range);

    const rows = await Visitor.aggregate([
      { $match: { lastActiveAt: { $gte: start, $lte: end } } },
      { $group: { _id: { country: '$country', countryCode: '$countryCode', city: '$city' }, visitors: { $sum: 1 } } },
      { $sort: { visitors: -1 } },
      { $limit: Number(limit) },
    ]);

    const total = rows.reduce((s, r) => s + r.visitors, 0) || 1;
    const data = rows.map((r) => ({
      flag: flagEmoji(r._id.countryCode),
      country: r._id.country,
      city: r._id.city,
      visitors: r.visitors,
      pct: round2((r.visitors / total) * 100),
    }));

    return res.json({ data });
  } catch (err) {
    console.error('getByCountry error:', err);
    return res.status(500).json({ message: 'Failed to load visitors by country' });
  }
};

const CHART_COLORS = { Mobile: '#6c63ff', Desktop: '#38bdf8', Tablet: '#34d399' };
// GET /admin/visitors/by-device
exports.getByDevice = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const { start, end } = getRangeDates(range);

    const rows = await Visitor.aggregate([
      { $match: { lastActiveAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = rows.reduce((s, r) => s + r.count, 0) || 1;
    const data = rows.map((r) => ({
      label: r._id,
      count: r.count,
      pct: Math.round((r.count / total) * 100),
      color: CHART_COLORS[r._id] || '#94a3b8',
    }));

    return res.json({ data });
  } catch (err) {
    console.error('getByDevice error:', err);
    return res.status(500).json({ message: 'Failed to load visitors by device' });
  }
};

const SOURCE_COLORS = {
  Direct: '#6c63ff', 'Organic Search': '#38bdf8', 'Social Media': '#f472b6',
  Referral: '#34d399', Email: '#fbbf24',
};
// GET /admin/visitors/by-source
exports.getBySource = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const { start, end } = getRangeDates(range);

    const rows = await Visitor.aggregate([
      { $match: { lastActiveAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = rows.reduce((s, r) => s + r.count, 0) || 1;
    const data = rows.map((r) => ({
      label: r._id,
      count: r.count,
      pct: Math.round((r.count / total) * 100),
      color: SOURCE_COLORS[r._id] || '#94a3b8',
    }));

    return res.json({ data });
  } catch (err) {
    console.error('getBySource error:', err);
    return res.status(500).json({ message: 'Failed to load visitors by source' });
  }
};

// GET /admin/visitors/live
exports.getLiveCount = async (req, res) => {
  try {
    const liveNow = await Visitor.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - ONLINE_MS) } });
    return res.json({ data: { liveNow } });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load live count' });
  }
};

// GET /admin/visitors/chart
exports.getChartData = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const { days } = getRangeDates(range);
    const points = Math.min(days, 30);

    const periods = [];
    for (let i = points - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start); end.setDate(end.getDate() + 1);
      periods.push({ start, end, day: start.toLocaleDateString('en', { weekday: 'short' }) });
    }

    const overallStart = periods[0].start;
    const rows = await Visitor.find({ lastActiveAt: { $gte: overallStart } })
      .select('firstSeenAt lastActiveAt pagesVisited').lean();

    const data = periods.map((p) => {
      const inRange = rows.filter((r) => r.lastActiveAt >= p.start && r.lastActiveAt < p.end);
      return {
        day: p.day,
        visitors: inRange.length,
        pageViews: inRange.reduce((s, r) => s + (r.pagesVisited || 0), 0),
      };
    });

    return res.json({ data });
  } catch (err) {
    console.error('getChartData error:', err);
    return res.status(500).json({ message: 'Failed to load chart data' });
  }
};

// DELETE /admin/visitors/:id
exports.deleteOne = async (req, res) => {
  try {
    const v = await Visitor.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ message: 'Visitor not found' });
    emitChange('Visitor', 'delete', { id: req.params.id });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete visitor' });
  }
};

// POST /admin/visitors/bulk-delete
exports.deleteBulk = async (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    const result = await Visitor.deleteMany({ _id: { $in: ids } });
    emitChange('Visitor', 'delete');
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to bulk-delete visitors' });
  }
};

// GET /admin/visitors/export
exports.exportCsv = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const { start, end } = getRangeDates(range);
    const docs = await Visitor.find({ lastActiveAt: { $gte: start, $lte: end } }).sort({ lastActiveAt: -1 }).lean();

    const header = ['IP', 'Country', 'City', 'Device', 'OS', 'Browser', 'Source', 'Entry Page', 'Exit Page', 'Pages Visited', 'Duration', 'Bounce', 'Registered', 'Email', 'First Seen', 'Last Active'];
    const rows = docs.map((v) => {
      const s = serialize(v);
      return [
        s.ip, v.country, v.city, s.device, s.os, s.browser, s.source,
        s.entryPage, s.exitPage, s.pagesVisited, s.duration, s.bounce ? 'Yes' : 'No',
        s.isRegistered ? 'Yes' : 'No', s.email || '', v.firstSeenAt.toISOString(), v.lastActiveAt.toISOString(),
      ].map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="visitors-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('exportCsv error:', err);
    return res.status(500).json({ message: 'Failed to export visitors' });
  }
};
