// 📁 PATH: src/routes/emailRoutes.js
'use strict';

const express = require('express');
const router = express.Router();

const {
  adminListUsers,
  adminSendEmail,
  adminGetHistory,
  adminGetHistoryById,
} = require('../controllers/emailController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — custom email blast (dashboard → "Send Email" page)
// Mount at: /admin/email
// NOTE: /history must come BEFORE /history/:id to avoid route conflicts,
//       and /users must come before any other dynamic segment.
// ══════════════════════════════════════════════════════════════════════════════
router.get('/admin/email/users', protect, restrictTo('admin'), adminListUsers);
router.post('/admin/email/send', protect, restrictTo('admin'), adminSendEmail);
router.get('/admin/email/history', protect, restrictTo('admin'), adminGetHistory);
router.get('/admin/email/history/:id', protect, restrictTo('admin'), adminGetHistoryById);

module.exports = router;