'use strict';
// Business logic helpers for Campaign. Import where you need shared queries.
const Campaign = require('../models/Campaign.model');

module.exports = {
  findById: (id) => Campaign.findById(id),
  findOne:  (q)  => Campaign.findOne(q),
  count:    (q = {}) => Campaign.countDocuments(q),
};
