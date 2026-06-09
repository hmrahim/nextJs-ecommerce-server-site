'use strict';
const Transaction = require('../models/Transaction.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Transaction, {
  searchFields: [],
  filterFields: ["type","status","gateway","userId","orderId"],
  resourceName: 'Transaction',
});
