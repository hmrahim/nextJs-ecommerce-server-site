'use strict';
const Inventory = require('../models/Inventory.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Inventory, {
  searchFields: ["variantSku"],
  filterFields: ["warehouseId","productId"],
  resourceName: 'Inventory', populate: ["productId","warehouseId"],
});
