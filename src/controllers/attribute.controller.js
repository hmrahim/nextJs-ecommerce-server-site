'use strict';
const Attribute = require('../models/Attribute.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Attribute, {
  searchFields: ["name"],
  filterFields: ["type","isActive"],
  resourceName: 'Attribute',
});
