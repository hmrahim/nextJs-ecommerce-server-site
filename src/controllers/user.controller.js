'use strict';
const User = require('../models/User');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(User, {
  searchFields: ["firstName","lastName","email","phone"],
  filterFields: ["role","isActive"],
  resourceName: 'User',
});
