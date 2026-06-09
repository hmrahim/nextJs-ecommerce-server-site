'use strict';
// Business logic helpers for Attribute. Import where you need shared queries.
const Attribute = require('../models/Attribute.model');

module.exports = {
  findById: (id) => Attribute.findById(id),
  findOne:  (q)  => Attribute.findOne(q),
  count:    (q = {}) => Attribute.countDocuments(q),
};
