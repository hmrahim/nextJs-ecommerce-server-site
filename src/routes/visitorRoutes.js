// 📁 PATH: src/routes/visitorRoutes.js
'use strict';

const express = require('express');
const router = express.Router();

const {
  trackVisit,
  trackEvent,
  getAll,
  getById,
  getStats,
  getTopPages,
  getByCountry,
  getByDevice,
  getBySource,
  getLiveCount,
  getChartData,
  deleteOne,
  deleteBulk,
  exportCsv,
} = require('../controllers/visitorController');
const { protect, restrictTo, optionalAuth } = require('../middleware/authMiddleware');

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC — silent tracking pings from the storefront.
// No auth, no browser permission prompts (device from User-Agent header,
// location from server-side IP lookup). optionalAuth just attaches req.user
// when a token is present so logged-in visits get linked to the account.
//
// ⚠️ FIX: these were previously mounted at /track/visit and /track/event.
// Ad blockers (uBlock Origin, Brave Shields, AdBlock+EasyPrivacy) block ANY
// URL containing "/track", "/analytics", "/pixel", "/collect", "/beacon" —
// even first-party same-domain requests. That silently killed every visit
// save (VisitorTracker.jsx swallows the failed request with .catch(() => {})
// so nothing ever showed up as an error). Renamed to neutral, non-blocklisted
// paths. If you rename again in future, avoid analytics-sounding words.
//
// Mount at: /session
// ══════════════════════════════════════════════════════════════════════════════
router.post('/session/ping', optionalAuth, trackVisit);
router.post('/session/activity', optionalAuth, trackEvent);

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — visitor analytics dashboard (all real data)
// NOTE: specific paths must come BEFORE /admin/visitors/:id
// Mount at: /admin/visitors
// ══════════════════════════════════════════════════════════════════════════════
router.get('/admin/visitors/stats',       protect, restrictTo('admin'), getStats);
router.get('/admin/visitors/top-pages',   protect, restrictTo('admin'), getTopPages);
router.get('/admin/visitors/by-country',  protect, restrictTo('admin'), getByCountry);
router.get('/admin/visitors/by-device',   protect, restrictTo('admin'), getByDevice);
router.get('/admin/visitors/by-source',   protect, restrictTo('admin'), getBySource);
router.get('/admin/visitors/live',        protect, restrictTo('admin'), getLiveCount);
router.get('/admin/visitors/chart',       protect, restrictTo('admin'), getChartData);
router.get('/admin/visitors/export',      protect, restrictTo('admin'), exportCsv);
router.post('/admin/visitors/bulk-delete',protect, restrictTo('admin'), deleteBulk);
router.get('/admin/visitors',             protect, restrictTo('admin'), getAll);
router.get('/admin/visitors/:id',         protect, restrictTo('admin'), getById);
router.delete('/admin/visitors/:id',      protect, restrictTo('admin'), deleteOne);

module.exports = router;