const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  ip:        String,
  userAgent: String,
  country:   String,
  city:      String,
  device:    String,
  referrer:  String,
  pages:     [{ url: String, at: { type: Date, default: Date.now } }],
  duration:  { type: Number, default: 0 },
  lastSeen:  { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.index({ lastSeen: -1 });
module.exports = mongoose.model('Visitor', schema);
