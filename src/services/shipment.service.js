'use strict';
// Business logic helpers for Shipment. Import where you need shared queries.
const Shipment = require('../models/Shipment.model');

module.exports = {
  findById: (id) => Shipment.findById(id),
  findOne:  (q)  => Shipment.findOne(q),
  count:    (q = {}) => Shipment.countDocuments(q),
};
