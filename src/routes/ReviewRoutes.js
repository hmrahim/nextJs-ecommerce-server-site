
const express = require('express');
const router = express.Router();


// ── replace these imports with your actual auth middleware paths ──
const { protect } = require('../middleware/authMiddleware');
const { getProductReviews, createReview, updateReview, deleteReview, adminGetStats, adminGetAll, adminBulkAction, adminGetById, adminApprove, adminReject, adminDelete, adminReply } = require('../controllers/reviewController');


/* ══════════════════════════════════════════════════════
   PUBLIC
══════════════════════════════════════════════════════ */
// GET  /products/:productId/reviews?page=1&limit=10&sort=newest&rating=5
router.get(
    '/products/:productId/reviews', getProductReviews
);

/* ══════════════════════════════════════════════════════
   PROTECTED  (any logged-in user)
══════════════════════════════════════════════════════ */
// POST   /products/:productId/reviews
router.post(
    '/products/:productId/reviews',protect,createReview
);

// PUT    /reviews/:reviewId   (owner edit)
router.put(
    '/reviews/:reviewId',protect, updateReview
);

// DELETE /reviews/:reviewId   (owner delete)
router.delete(
    '/reviews/:reviewId', protect, deleteReview
);

/* ══════════════════════════════════════════════════════
   ADMIN
   NOTE: /stats must come BEFORE /:id so Express doesn't
   treat the string "stats" as a Mongo ObjectId param.
══════════════════════════════════════════════════════ */
// GET  /admin/reviews/stats
router.get(
    '/admin/reviews/stats',protect,adminGetStats
);

// GET  /admin/reviews?page=1&limit=20&status=pending&sort=newest
router.get(
    '/admin/reviews',protect, adminGetAll
);

// POST /admin/reviews/bulk   { ids, action: 'approve'|'reject'|'delete' }
router.post(
    '/admin/reviews/bulk',protect,adminBulkAction
);

// GET  /admin/reviews/:id
router.get(
    '/admin/reviews/:id',protect, adminGetById
);

// PATCH /admin/reviews/:id/approve
router.patch(
    '/admin/reviews/:id/approve',protect,adminApprove
);

// PATCH /admin/reviews/:id/reject
router.patch(
    '/admin/reviews/:id/reject', protect,adminReject
);

// DELETE /admin/reviews/:id
router.delete(
    '/admin/reviews/:id',protect,adminDelete
);

router.post(  '/admin/reviews/:id/reply',      protect, adminReply); 

module.exports = router;