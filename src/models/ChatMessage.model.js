const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  roomId:   { type: mongoose.Schema.Types.ObjectId, ref:'ChatRoom', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  senderRole:{ type: String, enum:['customer','agent','admin','system'], default:'customer' },
  message:  { type: String, required: true },
  attachments: [String],
  readAt:   Date,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('ChatMessage', schema);
