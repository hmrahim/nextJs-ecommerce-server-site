'use strict';
// Business logic helpers for LoyaltyRule. Import where you need shared queries.
const LoyaltyRule = require('../models/LoyaltyRule.model');

module.exports = {
  findById: (id) => LoyaltyRule.findById(id),
  findOne:  (q)  => LoyaltyRule.findOne(q),
  count:    (q = {}) => LoyaltyRule.countDocuments(q),
};
