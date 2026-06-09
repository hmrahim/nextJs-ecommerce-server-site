'use strict';
const Payout = require('../models/Payout.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Payout, {
  searchFields: [],
  filterFields: ["status","payeeType"],
  resourceName: 'Payout',
});
