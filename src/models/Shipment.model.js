'use strict';

const mongoose = require('mongoose');

const shipmentItemSchema = new mongoose.Schema(
  {
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, required: true },
    itemCount:  { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    orderId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    warehouseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    trackingNumber: { type: String, trim: true, default: null },
    carrier:        { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'packed', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'failed'],
      default: 'pending',
    },
    items:       { type: [shipmentItemSchema], default: [] },
    minOrderAmt: { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
    shippedAt:   { type: Date, default: null },
    estimatedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
shipmentSchema.index({ orderId: 1 });
shipmentSchema.index({ warehouseId: 1 });
shipmentSchema.index({ trackingNumber: 1 }, { sparse: true });
shipmentSchema.index({ status: 1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);
module.exports = Shipment;
