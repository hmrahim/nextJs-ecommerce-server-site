const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, unique: true },
  minPoints:   { type: Number, required: true, min: 0 },
  discountPct: { type: Number, default: 0, min: 0, max: 100 },
  benefits:    [String],
  color:       String,
  order:       { type: Number, default: 0 },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('LoyaltyTier', schema);
