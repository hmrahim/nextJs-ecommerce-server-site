'use strict';
// Business logic helpers for Category. Import where you need shared queries.
const Category = require('../models/Category.model');

module.exports = {
  findById: (id) => Category.findById(id),
  findOne:  (q)  => Category.findOne(q),
  count:    (q = {}) => Category.countDocuments(q),
};
