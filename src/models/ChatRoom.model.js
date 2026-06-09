const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  customerName: String,
  customerEmail:String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  subject:    String,
  status:     { type: String, enum:['open','pending','closed'], default:'open' },
  lastMessageAt: Date,
  unreadCount:{ type: Number, default: 0 },
  tags:       [String],
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('ChatRoom', schema);
