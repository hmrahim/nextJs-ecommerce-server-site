'use strict';
// Business logic helpers for Tracking. Import where you need shared queries.
const Tracking = require('../models/Tracking.model');

module.exports = {
  findById: (id) => Tracking.findById(id),
  findOne:  (q)  => Tracking.findOne(q),
  count:    (q = {}) => Tracking.countDocuments(q),
};
