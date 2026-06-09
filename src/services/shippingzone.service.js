'use strict';
// Business logic helpers for ShippingZone. Import where you need shared queries.
const ShippingZone = require('../models/ShippingZone.model');

module.exports = {
  findById: (id) => ShippingZone.findById(id),
  findOne:  (q)  => ShippingZone.findOne(q),
  count:    (q = {}) => ShippingZone.countDocuments(q),
};
