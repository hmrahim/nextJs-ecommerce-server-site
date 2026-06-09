'use strict';
const Wishlist = require('../models/Wishlist.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(Wishlist, {
  searchFields: [],
  filterFields: ["userId"],
  resourceName: 'Wishlist',
});
