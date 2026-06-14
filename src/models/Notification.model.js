'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['order', 'promo', 'system', 'review', 'shipment', 'payment'],
      required: true,
    },
    title:   { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    data:    { type: mongoose.Schema.Types.Mixed, default: {} }, // contextual payload
    isRead:  { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // auto-delete after 90 days

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
module.exports = Notification;
