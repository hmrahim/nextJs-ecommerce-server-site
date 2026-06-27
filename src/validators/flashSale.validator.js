// 📁 PATH: src/validators/flashSale.validator.js
'use strict';

const { body, param, query } = require('express-validator');
const { handleValidation: validate } = require('./validate');

/* ── Create Flash Sale ────────────────────────────────────── */
const validateCreateFlashSale = [
  body('name')
    .trim()
    .notEmpty().withMessage('Flash sale name is required')
    .isLength({ max: 200 }).withMessage('Name cannot exceed 200 characters'),
  body('discountType')
    .isIn(['percent', 'fixed']).withMessage('Discount type must be percent or fixed'),
  body('discountValue')
    .isFloat({ min: 0.01 }).withMessage('Discount value must be greater than 0')
    .custom((value, { req }) => {
      if (req.body.discountType === 'percent' && value > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      return true;
    }),
  body('applicationType')
    .optional()
    .isIn(['all', 'specific']).withMessage('Application type must be "all" or "specific"'),
  body('startTime')
    .notEmpty().withMessage('Start time is required')
    .isISO8601().withMessage('Start time must be a valid date'),
  body('endTime')
    .notEmpty().withMessage('End time is required')
    .isISO8601().withMessage('End time must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('totalStock')
    .isInt({ min: 0 }).withMessage('Total stock must be a non-negative integer'),
  body('maxOrdersPerUser')
    .optional()
    .isInt({ min: 1 }).withMessage('Max orders per user must be at least 1'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean'),
  body('priority')
    .optional()
    .isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),
  validate,
];

/* ── Update Flash Sale ────────────────────────────────────── */
const validateUpdateFlashSale = [
  param('id').isMongoId().withMessage('Invalid flash sale ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be 1-200 characters'),
  body('discountType')
    .optional()
    .isIn(['percent', 'fixed']).withMessage('Discount type must be percent or fixed'),
  body('discountValue')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Discount value must be greater than 0'),
  body('applicationType')
    .optional()
    .isIn(['all', 'specific']).withMessage('Application type must be "all" or "specific"'),
  body('startTime')
    .optional()
    .isISO8601().withMessage('Start time must be a valid date'),
  body('endTime')
    .optional()
    .isISO8601().withMessage('End time must be a valid date')
    .custom((value, { req }) => {
      // Cross-check only when both fields are present in the update payload
      if (req.body.startTime && new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('totalStock')
    .optional()
    .isInt({ min: 0 }).withMessage('Total stock must be a non-negative integer'),
  body('maxOrdersPerUser')
    .optional()
    .isInt({ min: 1 }).withMessage('Max orders per user must be at least 1'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean'),
  validate,
];

/* ── Add Products to Flash Sale ───────────────────────────── */
const validateAddProducts = [
  param('id').isMongoId().withMessage('Invalid flash sale ID'),
  body('items')
    .isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
  body('items.*.productId')
    .isMongoId().withMessage('Each item must have a valid product ID'),
  body('items.*.salePrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Sale price must be non-negative'),
  body('items.*.stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  validate,
];

/* ── Update Product in Flash Sale ─────────────────────────── */
const validateUpdateProduct = [
  param('id').isMongoId().withMessage('Invalid flash sale ID'),
  param('prodId').isMongoId().withMessage('Invalid product ID'),
  body('salePrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Sale price must be non-negative'),
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('maxPerUser')
    .optional()
    .isInt({ min: 1 }).withMessage('Max per user must be at least 1'),
  validate,
];

/* ── Bulk Delete ──────────────────────────────────────────── */
const validateBulkDelete = [
  body('ids')
    .isArray({ min: 1 }).withMessage('Provide at least one ID'),
  body('ids.*')
    .isMongoId().withMessage('Each ID must be a valid MongoDB ObjectId'),
  validate,
];

/* ── Purchase Check ───────────────────────────────────────── */
const validatePurchaseCheck = [
  param('id').isMongoId().withMessage('Invalid flash sale ID'),
  body('productId')
    .optional()
    .isMongoId().withMessage('Invalid product ID'),
  validate,
];

module.exports = {
  validateCreateFlashSale,
  validateUpdateFlashSale,
  validateAddProducts,
  validateUpdateProduct,
  validateBulkDelete,
  validatePurchaseCheck,
};
