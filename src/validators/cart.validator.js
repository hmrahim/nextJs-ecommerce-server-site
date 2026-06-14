'use strict';

const { body, param } = require('express-validator');
const { handleValidation } = require('./validate');

const addItemValidator = [
  body('productId')
    .notEmpty().withMessage('productId is required')
    .isMongoId().withMessage('productId must be a valid Mongo ID'),
  body('variantSku')
    .optional()
    .isString().withMessage('variantSku must be a string'),
  body('qty')
    .optional()
    .isInt({ min: 1 }).withMessage('qty must be a positive integer'),
  handleValidation,
];

const updateItemValidator = [
  param('productId')
    .isMongoId().withMessage('productId must be a valid Mongo ID'),
  body('variantSku')
    .optional()
    .isString().withMessage('variantSku must be a string'),
  body('qty')
    .notEmpty().withMessage('qty is required')
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