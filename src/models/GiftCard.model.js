const mongoose = require('mongoose');
'use strict';

const redemptionSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref:'User' }, orderId: { type: mongoose.Schema.Types.ObjectId, ref:'Order' }, amount: Number, at: { type: Date, default: Date.now } }, { _id: true });
const schema = new mongoose.Schema({
  code:        { type: String, required: true, unique: true, uppercase: true },
  amount:      { type: Number, required: true, min: 0 },
  balance:     { type: Number, required: true, min: 0 },
  currency:    { type: String, default: 'USD' },
  issuedTo:    { name: String, email: String, message: String },
  expiresAt:   Date,
  isActive:    { type: Boolean, default: true },
  redemptions: { type: [redemptionSchema], default: [] },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ code: 1 }, { unique: true });
module.exports = mongoose.model('GiftCard', schema);
