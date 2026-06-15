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
    vehicleType:   { type: String, enum: ['bike', 'car', 'van', 'cycle', 'foot'], default: 'bike' },
    vehicleNumber: { type: String, trim: true, default: null },
    nidNumber:     { type: String, trim: true, default: null },
    licenseNumber: { type: String, trim: true, default: null },
    serviceAreas:  { type: [String], default: [] },          // ['Dhanmondi', 'Mirpur', ...]
    isAvailable:   { type: Boolean, default: true },         // currently accepting orders
    activeOrders:  { type: Number, default: 0, min: 0 },     // in-progress count
    completedOrders: { type: Number, default: 0, min: 0 },
    rating:        { type: Number, default: 5.0, min: 0, max: 5 },
    joinedAt:      { type: Date, default: Date.now },
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

    /* role — admin/buyer/seller/rider/manager etc. */
    role: {
      type:    String,
      enum:    ['admin', 'buyer', 'seller', 'rider', 'manager'],
      default: 'buyer',
      index:   true,
    },

    avatar:        { type: String, default: null },
    isActive:      { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },

    addresses:  { type: [addressSchema], default: [] },
    savedCards: { type: [savedCardSchema], default: [] },

    /* Rider-only profile data */
    riderProfile: { type: riderProfileSchema, default: null },

    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
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
  if (this.role !== 'rider') {
    // keep historical profile but ignore — optional: this.riderProfile = null;
  }
  next();
});

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = User;
