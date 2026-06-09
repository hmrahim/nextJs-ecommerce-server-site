const mongoose = require('mongoose');
'use strict';

const schema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref:'Order', required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref:'User', required: true },
  amount:     { type: Number, required: true, min: 0 },
  tax:        { type: Number, default: 0, min: 0 },
  total:      { type: Number, required: true, min: 0 },
  currency:   { type: String, default: 'USD' },
  status:     { type: String, enum:['draft','sent','paid','overdue','void'], default:'draft' },
  dueDate:    Date,
  paidAt:     Date,
  pdfUrl:     String,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
schema.pre('save', function(next){
  if (!this.invoiceNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    this.invoiceNumber = 'INV-' + ts + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
  }
  next();
});
module.exports = mongoose.model('Invoice', schema);
