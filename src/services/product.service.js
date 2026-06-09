'use strict';
// Business logic helpers for Product. Import where you need shared queries.
const Product = require('../models/Product.model');

module.exports = {
  findById: (id) => Product.findById(id),
  findOne:  (q)  => Product.findOne(q),
  count:    (q = {}) => Product.countDocuments(q),
};
