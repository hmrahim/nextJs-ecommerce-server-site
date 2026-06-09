'use strict';
// Business logic helpers for Wishlist. Import where you need shared queries.
const Wishlist = require('../models/Wishlist.model');

module.exports = {
  findById: (id) => Wishlist.findById(id),
  findOne:  (q)  => Wishlist.findOne(q),
  count:    (q = {}) => Wishlist.countDocuments(q),
};
