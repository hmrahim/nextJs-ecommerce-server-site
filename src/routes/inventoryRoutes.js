// 📁 PATH: src/routes/inventoryRoutes.js
'use strict';

const express = require('express');
const {
  adminGetAllInventory,
  adminGetAlerts,
  adminExportInventory,
  adminGetInventoryById,
  adminGetInventoryHistory,
  adminAdjustInventory,
  adminBulkAdjustInventory,
  adminTransferInventory,
} = require('../controllers/inventory.controller');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/admin/inventory/alerts',      protect, adminGetAlerts);
router.get('/admin/inventory/export',      protect, adminExportInventory);
router.post('/admin/inventory/transfer',   protect, adminTransferInventory);
router.post('/admin/inventory/bulk-adjust',protect, adminBulkAdjustInventory);

router.get('/admin/inventory',             protect, adminGetAllInventory);
router.get('/admin/inventory/:id',         protect, adminGetInventoryById);
router.get('/admin/inventory/:id/history', protect, adminGetInventoryHistory);
router.patch('/admin/inventory/:id/adjust',protect, adminAdjustInventory);

module.exports = router;