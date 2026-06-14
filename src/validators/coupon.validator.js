// 📁 PATH: src/validators/coupon.validator.js
'use strict';

const { body } = require('express-validator');
const { handleValidation } = require('./validate');

/* ════════════════════════════════════════════════════════════
   SHARED BASE RULES
════════════════════════════════════════════════════════════ */

const baseRules = (isUpdate = false) => {
  const opt = (chain) =>
    isUpdate ? chain.optional({ values: 'undefined' }) : chain;

  return [
    // ── code ──────────────────────────────────────────────
    opt(
      body('code')
        .if((value, { req }) => !isUpdate || req.body.code !== undefined)
        .notEmpty()
        .withMessage('Coupon code is required')
    )
      .bail()
      .isString()
      .trim()
      .toUpperCase()
      .isLength({ min: 3, max: 20 })
      .withMessage('Code must be 3–20 characters')
      .matches(/^[A-Z0-9_-]+$/)
      .withMessage('Code can only contain letters, numbers, "-" and "_"'),

    // ── description ───────────────────────────────────────
    body('description')
      .optional({ values: 'undefined' })
      .isString()
      .trim()
      .isLength({ max: 250 })
      .withMessage('Description cannot exceed 250 characters'),

    // ── type ──────────────────────────────────────────────
    opt(
      body('type')
        .if((value, { req }) => !isUpdate || req.body.type !== undefined)
        .notEmpty()
        .withMessage('Discount type is required')
    )
      .bail()
      .isIn(['percent', 'fixed', 'shipping'])
      .withMessage('Type must be one of: percent, fixed, shipping'),

    // ── value ─────────────────────────────────────────────
    opt(
      body('value')
        .if((value, { req }) => !isUpdate || req.body.value !== undefined)
        .notEmpty()
        .withMessage('Discount value is required')
    )
      .bail()
      .isNumeric()
      .withMessage('Value must be a number')
      .toFloat()
      .custom((value, { req }) => {
        const type = req.body.type;
        if (!type) return true; // type validation handles it
        if (type === 'percent') {
          if (value <= 0 || value > 100)
            throw new Error('Percentage must be between 1 and 100');
        } else if (type === 'fixed') {
          if (value <= 0) throw new Error('Fixed amount must be greater than 0');
        } else if (type === 'shipping') {
          if (value < 0) throw new Error('Shipping value cannot be negative');
        }
        return true;
      }),

    // ── minOrderAmount ────────────────────────────────────
    body('minOrderAmount')
      .optional({ values: 'undefined' })
      .isNumeric()
      .withMessage('Minimum order amount must be a number')
      .toFloat()
      .custom((v) => {
        if (v < 0) throw new Error('Minimum order amount cannot be negative');
        return true;
      }),

    // ── applicableTo ──────────────────────────────────────
    body('applicableTo')
      .optional({ values: 'undefined' })
      .isIn(['all', 'category', 'product'])
      .withMessage('applicableTo must be one of: all, category, product'),

    // ── products ──────────────────────────────────────────
    body('products')
      .optional({ values: 'undefined' })
      .isArray()
      .withMessage('products must be an array')
      .custom((arr, { req }) => {
        if (req.body.applicableTo === 'product' && arr.length === 0) {
          throw new Error('At least one product must be selected when applicableTo is "product"');
        }
        return true;
      }),

    body('products.*')
      .optional()
      .isMongoId()
      .withMessage('Each product ID must be a valid MongoDB ObjectId'),

    // ── categories ────────────────────────────────────────
    body('categories')
      .optional({ values: 'undefined' })
      .isArray()
      .withMessage('categories must be an array')
      .custom((arr, { req }) => {
        if (req.body.applicableTo === 'category' && arr.length === 0) {
          throw new Error('At least one category must be selected when applicableTo is "category"');
        }
        return true;
      }),

    body('categories.*')
      .optional()
      .isMongoId()
      .withMessage('Each category ID must be a valid MongoDB ObjectId'),

    // ── maxUses ───────────────────────────────────────────
    body('maxUses')
      .optional({ values: 'undefined' })
      .custom((v) => {
        if (v === null || v === '') return true; // null = unlimited
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1)
          throw new Error('Max uses must be a positive integer or null (unlimited)');
        return true;
      }),

    // ── maxUsesPerUser ────────────────────────────────────
    body('maxUsesPerUser')
      .optional({ values: 'undefined' })
      .isInt({ min: 1 })
      .withMessage('Max uses per user must be a positive integer')
      .toInt(),

    // ── startDate ─────────────────────────────────────────
    body('startDate')
      .optional({ values: 'undefined' })
      .custom((v) => {
        if (v === null || v === '') return true;
        if (isNaN(Date.parse(v))) throw new Error('startDate must be a valid date');
        return true;
      }),

    // ── expiresAt ─────────────────────────────────────────
    body('expiresAt')
      .optional({ values: 'undefined' })
      .custom((v, { req }) => {
        if (v === null || v === '') return true;
        if (isNaN(Date.parse(v))) throw new Error('expiresAt must be a valid date');
        const startDate = req.body.startDate;
        if (startDate && new Date(v) < new Date(startDate)) {
          throw new Error('expiresAt must be after startDate');
        }
        return true;
      }),

    // ── isActive ──────────────────────────────────────────
    body('isActive')
      .optional({ values: 'undefined' })
      .isBoolean()
      .withMessage('isActive must be a boolean')
      .toBoolean(),
  ];
};

/* ════════════════════════════════════════════════════════════
   VALIDATE COUPON CODE (public apply/validate)
════════════════════════════════════════════════════════════ */
const validateCouponApply = [
  body('code')
    .notEmpty()
    .withMessage('Coupon code is required')
    .isString()
    .trim()
    .toUpperCase()
    .isLength({ min: 3, max: 20 })
    .withMessage('Invalid coupon code format'),

  body('orderAmount')
    .optional()
    .isNumeric()
    .withMessage('orderAmount must be a number')
    .toFloat(),

  body('productIds')
    .optional()
    .isArray()
    .withMessage('productIds must be an array'),

  body('categoryIds')
    .optional()
    .isArray()
    .withMessage('categoryIds must be an array'),

  handleValidation,
];

/* ════════════════════════════════════════════════════════════
   BULK DELETE
════════════════════════════════════════════════════════════ */
const validateBulkDelete = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('Provide at least one coupon ID'),

  body('ids.*')
    .isMongoId()
    .withMessage('Each ID must be a valid MongoDB ObjectId'),

  handleValidation,
];

/* ════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════ */
const validateCreateCoupon = [...baseRules(false), handleValidation];
const validateUpdateCoupon = [...baseRules(true),  handleValidation];

module.exports = {
  validateCreateCoupon,
  validateUpdateCoupon,
  validateCouponApply,
  validateBulkDelete,
};