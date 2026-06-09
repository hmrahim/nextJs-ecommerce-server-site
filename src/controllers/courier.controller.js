'use strict';
const Courier = require('../models/Courier.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Courier, {
  searchFields: ["name","code"],
  filterFields: ["isActive"],
  resourceName: 'Courier',
});
