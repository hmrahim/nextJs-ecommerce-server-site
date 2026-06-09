'use strict';
const Order = require('../models/Order.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Order, {
  searchFields: ["orderNumber"],
  filterFields: ["userId","status","paymentStatus"],
  resourceName: 'Order', populate: ["userId"],
});
