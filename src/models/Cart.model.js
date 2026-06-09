
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku:{ type: String, required: true },
    qty:       { type: Number, required: true, min: 1 },
    price:     { type: Number, required: true, min: 0 }, // price snapshot at add-time
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, default: null },  // for guest carts
    items:     { type: [cartItemSchema], default: [] },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes ─────────────────────────────────────────────── */
cartSchema.index({ userId: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

/* ── Virtual: total ──────────────────────────────────────── */
cartSchema.virtual('total').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
});

/* ── Virtual: itemCount ──────────────────────────────────── */
cartSchema.virtual('itemCount').get(function () {
  return this.items.reduce((sum, item) => sum + item.qty, 0);
});

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;
