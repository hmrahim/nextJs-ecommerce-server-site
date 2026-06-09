'use strict';
// Business logic helpers for Return. Import where you need shared queries.
const Return = require('../models/Return.model');

module.exports = {
  findById: (id) => Return.findById(id),
  findOne:  (q)  => Return.findOne(q),
  count:    (q = {}) => Return.countDocuments(q),
};
