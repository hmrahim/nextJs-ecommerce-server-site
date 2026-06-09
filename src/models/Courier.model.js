const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  code:      { type: String, required: true, unique: true, uppercase: true },
  contact:   String,
  email:     String,
  phone:     String,
  apiKey:    { type: String, select: false },
  baseRate:  { type: Number, default: 0, min: 0 },
  perKgRate: { type: Number, default: 0, min: 0 },
  coverage:  [String],
  trackingUrlTemplate: String,
  isActive:  { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ code: 1 }, { unique: true });
module.exports = mongoose.model('Courier', schema);
