'use strict';
// Business logic helpers for Payment. Import where you need shared queries.
const Payment = require('../models/Payment.model');

module.exports = {
  findById: (id) => Payment.findById(id),
  findOne:  (q)  => Payment.findOne(q),
  count:    (q = {}) => Payment.countDocuments(q),
};
