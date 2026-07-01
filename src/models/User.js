// 📁 PATH: src/models/User.js
// ✅ CHANGES: Added emailOtp + emailOtpExpires fields for email verification
'use strict';

const mongoose = require('mongoose');

/* ─── Address Sub-schema ─────────────────────────────────────── */
const addressSchema = new mongoose.Schema(
  {
    street:    { type: String, trim: true },
    city:      { type: String, trim: true },
    state:     { type: String, trim: true },
    country:   { type: String, trim: true },
    zipCode:   { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

/* ─── Saved Card Sub-schema ──────────────────────────────────── */
const savedCardSchema = new mongoose.Schema(
  {
    type:        { type: String, enum: ['visa', 'mastercard', 'amex', 'other'], required: true },
    last4:       { type: String, length: 4 },
    expiryMonth: { type: Number },
    expiryYear:  { type: Number },
    isDefault:   { type: Boolean, default: false },
  },
  { _id: true }
);

/* ─── Rider Profile Sub-schema (only for role=rider) ─────────── */
const riderProfileSchema = new mongoose.Schema(
  {
    vehicleType:    { type: String, enum: ['bike', 'car', 'van', 'cycle', 'foot'], default: 'bike' },
    vehicleNumber:  { type: String, trim: true, default: null },
    nidNumber:      { type: String, trim: true, default: null },
    licenseNumber:  { type: String, trim: true, default: null },
    serviceAreas:   { type: [String], default: [] },
    isAvailable:    { type: Boolean, default: true },
    activeOrders:   { type: Number, default: 0, min: 0 },
    completedOrders:{ type: Number, default: 0, min: 0 },
    rating:         { type: Number, default: 5.0, min: 0, max: 5 },
    joinedAt:       { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ─── Main User Schema ───────────────────────────────────────── */
const userSchema = new mongoose.Schema(
  {
    firstName:    { type: String, required: true, trim: true, maxlength: 50 },
    lastName:     { type: String, required: true, trim: true, maxlength: 50 },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:        { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },

    role: {
      type:    String,
      enum:    ['admin', 'buyer', 'seller', 'rider', 'manager'],
      default: 'buyer',
      index:   true,
    },

    avatar:        { type: String, default: null },
    isActive:      { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    isBanned:      { type: Boolean, default: false },
    banReason:     { type: String, default: '' },
    tags:          { type: [String], default: [] },
    notes:         [
      {
        text:      { type: String, required: true },
        author:    { type: String, default: 'Admin' },
        createdAt: { type: Date, default: Date.now },
      }
    ],

    // ── ✅ Email OTP for verification ───────────────────────────
    emailOtp:        { type: String, select: false },
    emailOtpExpires: { type: Date,   select: false },
    // ────────────────────────────────────────────────────────────

    addresses:  { type: [addressSchema], default: [] },
    savedCards: { type: [savedCardSchema], default: [] },

    riderProfile: { type: riderProfileSchema, default: null },

    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, 'riderProfile.isAvailable': 1 });

/* ── Auto-initialise riderProfile when role becomes rider ─ */
userSchema.pre('save', function (next) {
  if (this.role === 'rider' && !this.riderProfile) {
    this.riderProfile = {};
  }
  next();
});

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailOtp;
  delete obj.emailOtpExpires;
  return obj;
};

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = User;