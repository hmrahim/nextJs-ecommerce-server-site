/**
 * 📁 models/OrderModel.js
 *
 * Order model — full e-commerce flow with rider assignment + COD/Online payment.
 *
 * Status flow:
 *   pending → confirmed (rider assigned) → shipped (picked up) → delivered (paid) → completed
 *                                                              ↘ cancelled / refunded
 */

const mongoose = require('mongoose');

/* ─── Sub-schemas ──────────────────────────────────────────────── */

const OrderItemSchema = new mongoose.Schema(
  {
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku:   { type: String, default: 'default' },
    productName:  { type: String, required: true },
    productImage: { type: String, default: '' },
    variantAttrs: { type: mongoose.Schema.Types.Mixed, default: null },
    quantity:     { type: Number, required: true, min: 1 },
    unitPrice:    { type: Number, required: true, min: 0 },
    lineTotal:    { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ShippingAddressSchema = new mongoose.Schema(
  {
    firstName:  { type: String, required: true, trim: true },
    lastName:   { type: String, required: true, trim: true },
    phone:      { type: String, required: true, trim: true },
    email:      { type: String, trim: true, default: null },
    addrType:   { type: String, enum: ['home', 'office'], default: 'home' },
    lat:        { type: Number, default: null },
    lng:        { type: Number, default: null },
    mapAddress: { type: String, default: null },
    houseNo:    { type: String, default: null },
    road:       { type: String, default: null },
    area:       { type: String, default: null },
    city:       { type: String, default: null },
    postalCode: { type: String, default: null },
    landmark:   { type: String, default: null },
    note:       { type: String, default: null },
  },
  { _id: false }
);

const StatusHistorySchema = new mongoose.Schema(
  {
    status:    { type: String, required: true },
    note:      { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ─── Rider assignment block ───────────────────────────────────── */
const RiderAssignmentSchema = new mongoose.Schema(
  {
    riderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    riderName:   { type: String, default: null },
    riderPhone:  { type: String, default: null },
    vehicleType: { type: String, default: null },
    assignedAt:  { type: Date, default: null },
    assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    pickedUpAt:  { type: Date, default: null },   // when rider marks shipped
    deliveredAt: { type: Date, default: null },
    note:        { type: String, default: null },
  },
  { _id: false }
);

/* ─── Payment collection block (filled by rider at delivery) ──── */
const PaymentCollectionSchema = new mongoose.Schema(
  {
    method:        { type: String, enum: ['cod', 'bkash', 'nagad', 'rocket', 'card', 'bank', 'other', null], default: null },
    amount:        { type: Number, default: 0 },
    transactionId: { type: String, default: null },
    note:          { type: String, default: null },
    collectedAt:   { type: Date, default: null },
    collectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

/* ─── Main Order Schema ────────────────────────────────────────── */

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },

    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    items: {
      type:     [OrderItemSchema],
      validate: { validator: (v) => v.length > 0, message: 'Order must have at least one item' },
    },

    shippingAddress: { type: ShippingAddressSchema, required: true },
    deliveryMethod:  {
      type:    String,
      enum:    ['standard', 'express', 'sameday'],
      default: 'standard',
    },

    /* ── Payment ── */
    paymentMethod: {
      type:     String,
      // expanded — supports COD + online + mobile banking + card + bank
      enum:     ['cod', 'card', 'bkash', 'nagad', 'rocket', 'bank', 'mfs'],
      required: true,
    },
    paymentStatus: {
      type:    String,
      enum:    ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentCollection: { type: PaymentCollectionSchema, default: () => ({}) },

    /* ── Financials ── */
    subtotal:       { type: Number, required: true, min: 0 },
    shippingCost:   { type: Number, default: 0, min: 0 },
    couponCode:     { type: String, default: null },
    couponDiscount: { type: Number, default: 0, min: 0 },
    total:          { type: Number, required: true, min: 0 },

    /* ── Order status ── */
    status: {
      type:    String,
      enum:    ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
      index:   true,
    },
    statusHistory: { type: [StatusHistorySchema], default: [] },

    /* ── Rider assignment ── */
    rider: { type: RiderAssignmentSchema, default: () => ({}) },

    /* ── Timestamps ── */
    placedAt:    { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
    shippedAt:   { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

/* ─── Virtuals ─────────────────────────────────────────────────── */
OrderSchema.virtual('customerName').get(function () {
  if (this.userId?.firstName) {
    return `${this.userId.firstName} ${this.userId.lastName || ''}`.trim();
  }
  return null;
});
OrderSchema.virtual('customerEmail').get(function () { return this.userId?.email ?? null; });
OrderSchema.virtual('customerPhone').get(function () { return this.shippingAddress?.phone ?? null; });

/* ─── Auto orderNumber & initial history ─────────────────────── */
OrderSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  if (this.statusHistory.length === 0) {
    this.statusHistory.push({ status: 'pending', note: 'Order placed' });
  }
  if (!this.orderNumber) {
    const last = await this.constructor.findOne({}, {}, { sort: { createdAt: -1 } }).select('orderNumber');
    let next_num = 10001;
    if (last?.orderNumber) {
      const num = parseInt(last.orderNumber.replace('ORD-', ''), 10);
      if (!isNaN(num)) next_num = num + 1;
    }
    this.orderNumber = `ORD-${next_num}`;
  }
  next();
});

/* ─── Indexes ──────────────────────────────────────────────────── */
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'items.productId': 1 });
OrderSchema.index({ 'rider.riderId': 1, status: 1 });

module.exports = mongoose.model('Order', OrderSchema);
