// 📁 PATH: src/middleware/requireEmailVerified.js
// ✅ এই middleware checkout route এ use করলে
//    unverified email দিয়ে checkout করা যাবে না
'use strict';

/**
 * Use AFTER `protect` middleware.
 * protect → requireEmailVerified → controller
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      message:              'Please verify your email address before checkout.',
      requiresVerification: true,
      email:                req.user.email,
    });
  }

  next();
};

module.exports = requireEmailVerified;