// 📁 PATH: src/middleware/auth.middleware.js
'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/* ─────────────────────────────────────────────────────────────
   protect
   ─ Bearer token verify করে
   ─ User DB থেকে fetch করে
   ─ req.user এ attach করে → controller এ req.user.email ইত্যাদি পাবে
───────────────────────────────────────────────────────────── */
const protect = async (req, res, next) => {
  try {
    // ১. Authorization header চেক (normal requests)
    const auth = req.headers.authorization;
    let token;

    if (auth && auth.startsWith('Bearer ')) {
      token = auth.split(' ')[1];
    } else if (req.query?.token) {
      // 🔔 EventSource (SSE) custom header পাঠাতে পারে না,
      // তাই token query param থেকেও accept করি (SSE routes-এর জন্য)
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });
    }

    // ২. Token verify
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ message: 'Invalid token. Please log in.' });
    }

    // ৩. User DB থেকে আনো (passwordHash ছাড়া)
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    // ৪. Account active কিনা চেক
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated.' });
    }

    // ✅ ৫. req.user এ পুরো user object রাখো
    //    Controller এ এভাবে access করো:
    //      req.user._id      → MongoDB ObjectId
    //      req.user.email    → "john@example.com"
    //      req.user.firstName → "John"
    //      req.user.lastName  → "Doe"
    //      req.user.role     → "admin" | "buyer" | "seller"
    req.user = user;

    next();
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   restrictTo(...roles)
   ─ protect এর পরে use করো
   ─ নির্দিষ্ট role ছাড়া block করে

   Example:
     router.delete('/:id', protect, restrictTo('admin'), handler)
───────────────────────────────────────────────────────────── */
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: `Access denied. Required role: ${roles.join(' | ')}` });
  }
  next();
};

/* ─────────────────────────────────────────────────────────────
   optionalAuth
   ─ Token থাকলে req.user attach করে
   ─ Token না থাকলে / invalid হলে skip করে (block করে না)
   ─ Public route এ user context দরকার হলে use করো

   Example:
     router.get('/products', optionalAuth, handler)
───────────────────────────────────────────────────────────── */
const optionalAuth = async (req, _res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return next();

    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-passwordHash');

    if (user && user.isActive) req.user = user;
    next();
  } catch {
    // invalid token → quietly skip, don't block
    next();
  }
};

module.exports = { protect, restrictTo, optionalAuth };