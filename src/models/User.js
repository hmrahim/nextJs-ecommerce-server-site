
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const savedCardSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['visa', 'mastercard', 'amex', 'other'], required: true },
    last4: { type: String, length: 4 },
    expiryMonth: { type: Number, },
    expiryYear: { type: Number, },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'buyer', 'seller'], default: 'buyer' },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    addresses: { type: [addressSchema], default: [] },
    savedCards: { type: [savedCardSchema], default: [] },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

/* ── Pre-save: hash password ─────────────────────────────── */

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

/* ── Virtual: fullName ───────────────────────────────────── */
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

const User = mongoose.model('User', userSchema);
module.exports = User;
