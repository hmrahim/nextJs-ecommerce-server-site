'use strict';
// Business logic helpers for Ticket. Import where you need shared queries.
const Ticket = require('../models/Ticket.model');

module.exports = {
  findById: (id) => Ticket.findById(id),
  findOne:  (q)  => Ticket.findOne(q),
  count:    (q = {}) => Ticket.countDocuments(q),
};
