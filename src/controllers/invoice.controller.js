'use strict';
const Invoice = require('../models/Invoice.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Invoice, {
  searchFields: ["invoiceNumber"],
  filterFields: ["status","userId","orderId"],
  resourceName: 'Invoice',
});
