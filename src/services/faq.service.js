'use strict';
// Business logic helpers for Faq. Import where you need shared queries.
const Faq = require('../models/Faq.model');

module.exports = {
  findById: (id) => Faq.findById(id),
  findOne:  (q)  => Faq.findOne(q),
  count:    (q = {}) => Faq.countDocuments(q),
};
