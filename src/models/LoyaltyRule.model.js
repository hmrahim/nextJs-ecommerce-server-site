const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  event:      { type: String, enum:['order_placed','review_posted','signup','referral','birthday','custom'], default:'order_placed' },
  pointsAwarded: { type: Number, required: true, min: 0 },
  conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive:   { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('LoyaltyRule', schema);
