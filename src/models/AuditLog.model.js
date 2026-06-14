'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: { type: String, required: true, trim: true }, // e.g. 'Order', 'Product'
    entityId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'view', 'export', 'login', 'logout'],
      required: true,
    },
    oldValues:  { type: mongoose.Schema.Types.Mixed, default: null },
    newValues:  { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress:  { type: String, trim: true },
    userAgent:  { type: String, trim: true },
    createdAt:  { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // auto-delete after 1 year

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
