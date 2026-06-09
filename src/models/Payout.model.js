const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  payeeType: { type: String, enum:['seller','affiliate'], required: true },
  payeeId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  amount:    { type: Number, required: true, min: 0 },
  currency:  { type: String, default: 'USD' },
  method:    { type: String, enum:['bank','stripe','paypal','mobile','other'], default:'bank' },
  reference: String,
  status:    { type: String, enum:['pending','processing','paid','failed','cancelled'], default:'pending' },
  note:      String,
  paidAt:    Date,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Payout', schema);
