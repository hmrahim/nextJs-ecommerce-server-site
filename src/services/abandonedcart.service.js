'use strict';
// Business logic helpers for AbandonedCart. Import where you need shared queries.
const AbandonedCart = require('../models/AbandonedCart.model');

module.exports = {
  findById: (id) => AbandonedCart.findById(id),
  findOne:  (q)  => AbandonedCart.findOne(q),
  count:    (q = {}) => AbandonedCart.countDocuments(q),
};
