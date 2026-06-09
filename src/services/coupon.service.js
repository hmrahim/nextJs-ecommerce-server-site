'use strict';
// Business logic helpers for Coupon. Import where you need shared queries.
const Coupon = require('../models/Coupon.model');

module.exports = {
  findById: (id) => Coupon.findById(id),
  findOne:  (q)  => Coupon.findOne(q),
  count:    (q = {}) => Coupon.countDocuments(q),
};
