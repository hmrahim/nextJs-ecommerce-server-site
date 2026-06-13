
const express = require('express');
const { createCategory, getTreeCategories, updateCategory, deleteCategory, toggle } = require('../controllers/Categorys/categoryAdminController');
const { categoryStream } = require('../controllers/sseController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();
// =========sse routes========
router.get('/admin/categories/events', protect, categoryStream); // ✅ /admin যোগ করো

// =========admin category routes========
router.post('/admin/categories', protect, createCategory);
router.get('/admin/categories/tree', protect, getTreeCategories);
router.put('/admin/categories/:id', protect, updateCategory);
router.delete('/admin/categories/:id', protect, deleteCategory);
router.patch('/admin/categories/:id/toggle', protect, toggle);

module.exports = router;
