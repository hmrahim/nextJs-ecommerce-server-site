'use strict';
// Business logic helpers for Affiliate. Import where you need shared queries.
const Affiliate = require('../models/Affiliate.model');

module.exports = {
  findById: (id) => Affiliate.findById(id),
  findOne:  (q)  => Affiliate.findOne(q),
  count:    (q = {}) => Affiliate.countDocuments(q),
};
