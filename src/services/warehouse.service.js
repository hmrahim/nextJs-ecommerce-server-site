'use strict';
// Business logic helpers for Warehouse. Import where you need shared queries.
const Warehouse = require('../models/Warehouse.model');

module.exports = {
  findById: (id) => Warehouse.findById(id),
  findOne:  (q)  => Warehouse.findOne(q),
  count:    (q = {}) => Warehouse.countDocuments(q),
};
