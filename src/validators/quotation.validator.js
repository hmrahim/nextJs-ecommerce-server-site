'use strict';

const { body, param, query } = require('express-validator');
const validate = require('./validate');

/* ── Customer: Create quotation request ── */
exports.createQuotation = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.name').trim().notEmpty().withMessage('Item name is required'),
  body('items.*.qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('vatNumber').trim().notEmpty().withMessage('VAT number is required'),
  body('contactPerson').trim().notEmpty().withMessage('Contact person is required'),
  body('contactPhone').trim().notEmpty().withMessage('Contact phone is required'),
  validate,
];

/* ── Admin: Approve quotation ── */
exports.approveQuotation = [
  param('id').isMongoId().withMessage('Invalid quotation ID'),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price must be ≥ 0'),
  body('items.*.discount').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount must be 0-100'),
  body('shipping').optional().isFloat({ min: 0 }).withMessage('Shipping must be ≥ 0'),
  body('validDays').optional().isInt({ min: 1, max: 90 }).withMessage('Valid days must be 1-90'),
  body('note').optional().trim(),
  validate,
];

/* ── Admin: Reject quotation ── */
exports.rejectQuotation = [
  param('id').isMongoId().withMessage('Invalid quotation ID'),
  body('note').optional().trim(),
  validate,
];

/* ── Common: ID param ── */
exports.quotationId = [
  param('id').isMongoId().withMessage('Invalid quotation ID'),
  validate,
];

/* ── Query filters ── */
exports.listFilter = [
  query('status').optional().isIn(['all', 'pending', 'approved', 'accepted', 'rejected', 'expired']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  validate,
];