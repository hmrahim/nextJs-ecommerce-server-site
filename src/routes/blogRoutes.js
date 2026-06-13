// 📁 PATH: routes/blogRoutes.js

const express = require('express');
const router = express.Router();


// ── Middleware (adjust paths to match your project structure) ─────────────────

const { adminGetStats, adminBulkDelete, adminBulkStatus, adminGetAll, adminGetById, adminUpdate, adminDelete, adminToggleFeatured, adminChangeStatus, publicGetFeatured, publicGetByCategory, publicGetAll, publicGetBySlug, trackView, likePost, addComment, adminCreate } = require('../controllers/blogController');
const { protect } = require('../middleware/authMiddleware');
// If your middleware uses different names, adjust accordingly:
// const protect   = require('../middleware/auth').protect;
// const adminOnly = require('../middleware/auth').adminOnly;

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — all require authentication + admin role
// Mount at: /api/admin/blogs
// ══════════════════════════════════════════════════════════════════════════════

// NOTE: /stats and /bulk must come BEFORE /:id to avoid route conflicts

router.get('/admin/blogs/stats', protect,adminGetStats);
router.delete('/admin/blogs/bulk',protect, adminBulkDelete);
router.patch('/admin/blogs/bulk-status',protect, adminBulkStatus);

router.get('/admin/blogs',protect, adminGetAll);
router.post('/admin/blogs',protect, adminCreate);

router.get('/admin/blogs/:id',protect, adminGetById);
router.put('/admin/blogs/:id',protect, adminUpdate);
router.delete('/admin/blogs/:id',protect, adminDelete);

router.patch('/admin/blogs/:id/toggle-featured',protect, adminToggleFeatured);
router.patch('/admin/blogs/:id/status',protect, adminChangeStatus);

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// Mount at: /api/blogs
// ══════════════════════════════════════════════════════════════════════════════

// NOTE: /featured and /category/:cat must come BEFORE /:slug

router.get('/blogs/featured', publicGetFeatured);
router.get('/blogs/category/:category', publicGetByCategory);
router.get('/blogs', publicGetAll);
router.get('/blogs/:slug', publicGetBySlug);

router.patch('/blogs/:id/view', trackView);
router.patch('/blogs/:id/like', likePost);
router.post('/blogs/:id/comments', addComment);

module.exports = router;
