'use strict';
// Business logic helpers for Transaction. Import where you need shared queries.
const Transaction = require('../models/Transaction.model');

module.exports = {
  findById: (id) => Transaction.findById(id),
  findOne:  (q)  => Transaction.findOne(q),
  count:    (q = {}) => Transaction.countDocuments(q),
};
