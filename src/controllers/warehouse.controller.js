'use strict';
const Warehouse = require('../models/Warehouse.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Warehouse, {
  searchFields: ["name","code"],
  filterFields: ["isActive"],
  resourceName: 'Warehouse',
});
