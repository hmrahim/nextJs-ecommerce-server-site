'use strict';
const AbandonedCart = require('../models/AbandonedCart.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(AbandonedCart, {
  searchFields: [],
  filterFields: ["recovered"],
  resourceName: 'AbandonedCart',
});
