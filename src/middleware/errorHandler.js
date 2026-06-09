'use strict';

const { ApiError } = require('../utils/apiHelpers');
const logger       = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let error = Object.assign(new ApiError(err.statusCode || 500, err.message), err);

  /* ── Mongoose: invalid ObjectId ──────────────────────────── */
  if (err.name === 'CastError') {
    error = new ApiError(400, `Invalid ID format: ${err.value}`);
  }

  /* ── Mongoose: duplicate key ─────────────────────────────── */
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new ApiError(409, `Duplicate value for: ${field}`);
  }

  /* ── Mongoose: validation errors ─────────────────────────── */
  if (err.name === 'ValidationError') {
    const msgs = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(422, 'Validation failed', msgs);
  }

  /* ── JWT errors ──────────────────────────────────────────── */
  if (err.name === 'JsonWebTokenError')  { error = new ApiError(401, 'Invalid token.'); }
  if (err.name === 'TokenExpiredError')  { error = new ApiError(401, 'Token expired. Please log in again.'); }

  const status = error.statusCode || 500;

  if (status >= 500) {
    logger.error(`[${status}] ${error.message}`, { stack: err.stack });
  } else {
    logger.warn(`[${status}] ${error.message}`);
  }

  return res.status(status).json({
    success: false,
    message: error.message || 'Internal Server Error',
    errors:  error.errors  || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
