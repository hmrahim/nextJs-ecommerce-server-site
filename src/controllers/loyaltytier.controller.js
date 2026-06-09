'use strict';
const LoyaltyTier = require('../models/LoyaltyTier.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(LoyaltyTier, {
  searchFields: ["name"],
  filterFields: [],
  resourceName: 'LoyaltyTier',
});
