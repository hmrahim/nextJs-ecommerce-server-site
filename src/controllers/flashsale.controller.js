'use strict';
const FlashSale = require('../models/FlashSale.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(FlashSale, {
  searchFields: ["name"],
  filterFields: ["status"],
  resourceName: 'FlashSale',
});
