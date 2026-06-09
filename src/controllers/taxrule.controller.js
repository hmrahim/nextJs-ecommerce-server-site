'use strict';
const TaxRule = require('../models/TaxRule.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(TaxRule, {
  searchFields: ["name","country"],
  filterFields: ["country","type","isActive"],
  resourceName: 'TaxRule',
});
