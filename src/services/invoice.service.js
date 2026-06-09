'use strict';
// Business logic helpers for Invoice. Import where you need shared queries.
const Invoice = require('../models/Invoice.model');

module.exports = {
  findById: (id) => Invoice.findById(id),
  findOne:  (q)  => Invoice.findOne(q),
  count:    (q = {}) => Invoice.countDocuments(q),
};
