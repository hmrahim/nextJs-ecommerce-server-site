'use strict';
const Setting = require('../models/Setting.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Setting, {
  searchFields: ["key"],
  filterFields: ["group"],
  resourceName: 'Setting',
});
