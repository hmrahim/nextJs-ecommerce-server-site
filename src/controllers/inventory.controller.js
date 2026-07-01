// 📁 PATH: src/controllers/inventory.controller.js
'use strict';

const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const Inventory  = require('../models/Inventory.model');
const Warehouse  = require('../models/Warehouse.model');
const AuditLog   = require('../models/AuditLog.model');
require('../models/ProductModel');
require('../models/CategoryModel');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shapeItem(doc) {
  const product   = doc.productId && typeof doc.productId === 'object' ? doc.productId : null;
  const warehouse = doc.warehouseId && typeof doc.warehouseId === 'object' ? doc.warehouseId : null;

  let attrs = { color: null, size: null };
  if (product?.variants?.length) {
    const variant = product.variants.find((v) => v.sku === doc.variantSku);
    if (variant?.attrs) {
      const attrsObj = variant.attrs instanceof Map ? Object.fromEntries(variant.attrs) : variant.attrs;
      attrs = {
        color: attrsObj?.color || attrsObj?.Color || null,
        size:  attrsObj?.size  || attrsObj?.Size  || null,
      };
    }
  }

  return {
    _id:           String(doc._id),
    productId:     product ? String(product._id) : String(doc.productId),
    productName:   product?.name || 'Unknown product',
    sku:           product?.sku || '',
    category:      product?.category?.name || '',
    imageUrl:      product?.images?.[0]?.url || null,
    warehouseId:   warehouse ? String(warehouse._id) : String(doc.warehouseId),
    warehouseName: warehouse?.name || 'Unknown warehouse',
    variantSku:    doc.variantSku,
    attrs,
    quantity:      doc.quantity,
    reserved:      doc.reserved,
    threshold:     doc.threshold,
    updatedAt:     doc.updatedAt,
  };
}

const POPULATE = [
  { path: 'productId', select: 'name sku images category', populate: { path: 'category', select: 'name' } },
  { path: 'warehouseId', select: 'name city country isActive' },
];

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — INVENTORY
// ══════════════════════════════════════════════════════════════════════════════

const adminGetAllInventory = catchAsync(async (req, res) => {
  const { warehouseId, limit } = req.query;

  const filter = {};
  if (warehouseId) filter.warehouseId = warehouseId;

  let query = Inventory.find(filter).populate(POPULATE).sort({ updatedAt: -1 });
  if (limit) query = query.limit(Number(limit));

  const docs  = await query.lean({ virtuals: true });
  const items = docs.map(shapeItem);

  res.status(200).json({ success: true, data: items });
});

const adminGetAlerts = catchAsync(async (req, res) => {
  const docs = await Inventory.find({ $expr: { $lte: ['$quantity', '$threshold'] } })
    .populate(POPULATE)
    .sort({ quantity: 1 })
    .lean({ virtuals: true });

  res.status(200).json({ success: true, data: { items: docs.map(shapeItem) } });
});

