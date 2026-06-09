'use strict';
// Business logic helpers for ChatMessage. Import where you need shared queries.
const ChatMessage = require('../models/ChatMessage.model');

module.exports = {
  findById: (id) => ChatMessage.findById(id),
  findOne:  (q)  => ChatMessage.findOne(q),
  count:    (q = {}) => ChatMessage.countDocuments(q),
};
