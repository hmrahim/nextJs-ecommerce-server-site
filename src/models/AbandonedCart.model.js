const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  cartId:    { type: mongoose.Schema.Types.ObjectId, ref:'Cart' },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  email:     String,
  phone:     String,
  items:     [{ productId: { type: mongoose.Schema.Types.ObjectId, ref:'Product' }, qty: Number, price: Number, name: String }],
  total:     { type: Number, default: 0 },
  remindersSent: { type: Number, default: 0 },
  lastReminderAt: Date,
  recovered: { type: Boolean, default: false },
  recoveredOrderId: { type: mongoose.Schema.Types.ObjectId, ref:'Order' },
  abandonedAt: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ abandonedAt: -1 });
module.exports = mongoose.model('AbandonedCart', schema);
