'use strict';

const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city:    { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    isActive:{ type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

warehouseSchema.index({ isActive: 1 });
warehouseSchema.index({ city: 1, country: 1 });

const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
module.exports = Warehouse;
