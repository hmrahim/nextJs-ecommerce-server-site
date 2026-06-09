'use strict';
const Promotion = require('../models/Promotion.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Promotion, {
  searchFields: ["name"],
  filterFields: ["type","position","isActive"],
  resourceName: 'Promotion',
});
