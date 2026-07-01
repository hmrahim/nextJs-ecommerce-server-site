const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku:{ type: String, required: true },
    qty:       { type: Number, required: true, min: 1 },
    price:     { type: Number, required: true, min: 0 },
    bundleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle', default: null },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, default: null },
    items:     { type: [cartItemSchema], default: [] },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
/* ── Indexes ─────────────────────────────────────────────── */
cartSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { exists: true, ne: null } } }
);
cartSchema.index(
  { sessionId: 1 },
  { unique: true, partialFilterExpression: { sessionId: { exists: true, ne: null } } }
);
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* ── Virtuals ────────────────────────────────────────────── */
cartSchema.virtual('total').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
});
cartSchema.virtual('itemCount').get(function () {
  return this.items.reduce((sum, item) => sum + item.qty, 0);
});

const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
module.exports = Cart;