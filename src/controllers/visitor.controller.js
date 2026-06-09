'use strict';
const Visitor = require('../models/Visitor.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Visitor, {
  searchFields: [],
  filterFields: ["country","userId"],
  resourceName: 'Visitor',
});
