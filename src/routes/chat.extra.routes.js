'use strict';
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/apiHelpers');
const { protect } = require('../middleware/auth.middleware');
const ChatRoom = require('../models/ChatRoom.model');
const ChatMessage = require('../models/ChatMessage.model');
const { emit } = require('../sockets');

// List messages in a room
router.get('/rooms/:id/messages', protect, asyncHandler(async (req, res) => {
  const list = await ChatMessage.find({ roomId: req.params.id }).sort({ createdAt: 1 }).limit(500).lean();
  return ApiResponse.success(res, list);
}));

// Post a message to a room (also broadcast via socket)
router.post('/rooms/:id/messages', protect, asyncHandler(async (req, res) => {
  const { message, attachments } = req.body;
  if (!message) throw new ApiError(400, 'message required');
  const room = await ChatRoom.findById(req.params.id);
  if (!room) throw new ApiError(404, 'Room not found');
  const role = req.user.role === 'admin' ? 'agent' : 'customer';
  const doc = await ChatMessage.create({ roomId: room._id, senderId: req.user._id, senderRole: role, message, attachments });
  room.lastMessageAt = new Date();
  room.unreadCount = (room.unreadCount || 0) + 1;
  await room.save();
  emit.toChat(room._id, 'chat:message', { roomId: room._id, message: doc });
  return ApiResponse.created(res, doc);
}));

module.exports = router;
