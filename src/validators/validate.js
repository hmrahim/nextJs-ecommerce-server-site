'use strict';

const { validationResult } = require('express-validator');
const { ApiError }         = require('../utils/apiHelpers');

/**
 * Middleware to run after express-validator chains.
 * Collects all errors and throws a 422 ApiError if any exist.
 */
const handleValidation = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => `${e.path}: ${e.msg}`);
    console.error('🔴 Validation errors:', JSON.stringify(errors.array(), null, 2));
    console.error('🔴 Request body:', JSON.stringify(req.body, null, 2));
    return next(new ApiError(422, 'Validation failed', messages));
  }
  next();
};

module.exports = { handleValidation };