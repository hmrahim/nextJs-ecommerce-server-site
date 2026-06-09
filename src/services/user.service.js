'use strict';
// Business logic helpers for User. Import where you need shared queries.
const User = require('../models/User');

module.exports = {
  findById: (id) => User.findById(id),
  findOne:  (q)  => User.findOne(q),
  count:    (q = {}) => User.countDocuments(q),
};
