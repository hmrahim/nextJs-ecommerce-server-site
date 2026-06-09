'use strict';
const Brand = require('../models/Brand.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Brand, {
  searchFields: ["name","slug"],
  filterFields: ["isActive"],
  resourceName: 'Brand',
});
