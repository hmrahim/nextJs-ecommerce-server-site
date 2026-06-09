'use strict';
const Bundle = require('../models/Bundle.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Bundle, {
  searchFields: ["name"],
  filterFields: ["isActive"],
  resourceName: 'Bundle',
});
