const mongoose = require('mongoose');
'use strict';

const itemSchema = new mongoose.Schema({ productId: { type: mongoose.Schema.Types.ObjectId, ref:'Product', required: true }, qty: { type: Number, default: 1, min: 1 } }, { _id: false });
const schema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  items:       { type: [itemSchema], default: [] },
  price:       { type: Number, required: true, min: 0 },
  originalPrice:{ type: Number, default: 0, min: 0 },
  discountPct: { type: Number, default: 0, min: 0, max: 100 },
  image:       { type: String, default: '' },
  startsAt:    Date,
  endsAt:      Date,
  isActive:    { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Bundle', schema);
