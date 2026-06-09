'use strict';
const Return = require('../models/Return.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Return, {
  searchFields: [],
  filterFields: ["status","userId","orderId"],
  resourceName: 'Return',
});
