'use strict';
const ChatRoom = require('../models/ChatRoom.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(ChatRoom, {
  searchFields: ["subject","customerName","customerEmail"],
  filterFields: ["status","assignedTo"],
  resourceName: 'ChatRoom',
});
