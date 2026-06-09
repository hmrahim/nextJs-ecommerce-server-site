'use strict';
// Business logic helpers for Payout. Import where you need shared queries.
const Payout = require('../models/Payout.model');

module.exports = {
  findById: (id) => Payout.findById(id),
  findOne:  (q)  => Payout.findOne(q),
  count:    (q = {}) => Payout.countDocuments(q),
};
