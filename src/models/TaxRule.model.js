const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  country:     { type: String, required: true },
  state:       String,
  rate:        { type: Number, required: true, min: 0, max: 100 },
  type:        { type: String, enum:['vat','gst','sales','custom'], default:'vat' },
  categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref:'Category' }],
  isInclusive: { type: Boolean, default: false },
  isActive:    { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('TaxRule', schema);
