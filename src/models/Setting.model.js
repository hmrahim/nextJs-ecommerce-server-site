const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  key:    { type: String, required: true, unique: true, trim: true },
  value:  { type: mongoose.Schema.Types.Mixed },
  group:  { type: String, default: 'general' },
  type:   { type: String, default: 'string' },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ key: 1 }, { unique: true });
module.exports = mongoose.model('Setting', schema);
