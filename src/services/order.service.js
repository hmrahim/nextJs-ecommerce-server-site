'use strict';
// Business logic helpers for Order. Import where you need shared queries.
const Order = require('../models/Order.model');

module.exports = {
  findById: (id) => Order.findById(id),
  findOne:  (q)  => Order.findOne(q),
  count:    (q = {}) => Order.countDocuments(q),
};
