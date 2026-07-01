// 📁 PATH: src/models/EmailLog.model.js
'use strict';

const mongoose = require('mongoose');

/* ─── Single recipient result sub-schema ─────────────────────── */
const recipientResultSchema = new mongoose.Schema(
  {
    email:   { type: String, required: true, trim: true, lowercase: true },
    name:    { type: String, trim: true, default: '' },
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status:  { type: String, enum: ['sent', 'failed'], default: 'sent' },
    error:   { type: String, default: null },
  },
  { _id: false }
);

/* ─── Email Log — one document per "send" action from the admin dashboard ─ */
const emailLogSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true }, // plain text body typed by admin

    recipientMode: {
      type: String,
      enum: ['custom', 'users', 'mixed', 'all'],
      default: 'mixed',
    },

    recipients:   { type: [recipientResultSchema], default: [] },
    totalCount:   { type: Number, default: 0 },
    sentCount:    { type: Number, default: 0 },
    failedCount:  { type: Number, default: 0 },

    sentBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sentByName: { type: String, trim: true, default: 'Admin' },
  },
  { timestamps: true }
);

emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ sentBy: 1 });

const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
module.exports = EmailLog;