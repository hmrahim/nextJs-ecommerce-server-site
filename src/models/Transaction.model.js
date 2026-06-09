const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  type:       { type: String, enum:['payment','refund','payout','adjustment','fee'], required: true },
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref:'Order' },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  paymentId:  { type: mongoose.Schema.Types.ObjectId, ref:'Payment' },
  amount:     { type: Number, required: true },
  currency:   { type: String, default: 'USD' },
  gateway:    { type: String, enum:['stripe','bkash','sslcommerz','manual','other'], default:'stripe' },
  reference:  String,
  status:     { type: String, enum:['pending','success','failed','reversed'], default:'pending' },
  metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ orderId: 1 });
schema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('Transaction', schema);
