'use strict';
const router = require('express').Router();
const manifest = require('./_manifest.json');

/* ─── Special / extra routes ─────────────────────────────── */
router.use('/auth',            require('./auth.routes'));
router.use('/upload',          require('./upload.routes'));
router.use('/payments/stripe', require('./payment.stripe.routes'));
router.use('/analytics',       require('./analytics.routes'));
router.use('/reports',         require('./reports.routes'));

// Resource-level extras (mounted BEFORE the generic CRUD routers so specific paths win)
router.use('/orders',         require('./order.extra.routes'));
router.use('/carts',          require('./cart.extra.routes'));
router.use('/coupons',        require('./coupon.extra.routes'));
router.use('/wishlists',      require('./wishlist.extra.routes'));
router.use('/notifications',  require('./notification.extra.routes'));
router.use('/reviews',        require('./review.extra.routes'));
router.use('/chat',           require('./chat.extra.routes'));

/* ─── Generic CRUD routers (auto-generated) ──────────────── */
for (const m of manifest) {
  router.use(m.base, require(m.file));
}

module.exports = router;
