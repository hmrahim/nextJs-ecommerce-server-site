const mongoose = require('mongoose');
'use strict';

const payoutSchema = new mongoose.Schema({ amount: Number, status: { type: String, enum:['pending','paid','rejected'], default:'pending' }, method: String, note: String, paidAt: Date }, { _id: true, timestamps: true });
const schema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, lowercase: true, trim: true },
  code:          { type: String, required: true, unique: true, uppercase: true, trim: true },
  commissionPct: { type: Number, default: 10, min: 0, max: 100 },
  totalEarnings: { type: Number, default: 0, min: 0 },
  pendingAmount: { type: Number, default: 0, min: 0 },
  paidAmount:    { type: Number, default: 0, min: 0 },
  status:        { type: String, enum:['active','paused','banned'], default:'active' },
  payouts:       { type: [payoutSchema], default: [] },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ code: 1 }, { unique: true });
schema.index({ email: 1 });
module.exports = mongoose.model('Affiliate', schema);
