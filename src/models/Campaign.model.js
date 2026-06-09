const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  channel:    { type: String, enum:['email','sms','push','social','other'], default:'email' },
  subject:    String,
  message:    String,
  audience:   { type: String, enum:['all','buyers','sellers','vip','custom'], default:'all' },
  segmentIds: [String],
  scheduledAt:Date,
  sentAt:     Date,
  status:     { type: String, enum:['draft','scheduled','sending','sent','paused','cancelled'], default:'draft' },
  stats: {
    sent:    { type: Number, default: 0 },
    opened:  { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    failed:  { type: Number, default: 0 },
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Campaign', schema);
