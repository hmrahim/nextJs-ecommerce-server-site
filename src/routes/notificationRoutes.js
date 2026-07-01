// 📁 PATH: src/routes/notificationRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getAdminNotifications,
  markAllRead,
  markOneRead,
  clearAll,
  deleteOne
} = require('../controllers/notification.controller');

// Mount at: /admin/notifications

router.use(protect, restrictTo('admin', 'manager'));

router.get('/admin/notifications', getAdminNotifications);
router.patch('/admin/notifications/mark-read', markAllRead);
router.patch('/admin/notifications/:id/mark-read', markOneRead);
router.delete('/admin/notifications/clear', clearAll);
router.delete('/admin/notifications/:id', deleteOne);

module.exports = router;
