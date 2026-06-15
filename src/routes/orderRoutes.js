
const express = require('express');
const router  = express.Router();

const {
  createOrder, getMyOrders, getOrderById, cancelOrder,
  adminGetAll, adminGetById, adminExport, adminStats, adminListRiders,
  adminConfirmOrder, adminAssignRider, adminUpdateStatus, adminCancelOrder,
  riderListOrders, riderGetOrder, riderMarkPickedUp, riderCompleteDelivery,
} = require('../controllers/orderController');

const { orderStream } = require('../controllers/sseController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

/* ── SSE — realtime order updates for admin dashboard ──────────── */
router.get   ('/admin/orders/events',   protect, restrictTo('admin', 'manager'), orderStream);

/* ── Client routes ───────────────────────────────────────────── */
router.post  ('/orders',                protect, createOrder);
router.get   ('/orders/my',             protect, getMyOrders);
router.get   ('/orders/:id',            protect, getOrderById);
router.patch ('/orders/:id/cancel',     protect, cancelOrder);

/* ── Admin routes (order of /export, /stats, /riders BEFORE /:id) ── */
router.get   ('/admin/orders/export',   protect, restrictTo('admin', 'manager'), adminExport);
router.get   ('/admin/orders/stats',    protect, restrictTo('admin', 'manager'), adminStats);
router.get   ('/admin/orders/riders',   protect, restrictTo('admin', 'manager'), adminListRiders);
router.get   ('/admin/orders',          protect, restrictTo('admin', 'manager'), adminGetAll);
router.get   ('/admin/orders/:id',      protect, restrictTo('admin', 'manager'), adminGetById);

router.patch ('/admin/orders/:id/confirm',       protect, restrictTo('admin', 'manager'), adminConfirmOrder);
router.patch ('/admin/orders/:id/assign-rider',  protect, restrictTo('admin', 'manager'), adminAssignRider);
router.patch ('/admin/orders/:id/status',        protect, restrictTo('admin', 'manager'), adminUpdateStatus);
router.patch ('/admin/orders/:id/cancel',        protect, restrictTo('admin', 'manager'), adminCancelOrder);

/* ── Rider routes ─────────────────────────────────────────────── */
router.get   ('/rider/orders',          protect, restrictTo('rider'), riderListOrders);
router.get   ('/rider/orders/:id',      protect, restrictTo('rider'), riderGetOrder);
router.patch ('/rider/orders/:id/pickup',  protect, restrictTo('rider'), riderMarkPickedUp);
router.patch ('/rider/orders/:id/deliver', protect, restrictTo('rider'), riderCompleteDelivery);

module.exports = router;
