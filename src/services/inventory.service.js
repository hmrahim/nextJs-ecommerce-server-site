'use strict';
// Business logic helpers for Inventory. Import where you need shared queries.
const Inventory = require('../models/Inventory.model');

module.exports = {
  findById: (id) => Inventory.findById(id),
  findOne:  (q)  => Inventory.findOne(q),
  count:    (q = {}) => Inventory.countDocuments(q),
};
