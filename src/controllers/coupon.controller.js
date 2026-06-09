'use strict';
const Coupon = require('../models/Coupon.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Coupon, {
  searchFields: ["code"],
  filterFields: ["isActive","type"],
  resourceName: 'Coupon',
});
