
const express = require('express');
const router = express.Router();



const { adminGetStats, adminReorder, adminGetAll, adminCreate, adminGetById, adminUpdate, adminDelete, adminToggle, adminAddValue, adminReorderValues, adminUpdateValue, adminDeleteValue, publicGetAll, publicGetByCategory } = require('../controllers/attributecontroller');
const { protect } = require('../middleware/authMiddleware');



/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES  —  /api/admin/attributes
══════════════════════════════════════════════════════════════════════════════ */

// Stats — /reorder এর আগে রাখো নাহলে ':id' এ match করে
router.get('/admin/attributes/stats',protect, adminGetStats);
router.patch('/admin/attributes/reorder',protect, adminReorder);

// CRUD
router.get('/admin/attributes',protect, adminGetAll);
router.post('/admin/attributes',protect, adminCreate);
router.get('/admin/attributes/:id',protect, adminGetById);
router.put('/admin/attributes/:id', protect,adminUpdate);
router.delete('/admin/attributes/:id',protect, adminDelete);
router.patch('/admin/attributes/:id/toggle',protect, adminToggle);

// Value-level
router.post('/admin/attributes/:attrId/values',protect,adminAddValue);
router.patch('/admin/attributes/:attrId/values/reorder',protect, adminReorderValues);
router.put('/admin/attributes/:attrId/values/:valId',protect, adminUpdateValue);
router.delete('/admin/attributes/:attrId/values/:valId',protect, adminDeleteValue);

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════════════════════════════ */
router.get('/attributes', publicGetAll);
router.get('/categories/:categoryId/attributes', publicGetByCategory);

module.exports = router;