'use strict';

const mongoose = require('mongoose');

const searchLogSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = guest
    query:        { type: String, required: true, trim: true, maxlength: 500 },
    resultsCount: { type: Number, default: 0 },
    searchedAt:   { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
searchLogSchema.index({ userId: 1 });
searchLogSchema.index({ query: 'text' });
searchLogSchema.index({ searchedAt: -1 });
searchLogSchema.index({ searchedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 }); // auto-delete after 180 days

const SearchLog = mongoose.model('SearchLog', searchLogSchema);
module.exports = SearchLog;
