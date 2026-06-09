'use strict';
// Business logic helpers for Bundle. Import where you need shared queries.
const Bundle = require('../models/Bundle.model');

module.exports = {
  findById: (id) => Bundle.findById(id),
  findOne:  (q)  => Bundle.findOne(q),
  count:    (q = {}) => Bundle.countDocuments(q),
};
