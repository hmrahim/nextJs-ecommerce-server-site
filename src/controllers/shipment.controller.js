'use strict';
const Shipment = require('../models/Shipment.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Shipment, {
  searchFields: [],
  filterFields: ["orderId","status","courierId"],
  resourceName: 'Shipment',
});