const adminExportInventory = catchAsync(async (req, res) => {
  const docs  = await Inventory.find({}).populate(POPULATE).lean({ virtuals: true });
  const items = docs.map(shapeItem);

  const rows = [
    ['SKU', 'Product', 'Warehouse', 'Quantity', 'Reserved', 'Available', 'Threshold'],
    ...items.map((i) => [i.variantSku, i.productName, i.warehouseName, i.quantity, i.reserved, i.quantity - i.reserved, i.threshold]),
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
  res.status(200).send(csv);
});

const adminGetInventoryById = catchAsync(async (req, res) => {
  const doc = await Inventory.findById(req.params.id).populate(POPULATE);
  if (!doc) throw new AppError('Inventory record not found', 404);

  res.status(200).json({ success: true, data: shapeItem(doc.toObject({ virtuals: true })) });
});

const adminGetInventoryHistory = catchAsync(async (req, res) => {
  const inv = await Inventory.findById(req.params.id);
  if (!inv) throw new AppError('Inventory record not found', 404);

  const logs = await AuditLog.find({ entityType: 'Inventory', entityId: inv._id })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .lean();

  const history = logs.map((l) => ({
    _id:       String(l._id),
    type:      l.newValues?.type || l.action,
    delta:     l.newValues?.delta ?? 0,
    before:    l.newValues?.before ?? null,
    after:     l.newValues?.after ?? null,
    reason:    l.newValues?.reason || '',
    user:      l.userId ? (`${l.userId.firstName || ''} ${l.userId.lastName || ''}`.trim() || l.userId.email) : 'System',
    createdAt: l.createdAt,
  }));

  res.status(200).json({ success: true, data: { history } });
});

const adminAdjustInventory = catchAsync(async (req, res) => {
  const { type = 'adjustment', delta, reason = '' } = req.body;

  if (typeof delta !== 'number' || delta === 0) {
    throw new AppError('delta must be a non-zero number', 400);
  }

  const inv = await Inventory.findById(req.params.id);
  if (!inv) throw new AppError('Inventory record not found', 404);

  const before = inv.quantity;
  inv.quantity = Math.max(0, inv.quantity + delta);
  await inv.save();

  await AuditLog.create({
    userId:     req.user._id,
    entityType: 'Inventory',
    entityId:   inv._id,
    action:     'update',
    newValues:  { type, delta, before, after: inv.quantity, reason },
    ipAddress:  req.ip,
    userAgent:  req.headers['user-agent'],
  });

  const populated = await Inventory.findById(inv._id).populate(POPULATE);
  res.status(200).json({ success: true, data: shapeItem(populated.toObject({ virtuals: true })) });
});

const adminBulkAdjustInventory = catchAsync(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items array is required', 400);
  }

  const results = [];
  for (const { id, delta, type = 'adjustment', reason = '' } of items) {
    const inv = await Inventory.findById(id);
    if (!inv) continue;
    const before = inv.quantity;
    inv.quantity = Math.max(0, inv.quantity + Number(delta || 0));
    await inv.save();

    await AuditLog.create({
      userId: req.user._id, entityType: 'Inventory', entityId: inv._id, action: 'update',
      newValues: { type, delta, before, after: inv.quantity, reason },
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });

    results.push(inv._id);
  }

  res.status(200).json({ success: true, message: `${results.length} item(s) adjusted`, data: { updated: results } });
});

const adminTransferInventory = catchAsync(async (req, res) => {
  const { fromInventoryId, toWarehouseId, quantity, reason = '' } = req.body;

  if (!fromInventoryId || !toWarehouseId || !quantity || quantity <= 0) {
    throw new AppError('fromInventoryId, toWarehouseId and a positive quantity are required', 400);
  }

  const source = await Inventory.findById(fromInventoryId);
  if (!source) throw new AppError('Source inventory record not found', 404);

  const destWarehouse = await Warehouse.findById(toWarehouseId);
  if (!destWarehouse) throw new AppError('Destination warehouse not found', 404);

  const available = source.quantity - source.reserved;
  if (quantity > available) throw new AppError(`Available stock is only ${available}`, 400);

  source.quantity -= quantity;
  await source.save();

  let dest = await Inventory.findOne({
    productId: source.productId, variantSku: source.variantSku, warehouseId: toWarehouseId,
  });

  if (dest) {
    dest.quantity += quantity;
    await dest.save();
  } else {
    dest = await Inventory.create({
      productId:   source.productId,
      variantSku:  source.variantSku,
      warehouseId: toWarehouseId,
      quantity,
      reserved:    0,
      threshold:   source.threshold,
    });
  }

  await AuditLog.create({
    userId: req.user._id, entityType: 'Inventory', entityId: source._id, action: 'update',
    newValues: { type: 'transfer', delta: -quantity, reason: reason || `Transferred to ${destWarehouse.name}` },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  await AuditLog.create({
    userId: req.user._id, entityType: 'Inventory', entityId: dest._id, action: 'update',
    newValues: { type: 'transfer', delta: quantity, reason: reason || 'Transferred from source warehouse' },
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });

  res.status(200).json({
    success: true,
    message: `${quantity} units transferred to ${destWarehouse.name}`,
    data: { fromId: String(source._id), toId: String(dest._id) },
  });
});

module.exports = {
  adminGetAllInventory,
  adminGetAlerts,
  adminExportInventory,
  adminGetInventoryById,
  adminGetInventoryHistory,
  adminAdjustInventory,
  adminBulkAdjustInventory,
  adminTransferInventory,
};