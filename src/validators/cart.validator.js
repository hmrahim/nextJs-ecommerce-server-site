'use strict';

const { body, param } = require('express-validator');
const { handleValidation } = require('./validate');

const addItemValidator = [
  body('productId')
    .notEmpty().withMessage('productId is required')
    .isMongoId().withMessage('productId must be a valid Mongo ID'),

  body('variantSku')
    .optional({ nullable: true })          // null বা undefined হলেও skip
    .isString().withMessage('variantSku must be a string')
    .trim(),

  body('qty')
    .optional({ nullable: true })
    .default(1)
    .toInt()
    .isInt({ min: 1 }).withMessage('qty must be a positive integer'),

  handleValidation,
];

const updateItemValidator = [
  param('productId')
    .isMongoId().withMessage('productId must be a valid Mongo ID'),

  body('variantSku')
    .optional({ nullable: true })
    .isString().withMessage('variantSku must be a string')
    .trim(),

  body('qty')
    .notEmpty().withMessage('qty is required')
    .toInt()                               // "1" → 1  (string coerce fix)
    .isInt({ min: 1 }).withMessage('qty must be a positive integer'),

  handleValidation,
];

const removeItemValidator = [
  param('productId')
    .isMongoId().withMessage('productId must be a valid Mongo ID'),

  handleValidation,
];

const mergeCartValidator = [
  body('sessionId')
    .notEmpty().withMessage('sessionId is required')
    .isString().withMessage('sessionId must be a string'),

  handleValidation,
];

module.exports = {
  addItemValidator,
  updateItemValidator,
  removeItemValidator,
  mergeCartValidator,
};