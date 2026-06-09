const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  type:      { type: String, enum:['banner','popup','strip','sidebar'], default:'banner' },
  image:     String,
  link:      String,
  position:  { type: String, enum:['home_top','home_middle','home_bottom','category','product','checkout'], default:'home_top' },
  startsAt:  Date,
  endsAt:    Date,
  priority:  { type: Number, default: 0 },
  clicks:    { type: Number, default: 0 },
  impressions:{ type: Number, default: 0 },
  isActive:  { type: Boolean, default: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Promotion', schema);
