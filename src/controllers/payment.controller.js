'use strict';
const Payment = require('../models/Payment.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Payment, {
  searchFields: [],
  filterFields: ["orderId","status","provider"],
  resourceName: 'Payment',
});
