'use strict';
const LoyaltyAccount = require('../models/LoyaltyAccount.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(LoyaltyAccount, {
  searchFields: [],
  filterFields: ["userId"],
  resourceName: 'LoyaltyAccount', populate: ["userId","tier"],
});
