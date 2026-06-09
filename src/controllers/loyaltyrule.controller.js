'use strict';
const LoyaltyRule = require('../models/LoyaltyRule.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(LoyaltyRule, {
  searchFields: ["name"],
  filterFields: ["event","isActive"],
  resourceName: 'LoyaltyRule',
});
