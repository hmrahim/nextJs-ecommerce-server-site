// 📁 PATH: src/controllers/warehouse.controller.js
'use strict';

const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const Warehouse  = require('../models/Warehouse.model');
const Inventory  = require('../models/Inventory.model');

const adminGetAllWarehouses = catchAsync(async (req, res) => {
  const warehouses = await Warehouse.find({}).sort({ createdAt: -1 }).lean();

  const agg = await Inventory.aggregate([
    { $group: { _id: '$warehouseId', itemCount: { $sum: 1 }, totalStock: { $sum: '$quantity' } } },
  ]);
  const aggMap = new Map(agg.map((a) => [String(a._id), a]));

  const shaped = warehouses.map((w) => ({
    ...w,
    _id:        String(w._id),
    itemCount:  aggMap.get(String(w._id))?.itemCount || 0,
    totalStock: aggMap.get(String(w._id))?.totalStock || 0,
  }));

  res.status(200).json({ success: true, data: shaped });
});

const adminGetWarehouseById = catchAsync(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw new AppError('Warehouse not found', 404);

  res.status(200).json({ success: true, data: warehouse });
});

const adminCreateWarehouse = catchAsync(async (req, res) => {
  const { name, address, city, country, isActive } = req.body;

  if (!name || !address || !city || !country) {
    throw new AppError('name, address, city and country are required', 400);
  }

  const warehouse = await Warehouse.create({ name, address, city, country, isActive });
  res.status(201).json({ success: true, data: warehouse });
});

const adminUpdateWarehouse = catchAsync(async (req, res) => {
  const allowed = ['name', 'address', 'city', 'country', 'isActive'];
  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
  if (!warehouse) throw new AppError('Warehouse not found', 404);

  res.status(200).json({ success: true, data: warehouse });
});

const adminDeleteWarehouse = catchAsync(async (req, res) => {
  const linked = await Inventory.countDocuments({ warehouseId: req.params.id });
  if (linked > 0) throw new AppError('Cannot delete a warehouse that still has inventory records', 400);

  const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
  if (!warehouse) throw new AppError('Warehouse not found', 404);

  res.status(200).json({ success: true, data: null });
});

module.exports = {
  adminGetAllWarehouses,
  adminGetWarehouseById,
  adminCreateWarehouse,
  adminUpdateWarehouse,
  adminDeleteWarehouse,
};