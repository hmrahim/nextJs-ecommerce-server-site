const mongoose = require('mongoose');
'use strict';

const txnSchema = new mongoose.Schema({ type:{type:String,enum:['earn','redeem','adjust','expire']}, points: Number, reason: String, at:{type:Date,default:Date.now} }, { _id: true });
const schema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true, unique: true },
  points:   { type: Number, default: 0, min: 0 },
  lifetime: { type: Number, default: 0, min: 0 },
  tier:     { type: mongoose.Schema.Types.ObjectId, ref:'LoyaltyTier' },
  history:  { type: [txnSchema], default: [] },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('LoyaltyAccount', schema);
