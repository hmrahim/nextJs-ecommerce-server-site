const mongoose = require('mongoose');
'use strict';

const productSchema = new mongoose.Schema({ productId: { type: mongoose.Schema.Types.ObjectId, ref:'Product', required: true }, salePrice: Number, stock: Number }, { _id: false });
const schema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  banner:    String,
  startsAt:  { type: Date, required: true },
  endsAt:    { type: Date, required: true },
  products:  { type: [productSchema], default: [] },
  status:    { type: String, enum:['scheduled','live','ended','cancelled'], default:'scheduled' },
  totalSold: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ startsAt: 1, endsAt: 1 });
module.exports = mongoose.model('FlashSale', schema);
