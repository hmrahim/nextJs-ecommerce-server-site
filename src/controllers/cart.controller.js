'use strict';
const Cart = require('../models/Cart.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Cart, {
  searchFields: [],
  filterFields: ["userId","sessionId"],
  resourceName: 'Cart',
});
