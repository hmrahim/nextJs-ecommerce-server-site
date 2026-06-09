const mongoose = require('mongoose');
'use strict';

const valueSchema = new mongoose.Schema({ value: { type: String, required: true, trim: true }, label: { type: String, trim: true } }, { _id: true });
const schema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, unique: true },
  slug:        { type: String, lowercase: true, trim: true },
  type:        { type: String, enum: ['text','color','number','select'], default: 'text' },
  values:      { type: [valueSchema], default: [] },
  isFilterable:{ type: Boolean, default: true },
  isRequired:  { type: Boolean, default: false },
  isActive:    { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ name: 1 }, { unique: true });
module.exports = mongoose.model('Attribute', schema);
