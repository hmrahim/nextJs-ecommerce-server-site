'use strict';
const Campaign = require('../models/Campaign.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Campaign, {
  searchFields: ["name","subject"],
  filterFields: ["status","channel"],
  resourceName: 'Campaign',
});
