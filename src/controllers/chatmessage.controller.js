'use strict';
const ChatMessage = require('../models/ChatMessage.model');
const crudFactory = require('../utils/crudFactory');

module.exports = crudFactory(ChatMessage, {
  searchFields: [],
  filterFields: ["roomId","senderId"],
  resourceName: 'ChatMessage',
});
