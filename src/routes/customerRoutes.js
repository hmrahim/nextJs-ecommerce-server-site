// 📁 PATH: src/routes/customerRoutes.js
'use strict';

const express = require('express');
const router = express.Router();

const {
  adminGetAll,
  adminGetStats,
  adminGetById,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminBulkDelete,
  adminToggleBan,
  adminToggleVerify,
  adminToggleActive,
  adminChangeRole,
  adminGetOrders,
  adminGetWishlist,
  adminGetReviews,
  adminGetActivity,
  adminGetAddresses,
  adminAddNote,
  adminDeleteNote,
  adminEditNote,
  adminSendEmail,
  adminBulkEmail,
  adminAddTag,
  adminRemoveTag,
  adminExport
} = require('../controllers/customerController');

const { protect, restrictTo } = require('../middleware/authMiddleware');

// Mount at: /admin/customers

// Stats & Export must come BEFORE /:id
router.get('/admin/customers/stats', protect, restrictTo('admin', 'manager'), adminGetStats);
router.get('/admin/customers/export', protect, restrictTo('admin', 'manager'), adminExport);
router.post('/admin/customers/bulk-delete', protect, restrictTo('admin'), adminBulkDelete);
router.post('/admin/customers/bulk-email', protect, restrictTo('admin', 'manager'), adminBulkEmail);

// Standard CRUD & status updates
router.get('/admin/customers', protect, restrictTo('admin', 'manager'), adminGetAll);
router.post('/admin/customers', protect, restrictTo('admin'), adminCreate);
router.get('/admin/customers/:id', protect, restrictTo('admin', 'manager'), adminGetById);
router.put('/admin/customers/:id', protect, restrictTo('admin'), adminUpdate);
router.delete('/admin/customers/:id', protect, restrictTo('admin'), adminDelete);

router.patch('/admin/customers/:id/toggle-ban', protect, restrictTo('admin'), adminToggleBan);
router.patch('/admin/customers/:id/toggle-verify', protect, restrictTo('admin'), adminToggleVerify);
router.patch('/admin/customers/:id/toggle-active', protect, restrictTo('admin'), adminToggleActive);
router.patch('/admin/customers/:id/role', protect, restrictTo('admin'), adminChangeRole);

// Sub-resources
router.get('/admin/customers/:id/orders', protect, restrictTo('admin', 'manager'), adminGetOrders);
router.get('/admin/customers/:id/wishlist', protect, restrictTo('admin', 'manager'), adminGetWishlist);
router.get('/admin/customers/:id/reviews', protect, restrictTo('admin', 'manager'), adminGetReviews);
router.get('/admin/customers/:id/activity', protect, restrictTo('admin', 'manager'), adminGetActivity);
router.get('/admin/customers/:id/addresses', protect, restrictTo('admin', 'manager'), adminGetAddresses);

// Notes & tags
router.post('/admin/customers/:id/notes', protect, restrictTo('admin', 'manager'), adminAddNote);
router.put('/admin/customers/:id/notes/:noteId', protect, restrictTo('admin', 'manager'), adminEditNote);
router.delete('/admin/customers/:id/notes/:noteId', protect, restrictTo('admin', 'manager'), adminDeleteNote);

router.post('/admin/customers/:id/tags', protect, restrictTo('admin', 'manager'), adminAddTag);
router.delete('/admin/customers/:id/tags/:tag', protect, restrictTo('admin', 'manager'), adminRemoveTag);

// Send email
router.post('/admin/customers/:id/send-email', protect, restrictTo('admin', 'manager'), adminSendEmail);

module.exports = router;
