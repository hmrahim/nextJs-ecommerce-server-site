'use strict';
const Dispute = require('../models/Dispute.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Dispute, {
  searchFields: ["subject"],
  filterFields: ["status","reason","userId","orderId"],
  resourceName: 'Dispute', populate: ["userId","orderId"],
});
