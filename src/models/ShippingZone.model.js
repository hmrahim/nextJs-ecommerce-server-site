const mongoose = require('mongoose');
'use strict';

const rateSchema = new mongoose.Schema({ method: String, price: Number, minDays: Number, maxDays: Number }, { _id: true });
const schema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  countries: [String],
  states:    [String],
  zipCodes:  [String],
  rates:     { type: [rateSchema], default: [] },
  isActive:  { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('ShippingZone', schema);
