'use strict';
// Business logic helpers for LoyaltyAccount. Import where you need shared queries.
const LoyaltyAccount = require('../models/LoyaltyAccount.model');

module.exports = {
  findById: (id) => LoyaltyAccount.findById(id),
  findOne:  (q)  => LoyaltyAccount.findOne(q),
  count:    (q = {}) => LoyaltyAccount.countDocuments(q),
};
