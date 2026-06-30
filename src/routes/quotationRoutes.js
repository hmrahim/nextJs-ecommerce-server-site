'use strict';

const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  // Customer
  createRequest,
  getMyQuotations,
  getById,
  acceptQuotation,
  rejectQuotation,
  // Admin
  adminStats,
  adminGetAll,
  adminGetById,
  adminApprove,
  adminReject,
  adminExpire,
} = require('../controllers/quotationController');

/* ════════════════════════════════════════════════════════
   CUSTOMER ROUTES  (authenticated users)
════════════════════════════════════════════════════════ */

// Create a new quotation request
router.post('/quotations', protect, createRequest);

// Get my quotations
router.get('/quotations/my', protect, getMyQuotations);

// Get single quotation detail
router.get('/quotations/:id', protect, getById);

// Accept an approved quotation
router.patch('/quotations/:id/accept', protect, acceptQuotation);

// Reject an approved quotation
router.patch('/quotations/:id/reject', protect, rejectQuotation);

/* ════════════════════════════════════════════════════════
   ADMIN ROUTES  (admin only)
════════════════════════════════════════════════════════ */

// Get quotation stats
router.get('/admin/quotations/stats', protect, restrictTo('admin'), adminStats);

// Get all quotations
router.get('/admin/quotations', protect, restrictTo('admin'), adminGetAll);

// Get single quotation detail (admin)
router.get('/admin/quotations/:id', protect, restrictTo('admin'), adminGetById);

// Approve a quotation with pricing
router.patch('/admin/quotations/:id/approve', protect, restrictTo('admin'), adminApprove);

// Reject a quotation
router.patch('/admin/quotations/:id/reject', protect, restrictTo('admin'), adminReject);

// Expire a quotation
router.patch('/admin/quotations/:id/expire', protect, restrictTo('admin'), adminExpire);

module.exports = router;