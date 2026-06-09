const mongoose = require('mongoose');
'use strict';

const itemSchema = new mongoose.Schema({ productId: { type: mongoose.Schema.Types.ObjectId, ref:'Product' }, qty: Number, reason: String }, { _id: false });
const schema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref:'Order', required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true },
  items:      { type: [itemSchema], default: [] },
  reason:     { type: String, required: true },
  description:String,
  attachments:[String],
  refundAmount:{ type: Number, default: 0, min: 0 },
  status:     { type: String, enum:['requested','approved','rejected','received','refunded','closed'], default:'requested' },
  refundedAt: Date,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Return', schema);
