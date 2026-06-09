'use strict';
// Business logic helpers for Courier. Import where you need shared queries.
const Courier = require('../models/Courier.model');

module.exports = {
  findById: (id) => Courier.findById(id),
  findOne:  (q)  => Courier.findOne(q),
  count:    (q = {}) => Courier.countDocuments(q),
};
