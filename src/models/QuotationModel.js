'use strict';

const mongoose = require('mongoose');

/* ── Embedded sub-schemas ────────────────────────────────── */

const quotationItemSchema = new mongoose.Schema(
  {
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    variantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', default: null },
    name:         { type: String, required: true, trim: true },
    sku:          { type: String, default: '', trim: true },
    variantTitle: { type: String, default: null, trim: true },
    qty:          { type: Number, required: true, min: 1 },
    unit:         { type: String, default: 'pcs', trim: true },
    specs: [
      {
        key:   { type: String, trim: true },
        value: { type: String, trim: true },
      },
    ],
    targetPrice: { type: Number, default: null, min: 0 },
    itemNote:    { type: String, default: '', trim: true },
    fromDB:      { type: Boolean, default: false },
    image:       { type: String, default: null, trim: true },
    // ── Admin fills these on approve ──
    unitPrice:   { type: Number, default: 0, min: 0 },
    discount:    { type: Number, default: 0, min: 0, max: 100 },
    total:       { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const companyInfoSchema = new mongoose.Schema(
  {
    companyName:   { type: String, required: true, trim: true },
    vatNumber:     { type: String, required: true, trim: true },
    crNumber:      { type: String, default: '', trim: true },
    contactPerson: { type: String, required: true, trim: true },
    contactPhone:  { type: String, required: true, trim: true },
    address:       { type: String, default: '', trim: true },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status:    { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    note:      { type: String, default: '' },
  },
  { _id: false }
);

/* ── Main schema ─────────────────────────────────────────── */

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, unique: true }, // auto-generated
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    items:       { type: [quotationItemSchema], required: true, validate: [(v) => v.length > 0, 'At least one item is required'] },
    companyInfo: { type: companyInfoSchema, required: true },
    notes:       { type: String, default: '', trim: true },

    // ── Pricing (admin fills on approve) ──
    subtotal:  { type: Number, default: 0, min: 0 },
    tax:       { type: Number, default: 0, min: 0 },
    shipping:  { type: Number, default: 0, min: 0 },
    total:     { type: Number, default: 0, min: 0 },

    // ── Status ──
    status: {
      type: String,
      enum: ['pending', 'approved', 'accepted', 'rejected', 'expired'],
      default: 'pending',
    },
    statusHistory: { type: [statusHistorySchema], default: [] },

    // ── Admin fields ──
    adminNote:   { type: String, default: '', trim: true },
    approvedAt:  { type: Date, default: null },
    validUntil:  { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
quotationSchema.index({ quotationNumber: 1 }, { unique: true });
quotationSchema.index({ userId: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ userId: 1, status: 1 });

/* ── Pre-save: generate quotation number ─────────────────── */
quotationSchema.pre('save', async function (next) {
  if (!this.quotationNumber) {
    const ts   = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.quotationNumber = `QT-${ts}-${rand}`;
  }
  // Push status history on status change
  if (this.isModified('status')) {
    this.statusHistory.push({ status: this.status, changedAt: new Date() });
  }
  next();
});

/* ── Virtual: id ─────────────────────────────────────────── */
quotationSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const Quotation = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
module.exports = Quotation;