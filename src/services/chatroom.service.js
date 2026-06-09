'use strict';
// Business logic helpers for ChatRoom. Import where you need shared queries.
const ChatRoom = require('../models/ChatRoom.model');

module.exports = {
  findById: (id) => ChatRoom.findById(id),
  findOne:  (q)  => ChatRoom.findOne(q),
  count:    (q = {}) => ChatRoom.countDocuments(q),
};
