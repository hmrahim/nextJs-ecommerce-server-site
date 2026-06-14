'use strict';

const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku:  { type: String, required: true, uppercase: true, trim: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity:    { type: Number, required: true, default: 0, min: 0 },
    reserved:    { type: Number, default: 0, min: 0 }, // quantity locked by pending orders
    threshold:   { type: Number, default: 10, min: 0 }, // low-stock alert threshold
    updatedAt:   { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
// Unique per product-variant-warehouse combination
inventorySchema.index({ productId: 1, variantSku: 1, warehouseId: 1 }, { unique: true });
inventorySchema.index({ warehouseId: 1 });
inventorySchema.index({ quantity: 1, threshold: 1 }); // for low-stock queries

/* ── Virtual: availableQty ───────────────────────────────── */
inventorySchema.virtual('availableQty').get(function () {
  return Math.max(0, this.quantity - this.reserved);
});

/* ── Instance: isLowStock ────────────────────────────────── */
inventorySchema.methods.isLowStock = function () {
  return this.availableQty <= this.threshold;
};

/* ── Pre-save: update timestamp ─────────────────────────── */
inventorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;
