const mongoose = require('mongoose');
'use strict';

const replySchema = new mongoose.Schema({ from: { type: String, enum:['customer','agent','admin'] }, userId: { type: mongoose.Schema.Types.ObjectId, ref:'User' }, message: String, attachments: [String], at: { type: Date, default: Date.now } }, { _id: true });
const schema = new mongoose.Schema({
  ticketNumber:{ type: String, unique: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true },
  subject:    { type: String, required: true },
  description:String,
  priority:   { type: String, enum:['low','medium','high','urgent'], default:'medium' },
  category:   { type: String, default: 'general' },
  status:     { type: String, enum:['open','pending','resolved','closed'], default:'open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  replies:    { type: [replySchema], default: [] },
  closedAt:   Date,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.pre('save', function(next){
  if (!this.ticketNumber) this.ticketNumber = 'TKT-' + Date.now().toString(36).toUpperCase();
  next();
});
module.exports = mongoose.model('Ticket', schema);
