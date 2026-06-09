'use strict';
// Business logic helpers for GiftCard. Import where you need shared queries.
const GiftCard = require('../models/GiftCard.model');

module.exports = {
  findById: (id) => GiftCard.findById(id),
  findOne:  (q)  => GiftCard.findOne(q),
  count:    (q = {}) => GiftCard.countDocuments(q),
};
