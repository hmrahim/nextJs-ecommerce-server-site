'use strict';
// Business logic helpers for LoyaltyTier. Import where you need shared queries.
const LoyaltyTier = require('../models/LoyaltyTier.model');

module.exports = {
  findById: (id) => LoyaltyTier.findById(id),
  findOne:  (q)  => LoyaltyTier.findOne(q),
  count:    (q = {}) => LoyaltyTier.countDocuments(q),
};
