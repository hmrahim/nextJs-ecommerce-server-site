// 📁 PATH: routes/contactRoutes.js

const express = require('express');
const router = express.Router();

const {
  submitContact,
  adminGetAll,
  adminGetById,
  adminReply,
  adminUpdateStatus,
  adminDelete,
  adminStats,
} = require('../controllers/contactController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC — customer submits the contact form
// Mount at: /contact
// ══════════════════════════════════════════════════════════════════════════════
router.post('/contact', submitContact);

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — view & manage contact messages
// Mount at: /admin/contact
// NOTE: /stats must come BEFORE /:id to avoid route conflicts
// ══════════════════════════════════════════════════════════════════════════════
router.get('/admin/contact/stats', protect, restrictTo('admin'), adminStats);
router.get('/admin/contact', protect, restrictTo('admin'), adminGetAll);
router.get('/admin/contact/:id', protect, restrictTo('admin'), adminGetById);
router.post('/admin/contact/:id/reply', protect, restrictTo('admin'), adminReply);
router.patch('/admin/contact/:id/status', protect, restrictTo('admin'), adminUpdateStatus);
router.delete('/admin/contact/:id', protect, restrictTo('admin'), adminDelete);

module.exports = router;