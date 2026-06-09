'use strict';
// Business logic helpers for Promotion. Import where you need shared queries.
const Promotion = require('../models/Promotion.model');

module.exports = {
  findById: (id) => Promotion.findById(id),
  findOne:  (q)  => Promotion.findOne(q),
  count:    (q = {}) => Promotion.countDocuments(q),
};
