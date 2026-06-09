const mongoose = require('mongoose');
'use strict';

const eventSchema = new mongoose.Schema({ status: String, location: String, description: String, at: { type: Date, default: Date.now } }, { _id: true });
const schema = new mongoose.Schema({
  orderId:     { type: mongoose.Schema.Types.ObjectId, ref:'Order', required: true, index: true },
  shipmentId:  { type: mongoose.Schema.Types.ObjectId, ref:'Shipment' },
  courierId:   { type: mongoose.Schema.Types.ObjectId, ref:'Courier' },
  trackingNumber:{ type: String, required: true, index: true },
  status:      { type: String, enum:['label_created','in_transit','out_for_delivery','delivered','exception','returned'], default:'label_created' },
  estimatedDelivery: Date,
  events:      { type: [eventSchema], default: [] },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false, toJSON: { virtuals: true } });
module.exports = mongoose.model('Tracking', schema);
