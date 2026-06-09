'use strict';
// Business logic helpers for Notification. Import where you need shared queries.
const Notification = require('../models/Notification.model');

module.exports = {
  findById: (id) => Notification.findById(id),
  findOne:  (q)  => Notification.findOne(q),
  count:    (q = {}) => Notification.countDocuments(q),
};
