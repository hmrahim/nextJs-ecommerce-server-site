'use strict';
const ShippingZone = require('../models/ShippingZone.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(ShippingZone, {
  searchFields: ["name"],
  filterFields: ["isActive"],
  resourceName: 'ShippingZone',
});
