'use strict';
/** Wraps async route handlers and forwards rejections to Express error middleware. */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
