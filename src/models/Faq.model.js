const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  category:  { type: String, default: 'general', trim: true },
  question:  { type: String, required: true, trim: true },
  answer:    { type: String, required: true },
  order:     { type: Number, default: 0 },
  isActive:  { type: Boolean, default: true },
  views:     { type: Number, default: 0 },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Faq', schema);
