'use strict';

const jwt          = require('jsonwebtoken');
const User         = require('../models/User.model');
const { ApiError } = require('../utils/apiHelpers');

/**
 * protect — verifies Bearer JWT, attaches req.user
 */
const protect = async (req, _res, next) => {
  try {
    // ১. Token আছে কিনা চেক
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Not authenticated. Please log in.'));
    }

    const token = auth.split(' ')[1];

    // ২. Token verify — expired বা invalid আলাদা error
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new ApiError(401, 'Session expired. Please log in again.'));
      }
      return next(new ApiError(401, 'Invalid token. Please log in.'));
    }

    // ৩. User এখনো আছে কিনা চেক
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return next(new ApiError(401, 'User no longer exists.'));
    }

    // ৪. Account active আছে কিনা চেক
    if (!user.isActive) {
      return next(new ApiError(403, 'Account has been deactivated.'));
    }

    // ৫. req.user attach করো
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * restrictTo(...roles) — role-based access guard
 * Usage: router.delete('/:id', protect, restrictTo('admin'), handler)
 */
const restrictTo = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Not authenticated.'));
  }
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, `Access denied. Required role: ${roles.join(' | ')}`));
  }
  next();
};

/**
 * optionalAuth — token থাকলে user attach করে, না থাকলে skip করে
 * Public route এ user info দরকার হলে ব্যবহার করো
 * Usage: router.get('/products', optionalAuth, handler)
 */
const optionalAuth = async (req, _res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return next();

    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (user && user.isActive) req.user = user;
    next();
  } catch {
    // token invalid হলেও চলতে থাকবে, block করবে না
    next();
  }
};

module.exports = { protect, restrictTo, optionalAuth };
