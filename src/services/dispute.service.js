'use strict';
// Business logic helpers for Dispute. Import where you need shared queries.
const Dispute = require('../models/Dispute.model');

module.exports = {
  findById: (id) => Dispute.findById(id),
  findOne:  (q)  => Dispute.findOne(q),
  count:    (q = {}) => Dispute.countDocuments(q),
};
