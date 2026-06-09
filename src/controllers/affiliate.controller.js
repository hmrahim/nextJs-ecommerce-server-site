'use strict';
const Affiliate = require('../models/Affiliate.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Affiliate, {
  searchFields: ["name","email","code"],
  filterFields: ["status"],
  resourceName: 'Affiliate',
});
