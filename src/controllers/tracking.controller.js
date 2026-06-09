'use strict';
const Tracking = require('../models/Tracking.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Tracking, {
  searchFields: ["trackingNumber"],
  filterFields: ["status","orderId"],
  resourceName: 'Tracking',
});
