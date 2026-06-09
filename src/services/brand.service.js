'use strict';
// Business logic helpers for Brand. Import where you need shared queries.
const Brand = require('../models/Brand.model');

module.exports = {
  findById: (id) => Brand.findById(id),
  findOne:  (q)  => Brand.findOne(q),
  count:    (q = {}) => Brand.countDocuments(q),
};
