'use strict';
// Business logic helpers for Setting. Import where you need shared queries.
const Setting = require('../models/Setting.model');

module.exports = {
  findById: (id) => Setting.findById(id),
  findOne:  (q)  => Setting.findOne(q),
  count:    (q = {}) => Setting.countDocuments(q),
};
