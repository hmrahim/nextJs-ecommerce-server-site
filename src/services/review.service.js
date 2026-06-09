'use strict';
// Business logic helpers for Review. Import where you need shared queries.
const Review = require('../models/Review.model');

module.exports = {
  findById: (id) => Review.findById(id),
  findOne:  (q)  => Review.findOne(q),
  count:    (q = {}) => Review.countDocuments(q),
};
