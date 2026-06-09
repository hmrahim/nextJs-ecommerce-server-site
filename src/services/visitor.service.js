'use strict';
// Business logic helpers for Visitor. Import where you need shared queries.
const Visitor = require('../models/Visitor.model');

module.exports = {
  findById: (id) => Visitor.findById(id),
  findOne:  (q)  => Visitor.findOne(q),
  count:    (q = {}) => Visitor.countDocuments(q),
};
