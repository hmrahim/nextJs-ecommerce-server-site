'use strict';
// Business logic helpers for TaxRule. Import where you need shared queries.
const TaxRule = require('../models/TaxRule.model');

module.exports = {
  findById: (id) => TaxRule.findById(id),
  findOne:  (q)  => TaxRule.findOne(q),
  count:    (q = {}) => TaxRule.countDocuments(q),
};
