// 📁 PATH: src/models/Visitor.model.js
'use strict';

const mongoose = require('mongoose');

/* ── Single page-hit inside a session ────────────────────────── */
const pageHitSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, trim: true, maxlength: 500 },
    at:   { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ── Visitor session ─────────────────────────────────────────── */
const visitorSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, trim: true },

    // Identity (optional — filled in if the visitor is logged in)
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email:        { type: String, default: null },
    isRegistered: { type: Boolean, default: false },

    // Network / location
    ip:         { type: String, trim: true, default: null },
    country:    { type: String, trim: true, default: 'Unknown' },
    countryCode:{ type: String, trim: true, default: null },
    city:       { type: String, trim: true, default: 'Unknown' },
    region:     { type: String, trim: true, default: null },
    lat:        { type: Number, default: null },
    lng:        { type: Number, default: null },
    streetAddress: { type: String, default: null },
    timezone:   { type: String, default: null },
    isp:        { type: String, default: null },
    postalCode: { type: String, default: null },
    currency:   { type: String, default: null },

    // Device / client
    device:           { type: String, enum: ['Mobile', 'Desktop', 'Tablet'], default: 'Desktop' },
    os:               { type: String, default: 'Unknown' },
    browser:          { type: String, default: 'Unknown' },
    screenResolution: { type: String, default: null },
    connectionType:   { type: String, default: null },
    language:         { type: String, default: null },

    // Acquisition
    source:      { type: String, enum: ['Direct', 'Organic Search', 'Social Media', 'Referral', 'Email'], default: 'Direct' },
    referrerUrl: { type: String, default: null },

    // Journey
    entryPage:    { type: String, default: '/' },
    exitPage:     { type: String, default: '/' },
    pages:        { type: [pageHitSchema], default: [] },
    pagesVisited: { type: Number, default: 0 },

    // Behaviour
    scrollDepth: { type: Number, default: 0, min: 0, max: 100 },
    clickCount:  { type: Number, default: 0 },
    cartAdded:   { type: Boolean, default: false },
    purchased:   { type: Boolean, default: false },

    // Recurrence (snapshotted at session creation)
    visitCount:  { type: Number, default: 1 },
    isReturning: { type: Boolean, default: false },

    firstSeenAt:  { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
visitorSchema.index({ sessionId: 1 }, { unique: true });
visitorSchema.index({ lastActiveAt: -1 });
visitorSchema.index({ ip: 1 });
visitorSchema.index({ userId: 1 });
visitorSchema.index({ firstSeenAt: -1 });
visitorSchema.index({ ip: 'text', city: 'text', country: 'text' }, { language_override: 'none' });
// Auto-purge sessions that have been inactive for 90 days
visitorSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Visitor = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
module.exports = Visitor;
