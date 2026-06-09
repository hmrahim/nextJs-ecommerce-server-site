'use strict';
// Business logic helpers for FlashSale. Import where you need shared queries.
const FlashSale = require('../models/FlashSale.model');

module.exports = {
  findById: (id) => FlashSale.findById(id),
  findOne:  (q)  => FlashSale.findOne(q),
  count:    (q = {}) => FlashSale.countDocuments(q),
};
