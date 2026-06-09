const mongoose = require('mongoose');
'use strict';

const msgSchema = new mongoose.Schema({ from: { type: String, enum:['buyer','seller','admin'] }, message: String, attachments: [String], at: { type: Date, default: Date.now } }, { _id: true });
const schema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref:'Order', required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true },
  subject:    { type: String, required: true },
  description:String,
  reason:     { type: String, enum:['item_not_received','damaged','wrong_item','refund','other'], default:'other' },
  status:     { type: String, enum:['open','in_review','resolved','closed','rejected'], default:'open' },
  resolution: String,
  messages:   { type: [msgSchema], default: [] },
  resolvedAt: Date,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Dispute', schema);
