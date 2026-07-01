// 📁 PATH: src/routes/warehouseRoutes.js
'use strict';

const express = require('express');
const {
  adminGetAllWarehouses,
  adminGetWarehouseById,
  adminCreateWarehouse,
  adminUpdateWarehouse,
  adminDeleteWarehouse,
} = require('../controllers/warehouse.controller');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/admin/warehouses',      protect, adminGetAllWarehouses);
router.post('/admin/warehouses',     protect, adminCreateWarehouse);
router.get('/admin/warehouses/:id',  protect, adminGetWarehouseById);
router.patch('/admin/warehouses/:id',protect, adminUpdateWarehouse);
router.delete('/admin/warehouses/:id',protect, adminDeleteWarehouse);

module.exports = router;