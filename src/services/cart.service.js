'use strict';
// Business logic helpers for Cart. Import where you need shared queries.
const Cart = require('../models/Cart.model');

module.exports = {
  findById: (id) => Cart.findById(id),
  findOne:  (q)  => Cart.findOne(q),
  count:    (q = {}) => Cart.countDocuments(q),
};
